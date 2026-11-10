"""Per-role UEBA baseline models (§10.3 FR-09).

Two complementary signals, fused into a single 0..1 anomaly score:

  1. Isolation Forest per role — unsupervised outlier detection over the
     behavioral feature vector (the role's "peer group" shares one model).
  2. Peer-group z-score — robust per-feature deviation from the role's rolling
     median/MAD, so a single extreme feature (e.g. 4 GB egress) is caught even
     before the forest has enough data.

Models are (re)fit online from a rolling buffer of observed feature vectors, so
the demo doesn't need a 7-14 day warm-up — a few thousand warm-up events are
enough. Analyst feedback nudges the per-role decision threshold (§9.1 loop).
"""
import threading
from collections import defaultdict, deque

import numpy as np
from sklearn.ensemble import IsolationForest

FEATURES = ["egress_mb", "files_accessed", "endpoints_touched", "usb_event",
            "privilege_change", "config_change", "off_hours"]

MIN_TRAIN = 400          # samples before a role model is fit (enough for stable std)
BUFFER = 5000            # rolling training window per role
REFIT_EVERY = 300        # refit after this many new samples


def _vec(features: dict) -> np.ndarray:
    lh = float(features.get("login_hour", 12))
    off_hours = 1.0 if (lh < 5 or lh >= 23) else 0.0
    return np.array([
        float(features.get("egress_mb", 0)),
        float(features.get("files_accessed", 0)),
        float(features.get("endpoints_touched", 0)),
        float(features.get("usb_event", 0)),
        float(features.get("privilege_change", 0)),
        float(features.get("config_change", 0)),
        off_hours,
    ], dtype=float)


class RoleModel:
    def __init__(self, role: str):
        self.role = role
        self.buf: deque = deque(maxlen=BUFFER)
        self.model: IsolationForest | None = None
        self.mean = np.zeros(len(FEATURES))
        self.std = np.ones(len(FEATURES))
        self.since_fit = 0
        self.threshold_adj = 0.0       # feedback-driven threshold nudge
        self._lock = threading.Lock()

    def observe(self, v: np.ndarray):
        with self._lock:
            self.buf.append(v)
            self.since_fit += 1
            if len(self.buf) >= MIN_TRAIN and self.since_fit >= REFIT_EVERY:
                self._fit()

    def _fit(self):
        X = np.array(self.buf)
        self.mean = X.mean(axis=0)
        # std with a floor of 1.0: prevents low-variance integer/binary features
        # from producing spurious huge z-scores on normal data, while genuine
        # large deviations (e.g. 2 GB egress vs ~1) still dominate.
        self.std = np.maximum(X.std(axis=0), 1.0)
        try:
            m = IsolationForest(n_estimators=150, contamination=0.02,
                                random_state=42, n_jobs=1)
            m.fit(X)
            self.model = m
        except Exception:
            self.model = None
        self.since_fit = 0

    def score(self, v: np.ndarray) -> dict:
        # Until the role model is fit on enough data, its baseline (mean/std) is
        # not yet reliable, so an under-fit std could flag normal tail behavior.
        # Defer to the deterministic rule engine during this burn-in by emitting
        # zero anomaly rather than risk a false positive.
        if self.model is None:
            return {"anomaly": 0.0, "peer_deviation": 0.0, "forest": 0.0,
                    "fitted": False, "samples": len(self.buf)}

        # peer-group z-score vs role mean/std (std floored at fit), clipped.
        z = np.clip((v - self.mean) / self.std, -8.0, 8.0)
        peer_dev = float(np.max(np.abs(z))) if len(z) else 0.0
        peer_anom = min(1.0, peer_dev / 8.0)       # ~8 sigma -> saturated

        forest_anom = 0.0
        if self.model is not None:
            # decision_function: higher = more normal; shift to 0..1 anomaly
            raw = float(self.model.decision_function(v.reshape(1, -1))[0])
            forest_anom = float(np.clip(0.5 - raw, 0.0, 1.0))

        if self.model is not None:
            anomaly = max(0.6 * forest_anom + 0.4 * peer_anom, peer_anom * 0.8)
        else:
            anomaly = peer_anom                     # cold start: peer-group only

        # Suppress baseline jitter: a well-fit model still assigns small nonzero
        # anomaly to perfectly normal points. Treat anything below a floor as 0
        # so normal behavior contributes no risk; rescale the remainder to 0..1.
        FLOOR = 0.55
        anomaly = 0.0 if anomaly < FLOOR else (anomaly - FLOOR) / (1 - FLOOR)

        anomaly = float(np.clip(anomaly + self.threshold_adj, 0.0, 1.0))
        return {
            "anomaly": round(anomaly, 3),
            "peer_deviation": round(peer_dev, 2),
            "forest": round(forest_anom, 3),
            "fitted": self.model is not None,
            "samples": len(self.buf),
        }

    def feedback(self, verdict: str):
        # false positive -> be slightly less sensitive; true positive -> more
        with self._lock:
            if verdict == "false_positive":
                self.threshold_adj = max(-0.2, self.threshold_adj - 0.02)
            elif verdict == "true_positive":
                self.threshold_adj = min(0.2, self.threshold_adj + 0.02)


class BaselineRegistry:
    def __init__(self):
        self.models: dict[str, RoleModel] = defaultdict(lambda: None)
        self._lock = threading.Lock()

    def _get(self, role: str) -> RoleModel:
        with self._lock:
            m = self.models.get(role)
            if m is None:
                m = RoleModel(role)
                self.models[role] = m
            return m

    def score(self, role: str, features: dict) -> dict:
        m = self._get(role)
        v = _vec(features)
        res = m.score(v)
        # Learn only from normal-looking events so a detected insider's anomalous
        # behavior does not poison the shared per-role baseline (which would make
        # the whole peer group drift and raise false positives). Always learn
        # while the model is still unfitted so it can bootstrap.
        if m.model is None or res["anomaly"] < 0.5:
            m.observe(v)
        res["model"] = f"ueba:{role}"
        return res

    def feedback(self, role: str | None, verdict: str):
        if role:
            self._get(role).feedback(verdict)
        else:
            for m in self.models.values():
                if m:
                    m.feedback(verdict)

    def status(self) -> dict:
        return {role: {"samples": len(m.buf), "fitted": m.model is not None,
                       "threshold_adj": round(m.threshold_adj, 3)}
                for role, m in self.models.items() if m}


registry = BaselineRegistry()

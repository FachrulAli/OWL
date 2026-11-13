"""Mesin aturan OWL: telemetri menjadi daftar temuan.

Satu fungsi pemeriksa per id aturan. Metadata dan parameternya dibaca dari
rules/rules.yaml, sehingga satuan dapat menyetel ambang tanpa menyentuh kode,
sedangkan pemeriksaannya tetap dapat diaudit sebagai kode.
"""
from __future__ import annotations

from datetime import date, datetime
from pathlib import Path

import yaml

from .config import settings
from .models import Finding, Telemetry

_CATALOG: dict = {}
_RULES: dict[str, dict] = {}

RULES_PATH = Path(__file__).resolve().parent.parent / "rules" / "rules.yaml"

# Izin yang, bila digabung, menjadikan aplikasi mampu merekam sekitarnya.
# Diukur sebagai gabungan karena satu izin mikrofon pada aplikasi pesan wajar.
_RECORDING = {"android.permission.RECORD_AUDIO",
              "android.permission.CAMERA"}
_LOCATION = {"android.permission.ACCESS_FINE_LOCATION",
             "android.permission.ACCESS_BACKGROUND_LOCATION"}

# Aplikasi sistem yang memang memegang izin perekaman secara sah.
_SYSTEM_PREFIX = ("com.android.", "com.google.android.", "android")

# Indikator yang harus terbaca agar sebuah aturan boleh dievaluasi (FR-03).
#
# Aturan yang indikatornya tidak terbaca TIDAK dijalankan, dan tidak pula
# dianggap lulus. Perbedaan itu penting: aturan yang dilewati muncul di
# dashboard sebagai indikator yang tidak dapat diperiksa, sedangkan aturan
# yang dijalankan dan tidak menyala muncul sebagai bersih. Menyamakan
# keduanya akan membuat perangkat yang tidak dapat diperiksa terlihat aman.
_NEEDS: dict[str, str] = {
    "OWL-R01": "accessibility",
    "OWL-R02": "accessibility",
    "OWL-A01": "install_source",
    "OWL-A02": "permissions",
    "OWL-C01": "certificates",
    "OWL-C02": "vpn",
    "OWL-D01": "integrity",
    "OWL-D02": "integrity",
    "OWL-N01": "network_volume",
    "OWL-N02": "network_destinations",
    "OWL-N03": "network_destinations",
    "OWL-X01": "attestation",
}


def indicator_ok(t: Telemetry, key: str) -> bool:
    """Apakah indikator ini terbaca pada pemeriksaan ini.

    Agent yang tidak melaporkan status sama sekali dianggap melaporkan ok,
    supaya agent versi lama tetap berfungsi. Status `partial` dianggap cukup:
    sebagian data memang terbaca, dan aturannya menilai yang terbaca itu.
    """
    st = t.availability.get(key)
    if st is None:
        return True
    return st.status in ("ok", "partial")


def load(path: Path | None = None) -> dict:
    global _CATALOG, _RULES
    _CATALOG = yaml.safe_load((path or RULES_PATH).read_text(encoding="utf-8"))
    _RULES = {r["id"]: r for r in _CATALOG["rules"]}
    return _CATALOG


def catalog() -> dict:
    if not _CATALOG:
        load()
    return _CATALOG


def _p(name: str, default):
    return catalog().get("parameters", {}).get(name, default)


def _allow(name: str) -> list[str]:
    return catalog().get("allowlists", {}).get(name) or []


def _mk(rule_id: str, evidence: list[str], severity: str | None = None) -> Finding:
    r = _RULES[rule_id]
    sev = severity or r["severity"]
    return Finding(
        rule_id=rule_id,
        category=r["category"],
        severity=sev,
        base_severity=sev,
        title=r["title"],
        detail=" ".join(r["detail"].split()),
        mitre=r.get("mitre", ""),
        confidence=r.get("confidence", ""),
        evidence=evidence,
    )


# ——————————————————————— pemeriksa per aturan ———————————————————————

def _r01(t: Telemetry) -> Finding | None:
    allowed = set(_allow("accessibility_services"))
    rogue = [s.package for s in t.accessibility_services if s.package not in allowed]
    if not rogue:
        return None
    return _mk("OWL-R01", [f"layanan aksesibilitas aktif: {p}" for p in rogue])


def _r02(t: Telemetry) -> Finding | None:
    rogue = [p for p in t.overlay_packages if not p.startswith(_SYSTEM_PREFIX)]
    if not rogue:
        return None
    return _mk("OWL-R02", [f"SYSTEM_ALERT_WINDOW: {p}" for p in rogue])


def _a01(t: Telemetry) -> Finding | None:
    allowed = set(_allow("installers"))
    side = [a.package for a in t.apps
            if a.installer not in allowed and not a.package.startswith(_SYSTEM_PREFIX)]
    if not side:
        return None
    ev = []
    for a in t.apps:
        if a.package in side:
            src = a.installer or "sumber tidak diketahui"
            ev.append(f"{a.package} dipasang oleh {src}")
    return _mk("OWL-A01", ev)


def _a02(t: Telemetry) -> Finding | None:
    hits = []
    for a in t.apps:
        if a.package.startswith(_SYSTEM_PREFIX):
            continue
        perms = set(a.permissions)
        if _RECORDING.issubset(perms) or (perms & _RECORDING and perms & _LOCATION):
            hits.append(f"{a.package}: {', '.join(sorted(p.rsplit('.', 1)[-1] for p in perms & (_RECORDING | _LOCATION)))}")
    if not hits:
        return None
    return _mk("OWL-A02", hits)


def _c01(t: Telemetry) -> Finding | None:
    if not t.user_certificates:
        return None
    return _mk("OWL-C01", [f"CA pengguna: {c.subject}" for c in t.user_certificates])


def _c02(t: Telemetry) -> Finding | None:
    allowed = set(_allow("vpn_profiles"))
    rogue = [v.name for v in t.vpn_profiles if v.name not in allowed]
    if not rogue:
        return None
    return _mk("OWL-C02", [f"profil VPN aktif: {n}" for n in rogue])


def _d01(t: Telemetry) -> Finding | None:
    i = t.integrity
    ev = []
    if i.play_integrity in ("FAILED",):
        ev.append("Play Integrity: FAILED")
    if i.root_artifacts:
        ev.append("artefak root: " + ", ".join(i.root_artifacts))
    if i.bootloader_unlocked:
        ev.append("bootloader terbuka")
    if not ev:
        return None
    return _mk("OWL-D01", ev)


def _d02(t: Telemetry) -> Finding | None:
    patch = t.integrity.security_patch
    if not patch:
        # Tidak diketahui bukan berarti aman. Dilaporkan sebagai low supaya
        # terlihat analis, tanpa menghukum perangkat seperti patch kedaluwarsa.
        return _mk("OWL-D02", ["tingkat patch keamanan tidak terbaca"], severity="low")
    try:
        d = date.fromisoformat(patch)
    except ValueError:
        return _mk("OWL-D02", [f"tingkat patch tidak terbaca: {patch}"], severity="low")
    age = (date.today() - d).days
    warn, fail = _p("patch_warn_days", 60), _p("patch_fail_days", 180)
    if age >= fail:
        return _mk("OWL-D02", [f"patch {patch}, tertinggal {age} hari"], severity="high")
    if age >= warn:
        return _mk("OWL-D02", [f"patch {patch}, tertinggal {age} hari"], severity="medium")
    return None


def _n01(t: Telemetry) -> Finding | None:
    n = t.network
    limit = _p("egress_idle_mb", 50.0)
    # Hanya dihitung jika perangkat memang nyaris tidak disentuh. Unggahan
    # besar sambil dipakai adalah hal biasa dan bukan urusan aturan ini.
    if n.egress_mb_24h < limit or n.screen_on_ratio_24h > 0.15:
        return None
    return _mk("OWL-N01", [
        f"unggahan {n.egress_mb_24h:.1f} MB dalam 24 jam",
        f"layar menyala {n.screen_on_ratio_24h * 100:.0f} persen dari waktu itu",
    ])


def _n02(t: Telemetry) -> Finding | None:
    n = t.network
    ev = []
    if len(n.unusual_destinations) >= _p("unusual_destination_min", 1):
        ev.append("tujuan tidak lazim: " + ", ".join(n.unusual_destinations[:5]))
    if n.beacon_jitter_pct <= _p("beacon_jitter_pct", 10.0):
        ev.append(f"interval keluar terlalu teratur (jitter {n.beacon_jitter_pct:.0f} persen)")
    if not ev:
        return None
    return _mk("OWL-N02", ev)


def _n03(t: Telemetry) -> Finding | None:
    new = t.network.new_destinations
    if len(new) < _p("new_destination_min", 1):
        return None
    return _mk("OWL-N03", ["tujuan baru: " + ", ".join(new[:5])])


def _x01(t: Telemetry) -> Finding | None:
    """Attestation agent, dengan dua lapis yang tidak setara.

    Key Attestation dapat diperiksa sepenuhnya luring: rantai sertifikatnya
    diverifikasi terhadap akar Google yang disematkan di OWL Core. Play
    Integrity tidak bisa, karena tokennya hanya dapat dibuka dengan menghubungi
    Google, dan itu mustahil pada jaringan air-gapped.

    Karena itu ketiadaan verdict Play Integrity BUKAN bukti agent palsu.
    Menyamakan keduanya pernah membuat seluruh perangkat ditolak pada mode
    air-gapped, yaitu justru mode penggelaran utama produk ini. Ditemukan
    2026-11-13 saat agent sungguhan pertama kali dijalankan di emulator.

      kunci tidak terbukti di perangkat keras  -> critical, laporan tidak dipercaya
      verdict FAILED                           -> critical, agent dinyatakan palsu
      verdict tidak diperoleh, kunci terbukti  -> air-gapped: sah, tidak ada temuan
                                                  terhubung: medium, perlu diperiksa
    """
    a = t.attestation
    if not a.key_attestation:
        return _mk("OWL-X01", [
            "kunci agent tidak terbukti berada di Keystore perangkat keras",
            f"verdict Play Integrity: {a.play_integrity}",
        ])
    if a.play_integrity == "FAILED":
        return _mk("OWL-X01", ["Play Integrity menyatakan agent bukan build asli: FAILED"])
    if a.play_integrity in ("MEETS_STRONG_INTEGRITY", "MEETS_DEVICE_INTEGRITY",
                            "MEETS_BASIC_INTEGRITY"):
        return None
    if settings.AIR_GAPPED:
        return None
    return _mk("OWL-X01", [
        f"verdict Play Integrity tidak diperoleh: {a.play_integrity}",
        "Key Attestation terbukti, jadi laporan tetap dipercaya dengan catatan",
    ], severity="medium")


_CHECKS = {
    "OWL-R01": _r01, "OWL-R02": _r02,
    "OWL-A01": _a01, "OWL-A02": _a02,
    "OWL-C01": _c01, "OWL-C02": _c02,
    "OWL-D01": _d01, "OWL-D02": _d02,
    "OWL-N01": _n01, "OWL-N02": _n02, "OWL-N03": _n03,
    "OWL-X01": _x01,
}

_ORDER = ["low", "medium", "high", "critical"]


def _downgrade(sev: str) -> str:
    i = _ORDER.index(sev)
    return _ORDER[max(0, i - 1)]


def evaluate(t: Telemetry) -> list[Finding]:
    """Jalankan seluruh aturan, lalu terapkan korelasi multi-sinyal.

    Aturan bertanda `corroborate` diturunkan satu tingkat severitas jika ia
    satu-satunya temuan pada perangkat itu. Inilah modul C pada deepdive §7.1:
    satu indikator di perangkat hampir selalu ambigu, beberapa indikator
    berbeda pada perangkat yang sama jauh lebih sulit dijelaskan sebagai
    pemakaian yang wajar.
    """
    if not _RULES:
        load()
    findings = []
    for rid, fn in _CHECKS.items():
        if not indicator_ok(t, _NEEDS.get(rid, "")):
            continue
        f = fn(t)
        if f is not None:
            findings.append(f)

    if len(findings) == 1:
        f = findings[0]
        if _RULES[f.rule_id].get("corroborate"):
            new = _downgrade(f.severity)
            if new != f.severity:
                f.severity = new
                f.downgraded = True

    order = {c: i for i, c in enumerate(["runtime", "app", "config", "device", "identity"])}
    findings.sort(key=lambda f: (order[f.category], -_ORDER.index(f.severity)))
    return findings


def skipped(t: Telemetry) -> list[str]:
    """Id aturan yang tidak dapat dievaluasi karena indikatornya tidak terbaca."""
    return sorted(rid for rid in _CHECKS
                  if not indicator_ok(t, _NEEDS.get(rid, "")))

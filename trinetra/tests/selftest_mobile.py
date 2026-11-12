"""Uji mandiri deteksi zero-click TRINETRA — tanpa Kafka/Docker/ClickHouse.

Jalankan:  python3 -m pip install pyyaml && python3 tests/selftest_mobile.py
Variabel:  ROUNDS=30000 python3 tests/selftest_mobile.py   (uji lebih panjang)

Keluar dengan kode 1 bila ada rantai yang tidak terdeteksi ATAU ada false
positive pada perangkat normal — jadi bisa dipakai sebagai gerbang CI.

Menjalankan simulator mobile apa adanya melalui normalisasi OCSF, aturan Sigma
atomik, dan engine korelasi. Yang dibuktikan:
  1. tiap HP yang dikompromikan memicu korelasi yang SEHARUSNYA;
  2. HP normal tidak memicu korelasi apa pun (false positive = 0);
  3. penyimpangan jinak (backup malam, HP panas saat dicas) tidak jadi kasus.
"""
import importlib.util
import os
import random
import sys
from collections import Counter, defaultdict

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.join(REPO, "services")
sys.path.insert(0, os.path.join(ROOT, "simulator"))


def mod(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    m = importlib.util.module_from_spec(spec)
    sys.modules[name] = m
    spec.loader.exec_module(m)
    return m


ocsf = mod("ocsf", os.path.join(ROOT, "backend/app/ocsf.py"))
sigma = mod("sigma_loader", os.path.join(ROOT, "backend/app/rules/sigma_loader.py"))
corr = mod("correlation", os.path.join(ROOT, "backend/app/rules/correlation.py"))
ioc = mod("indicators", os.path.join(ROOT, "backend/app/indicators.py"))
ioc.load(os.path.join(REPO, "infra", "indicators", "stix2"))
import mobile_sim  # noqa: E402

random.seed(20261112)
atomic, corr_rules = sigma.load(os.path.join(ROOT, "backend", "app", "rules", "sigma"))
print(f"\n  aturan atomik={len(atomic)}  korelasi={len(corr_rules)}\n")

ROUNDS = int(os.getenv("ROUNDS", "12000"))
fired = defaultdict(Counter)        # device -> Counter(correlation_id)
atomic_hits = defaultdict(Counter)  # device -> Counter(rule_id)
labels = defaultdict(Counter)
events = 0

for _ in range(ROUNDS):
    for raw in mobile_sim.make_batch():
        ev = ocsf.normalize(raw)
        if ev is None:
            continue
        ioc.enrich(ev)              # lapisan intel: cocokkan indikator STIX2
        events += 1
        labels[ev["entity_id"]][ev["label_scenario"]] += 1
        sigs = sigma.evaluate_atomic(ev)
        for s in sigs:
            atomic_hits[ev["entity_id"]][s["rule_id"]] += 1
        corr.observe(ev, sigs, corr_rules)
        for c in corr.evaluate(ev, corr_rules):
            fired[ev["entity_id"]][c["rule_id"]] += 1

print(f"  event diproses: {events}\n")

EXPECT = {
    "hp-pusat-pangti": "corr_zeroclick_fullchain",
    "hp-kodam-17-01":  "corr_zeroclick_fullchain",
    "hp-kodam-2-01":   "corr_zeroclick_beacon_chain",
    "hp-kodam-12-01":  "corr_sideload_to_surveillance",
    "hp-kodam-24-01":  "corr_beacon_persistent",
    "hp-kodam-9-01":   "corr_imsi_catcher",
}

print("  === HP YANG DIKOMPROMIKAN ===")
fails = []
for dev, want in EXPECT.items():
    got = fired.get(dev, Counter())
    ok = got.get(want, 0) > 0
    mark = "OK " if ok else "GAGAL"
    print(f"  [{mark}] {dev:18s} harap={want:32s} korelasi menyala="
          f"{dict(got) if got else '{}'}")
    if not ok:
        fails.append(f"{dev} tidak memicu {want}; yang menyala {dict(got)}")

print("\n  === HP NORMAL (harus BERSIH dari korelasi) ===")
clean = 0
for dev, _r, _n, _t, _p, _o, _m in mobile_sim.DEVICES:
    if dev in mobile_sim.COMPROMISED:
        continue
    got = fired.get(dev, Counter())
    if got:
        fails.append(f"FALSE POSITIVE: {dev} memicu {dict(got)}")
        print(f"  [GAGAL] {dev:18s} {dict(got)}")
    else:
        clean += 1
print(f"  {clean} HP normal, nol korelasi menyala.")

print("\n  === kecocokan indikator STIX2 (lapisan intel) ===")
ioc_hits = Counter()
for dev, c in atomic_hits.items():
    if c.get("mob_ioc_domain"):
        ioc_hits[dev] = c["mob_ioc_domain"]
for dev, n in ioc_hits.most_common():
    print(f"    {dev:18s} {n} event cocok daftar indikator")
if not ioc_hits:
    fails.append("tidak ada event yang cocok dengan daftar indikator STIX2")

print("\n  === aturan atomik pada HP normal (boleh menyala, tidak boleh jadi kasus) ===")
noise = Counter()
for dev, c in atomic_hits.items():
    if dev not in mobile_sim.COMPROMISED:
        noise.update(c)
for rid, n in noise.most_common(8):
    print(f"    {rid:28s} {n}")

print("\n  === label yang disuntik (ground truth) ===")
tot = Counter()
for c in labels.values():
    tot.update(c)
for k, v in tot.most_common():
    print(f"    {k:24s} {v}")

print("\n  " + ("=" * 60))
if fails:
    print(f"  HASIL: {len(fails)} MASALAH")
    for f in fails:
        print(f"    - {f}")
    sys.exit(1)
print("  HASIL: LULUS — 6/6 rantai terdeteksi, 0 false positive korelasi")

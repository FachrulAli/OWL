"""Pemindai APK dengan YARA-X (lapisan konten).

Mengapa lapisan ini ada: zero-click kelas Pegasus bersifat in-memory dan tidak
meninggalkan berkas, jadi YARA tidak akan pernah menangkapnya — itu tugas
lapisan perilaku. Yang ditangkap di sini adalah ancaman yang memang berbentuk
berkas: APK sideload berisi RAT/stalkerware, vektor yang nyata pada perangkat
dinas dan sering dipakai lewat rekayasa sosial ("ini aplikasi resmi satuan").

APK = arsip ZIP dengan isi terkompresi, sehingga memindai berkas APK mentah
hampir tidak menemukan apa pun. Pemindai ini membongkar arsip di memori lalu
menjalankan aturan pada tiap anggota (classes*.dex, AndroidManifest.xml,
lib/, assets/).

Keamanan pemindai itu sendiri: berkas yang dipindai adalah masukan yang TIDAK
dipercaya. Karena itu tidak ada anggota arsip yang ditulis ke disk, nama
anggota tidak pernah dipakai sebagai path, dan ada batas jumlah anggota serta
ukuran hasil dekompresi (pelindung zip bomb).
"""
import hashlib
import io
import os
import zipfile

try:
    import yara_x
except ImportError:                      # pemindai opsional
    yara_x = None

from . import indicators

YARA_DIR = os.getenv(
    "YARA_DIR",
    os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(
        os.path.dirname(os.path.abspath(__file__))))), "infra", "yara"))

MAX_MEMBERS = int(os.getenv("APK_MAX_MEMBERS", "500"))
MAX_UNCOMPRESSED = int(os.getenv("APK_MAX_UNCOMPRESSED", str(150 * 1024 * 1024)))
MAX_MEMBER_BYTES = int(os.getenv("APK_MAX_MEMBER_BYTES", str(40 * 1024 * 1024)))

# anggota arsip yang relevan untuk analisis statis
_SCAN_SUFFIX = (".dex", ".xml", ".so", ".json", ".js", ".txt", ".properties",
                ".arsc", ".jar", ".apk")

_rules = None
_meta = {"loaded": False, "rules": 0, "dir": YARA_DIR, "engine": None,
         "error": ""}


def load(directory: str | None = None) -> dict:
    """Kompilasi seluruh berkas .yar/.yara menjadi satu set aturan."""
    global _rules
    d = directory or YARA_DIR
    _meta.update({"dir": d, "loaded": False, "rules": 0, "error": ""})
    if yara_x is None:
        _meta["error"] = "paket yara-x tidak terpasang; pemindaian APK dinonaktifkan"
        print(f"[yara] {_meta['error']}", flush=True)
        return _meta
    if not os.path.isdir(d):
        _meta["error"] = f"direktori aturan tidak ada: {d}"
        print(f"[yara] {_meta['error']}", flush=True)
        return _meta

    sources = []
    for fn in sorted(os.listdir(d)):
        if fn.endswith((".yar", ".yara")):
            try:
                with open(os.path.join(d, fn)) as f:
                    sources.append(f.read())
            except OSError as e:
                print(f"[yara] gagal baca {fn}: {e}", flush=True)
    if not sources:
        _meta["error"] = "tidak ada berkas aturan .yar"
        return _meta

    try:
        _rules = yara_x.compile("\n".join(sources))
    except Exception as e:                # CompileError dsb.
        _rules = None
        _meta["error"] = f"kompilasi gagal: {e}"
        print(f"[yara] {_meta['error']}", flush=True)
        return _meta

    n = sum(s.count("\nrule ") + s.startswith("rule ") for s in sources)
    try:
        from importlib.metadata import version
        ver = version("yara-x")
    except Exception:
        ver = "n/a"
    _meta.update({"loaded": True, "rules": n, "engine": f"YARA-X {ver}"})
    print(f"[yara] {n} aturan dimuat dari {d} ({_meta['engine']})", flush=True)
    return _meta


def ready() -> bool:
    return _rules is not None


def _scan_bytes(data: bytes, where: str) -> list[dict]:
    if _rules is None or not data:
        return []
    try:
        res = _rules.scan(data)
    except Exception as e:
        print(f"[yara] gagal memindai {where}: {e}", flush=True)
        return []
    out = []
    for m in res.matching_rules:
        meta = {k: v for k, v in (m.metadata or ())}
        out.append({
            "rule": m.identifier,
            "where": where,
            "description": str(meta.get("description", "")),
            "severity": float(meta.get("severity", 20) or 20),
            "category": str(meta.get("category", "malicious_app")),
            "mitre": [t for t in str(meta.get("mitre", "")).split(",") if t],
            "confidence": str(meta.get("confidence", "medium")),
        })
    return out


def _should_scan(name: str) -> bool:
    base = name.rsplit("/", 1)[-1].lower()
    return base.endswith(_SCAN_SUFFIX) or base == "androidmanifest.xml"


def scan_apk(data: bytes, filename: str = "") -> dict:
    """Pindai satu berkas APK. Mengembalikan putusan + rincian temuan."""
    sha256 = hashlib.sha256(data).hexdigest()
    result = {
        "filename": os.path.basename(filename or "unggahan.apk"),
        "sha256": sha256,
        "size_bytes": len(data),
        "engine": _meta.get("engine") or "tidak tersedia",
        "matches": [],
        "members_scanned": 0,
        "ioc_match": "",
        "verdict": "clean",
        "score": 0.0,
        "notes": [],
    }
    if not ready():
        result["verdict"] = "unavailable"
        result["notes"].append(_meta.get("error") or "pemindai tidak siap")
        return result

    # 1) cocokkan sidik berkas dengan daftar indikator STIX2 (kelas Pegasus dsb.)
    camp = indicators.hashes.get(sha256)
    if camp:
        result["ioc_match"] = f"{camp}/sha256"
        result["notes"].append(
            f"sidik SHA-256 berkas ini terdaftar pada indikator kampanye {camp}")

    # 2) pindai berkas utuh (menangkap APK yang entri-nya tidak terkompresi)
    matches = _scan_bytes(data, "<apk>")

    # 3) bongkar di memori lalu pindai tiap anggota
    try:
        zf = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile:
        result["notes"].append("bukan arsip ZIP yang sah — bukan APK?")
        zf = None

    if zf is not None:
        total = 0
        with zf:
            for i, info in enumerate(zf.infolist()):
                if i >= MAX_MEMBERS:
                    result["notes"].append(
                        f"arsip punya lebih dari {MAX_MEMBERS} anggota; sisanya dilewati")
                    break
                name = info.filename
                # nama anggota berasal dari berkas yang tidak dipercaya: tidak
                # pernah dipakai sebagai path, hanya sebagai label.
                if info.is_dir() or not _should_scan(name):
                    continue
                if info.file_size > MAX_MEMBER_BYTES:
                    result["notes"].append(f"anggota terlalu besar, dilewati: {name}")
                    continue
                if total + info.file_size > MAX_UNCOMPRESSED:
                    result["notes"].append(
                        "batas total dekompresi tercapai; pemindaian dihentikan")
                    break
                try:
                    with zf.open(info) as fh:
                        blob = fh.read(MAX_MEMBER_BYTES)
                except (zipfile.BadZipFile, OSError, RuntimeError) as e:
                    result["notes"].append(f"gagal membuka {name}: {e}")
                    continue
                total += len(blob)
                result["members_scanned"] += 1
                matches.extend(_scan_bytes(blob, name))

    # 4) gabungkan: satu aturan dihitung sekali walau cocok di banyak anggota
    best: dict[str, dict] = {}
    for m in matches:
        cur = best.get(m["rule"])
        if cur is None:
            best[m["rule"]] = dict(m, hits=1)
        else:
            cur["hits"] += 1
            if cur["where"] != m["where"]:
                cur["where"] = f"{cur['where']}, {m['where']}"
    result["matches"] = sorted(best.values(), key=lambda x: -x["severity"])

    # Skor: jumlah severity dengan hasil menurun, supaya banyak aturan
    # berkepercayaan rendah tidak pernah setara dengan satu temuan kuat.
    import math
    s = sum(m["severity"] for m in result["matches"])
    score = 100.0 * (1 - math.exp(-s / 70.0)) if s else 0.0
    if result["ioc_match"]:
        score = max(score, 95.0)
    result["score"] = round(score, 1)
    result["verdict"] = ("malicious" if score >= 70 else
                         "suspicious" if score >= 35 else
                         "low_risk" if score > 0 else "clean")
    if not result["matches"] and not result["ioc_match"]:
        result["notes"].append(
            "tidak ada aturan yang cocok. Ini BUKAN jaminan aman: analisis "
            "statis tidak melihat muatan yang diunduh saat aplikasi berjalan.")
    return result


def stats() -> dict:
    return dict(_meta)

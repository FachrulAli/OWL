"""Sweep forensik iOS — menutup celah yang tidak bisa diisi agent real-time.

MENGAPA MODUL INI ADA. Di Android, agent bisa memantau terus-menerus. Di iOS
tidak: tidak ada API untuk daftar proses, tidak ada API untuk crash proses
sistem, dan aplikasi pihak ketiga tidak bisa melihat apa pun di luar
sandbox-nya. Mengklaim "pemantauan zero-click real-time di iPhone" adalah
klaim yang tidak bisa dipenuhi aplikasi App Store mana pun.

Yang BISA dilakukan — dan ini cara kerja industri forensik mobile sebenarnya
(MVT dari Amnesty International, iShutdown dari Kaspersky) — adalah **sweep
berkala**: pemegang perangkat menarik bundel diagnostik sendiri
(Setelan → Privasi & Keamanan → Analisis → Data Analisis, atau sysdiagnose),
lalu bundel itu dianalisis di server.

Konsekuensinya jujur: deteksi iOS di TRINETRA bersifat **periodik dan
retrospektif**, bukan langsung. Sebuah kompromi bisa ditemukan beberapa hari
setelah terjadi. Itu tetap jauh lebih baik daripada tidak pernah tahu —
seluruh pengungkapan Pegasus di dunia dilakukan dengan cara ini.

Yang diperiksa:
  1. `shutdown.log` — proses yang masih berjalan saat perangkat dimatikan.
     Teknik iShutdown: implan sering menahan proses shutdown, dan jejaknya
     tertinggal di berkas ini berulang kali pada path yang sama.
  2. Laporan crash (`*.ips`, `*.crash`) — nama proses yang mati tidak wajar.
     Inilah tahap EKSPLOITASI rantai zero-click, yang di iOS hanya terlihat
     dari sini. Crash pada parser pesan (IMTransferAgent, BlastDoor,
     mediaserverd) jauh lebih berarti daripada crash aplikasi biasa.
  3. Seluruh berkas teks — dicocokkan dengan domain/IP/proses/path dari
     3.166 indikator STIX2 publik.

KEAMANAN MODUL INI: bundel yang dianalisis adalah berkas dari perangkat yang
mungkin sudah dikuasai penyerang. Karena itu tidak ada anggota arsip yang
ditulis ke disk, tidak ada symlink yang diikuti, nama anggota tidak pernah
dipakai sebagai path, dan ada batas jumlah serta ukuran dekompresi.
"""
import io
import os
import re
import tarfile
import zipfile
from collections import Counter

from . import indicators

MAX_MEMBERS = int(os.getenv("SWEEP_MAX_MEMBERS", "4000"))
MAX_UNCOMPRESSED = int(os.getenv("SWEEP_MAX_UNCOMPRESSED", str(400 * 1024 * 1024)))
MAX_MEMBER_BYTES = int(os.getenv("SWEEP_MAX_MEMBER_BYTES", str(24 * 1024 * 1024)))

# Proses iOS yang memproses masukan dari luar tanpa interaksi pengguna.
# Crash pada proses INI adalah penanda tahap eksploitasi zero-click.
IOS_PARSER_PROCS = {
    "imtransferagent", "messagesblastdoorservice", "blastdoor", "mediaserverd",
    "identityservicesd", "imagent", "webkit.networking", "com.apple.webkit",
    "com.apple.webkit.webcontent", "avconferenced", "mobilesms",
    "messages", "coretelephony", "commcenter",
}

_TEXT_SUFFIX = (".log", ".txt", ".ips", ".crash", ".stacks", ".json", ".plist",
                ".synced", ".state", ".csv")

# baris shutdown.log: "... <pid> <path>" — yang menarik adalah path prosesnya
_SHUTDOWN_PATH = re.compile(r"(/[\w\-./]+)")
# nama proses pada laporan crash .ips (JSON header) maupun .crash (teks)
_IPS_PROC = re.compile(r'"procName"\s*:\s*"([^"]+)"')
_CRASH_PROC = re.compile(r"^Process:\s+(\S+)", re.MULTILINE)
_IPS_REASON = re.compile(r'"exception"\s*:\s*\{[^}]*"type"\s*:\s*"([^"]+)"')


def _members_tar(data: bytes):
    """Iterasi anggota tar/tar.gz TANPA mengekstrak ke disk."""
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:*") as tf:
        count = 0
        total = 0
        for info in tf:
            if count >= MAX_MEMBERS or total >= MAX_UNCOMPRESSED:
                break
            count += 1
            # Hanya berkas biasa. Symlink/hardlink/device dilewati: itu jalur
            # klasik untuk membuat pembaca arsip menyentuh berkas di luar arsip.
            if not info.isfile():
                continue
            if info.size > MAX_MEMBER_BYTES:
                continue
            try:
                fh = tf.extractfile(info)
                if fh is None:
                    continue
                blob = fh.read(MAX_MEMBER_BYTES)
            except (tarfile.TarError, OSError):
                continue
            total += len(blob)
            yield info.name, blob


def _members_zip(data: bytes):
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        count = 0
        total = 0
        for info in zf.infolist():
            if count >= MAX_MEMBERS or total >= MAX_UNCOMPRESSED:
                break
            count += 1
            if info.is_dir() or info.file_size > MAX_MEMBER_BYTES:
                continue
            try:
                with zf.open(info) as fh:
                    blob = fh.read(MAX_MEMBER_BYTES)
            except (zipfile.BadZipFile, OSError, RuntimeError):
                continue
            total += len(blob)
            yield info.filename, blob


def _iter_members(data: bytes):
    try:
        yield from _members_tar(data)
        return
    except tarfile.TarError:
        pass
    try:
        yield from _members_zip(data)
    except zipfile.BadZipFile:
        return


def _is_text(name: str) -> bool:
    return name.lower().endswith(_TEXT_SUFFIX)


def _basename(p: str) -> str:
    return p.rsplit("/", 1)[-1].lower()


def sweep(data: bytes, filename: str = "") -> dict:
    """Analisis satu bundel diagnostik iOS. Mengembalikan temuan + event."""
    result = {
        "filename": os.path.basename(filename or "sysdiagnose"),
        "size_bytes": len(data),
        "members_seen": 0,
        "members_scanned": 0,
        "shutdown_entries": 0,
        "crashes": [],
        "parser_crashes": [],
        "ioc_hits": [],
        "verdict": "clean",
        "score": 0.0,
        "events": [],
        "notes": [],
    }

    shutdown_paths: Counter = Counter()
    crash_procs: Counter = Counter()
    crash_reason: dict[str, str] = {}
    ioc_seen: dict[str, dict] = {}

    for name, blob in _iter_members(data):
        result["members_seen"] += 1
        if not _is_text(name):
            continue
        result["members_scanned"] += 1
        try:
            text = blob.decode("utf-8", errors="replace")
        except Exception:
            continue

        base = _basename(name)

        # ——— 1. shutdown.log (teknik iShutdown) ———
        if base == "shutdown.log":
            for line in text.splitlines():
                for path in _SHUTDOWN_PATH.findall(line):
                    # hanya path proses yang relevan, bukan setiap path di log
                    if path.count("/") >= 2 and len(path) < 200:
                        shutdown_paths[path] += 1
                        result["shutdown_entries"] += 1

        # ——— 2. laporan crash ———
        if base.endswith((".ips", ".crash")):
            procs = _IPS_PROC.findall(text) or _CRASH_PROC.findall(text)
            for p in procs:
                crash_procs[p] += 1
                m = _IPS_REASON.search(text)
                if m:
                    crash_reason[p] = m.group(1)

        # ——— 3. pencocokan indikator pada seluruh berkas teks ———
        _match_text(text, name, ioc_seen)

    # ——— rangkum shutdown.log ———
    # Yang mencurigakan bukan sekadar muncul, tapi muncul BERULANG pada path
    # yang tidak dikenal — itu pola proses yang menahan shutdown berkali-kali.
    for path, n in shutdown_paths.most_common():
        camp = indicators.file_paths.get(path.lower())
        if camp:
            _add_ioc(ioc_seen, camp, "file-path", path, "shutdown.log")
        elif n >= 3 and not path.startswith(("/System/", "/usr/", "/bin/",
                                             "/sbin/", "/Developer/")):
            result["notes"].append(
                f"path tidak dikenal menahan shutdown {n}× : {path} "
                f"(perlu diperiksa manual; bukan bukti)")

    # ——— rangkum crash ———
    for proc, n in crash_procs.most_common(40):
        entry = {"process": proc, "count": n,
                 "reason": crash_reason.get(proc, "")}
        result["crashes"].append(entry)
        camp = indicators.processes.get(proc.lower())
        if camp:
            _add_ioc(ioc_seen, camp, "process-name", proc, "crash report")
        if proc.lower() in IOS_PARSER_PROCS:
            result["parser_crashes"].append(entry)

    result["ioc_hits"] = sorted(ioc_seen.values(),
                                key=lambda x: -x["count"])

    # ——— event untuk pipeline ———
    # Temuan tidak berhenti sebagai laporan: ia masuk ke pipeline yang sama
    # supaya aturan dan korelasi yang sama berlaku. Perbedaannya hanya
    # perangkatnya iOS dan waktunya retrospektif.
    for e in result["parser_crashes"]:
        result["events"].append({
            "category": "proc",
            "activity": "abnormal_process_exit",
            "crash_proc": e["process"],
            "crash_count": e["count"],
            "crash_reason": e["reason"] or "unknown",
            # Bundel diagnostik hanya terbit saat perangkat idle/dimatikan;
            # tidak ada bukti interaksi pengguna pada momen crash.
            "screen_on": 0,
            "user_interaction": 0,
            "foreground_app": "",
            "platform": "ios",
        })
    for hit in result["ioc_hits"]:
        ev = {
            "category": "net" if hit["type"] in ("domain-name", "ipv4-addr") else "integrity",
            "activity": "forensic_ioc_match",
            "screen_on": 0,
            "user_interaction": 0,
            "platform": "ios",
        }
        if hit["type"] == "domain-name":
            ev["dns_domain"] = hit["value"]
        elif hit["type"] == "ipv4-addr":
            ev["dest_ip"] = hit["value"]
        elif hit["type"] == "process-name":
            ev["crash_proc"] = hit["value"]
        result["events"].append(ev)

    # ——— skor & putusan ———
    import math
    weight = 0.0
    weight += 45.0 * len(result["ioc_hits"])
    weight += 30.0 * len(result["parser_crashes"])
    score = 100.0 * (1 - math.exp(-weight / 60.0)) if weight else 0.0
    result["score"] = round(score, 1)
    result["verdict"] = ("compromised" if result["ioc_hits"] else
                         "suspicious" if result["parser_crashes"] else
                         "low_risk" if result["notes"] else "clean")

    if result["members_seen"] == 0:
        result["notes"].append(
            "arsip tidak dapat dibaca — format yang didukung: .tar, .tar.gz, .zip")
    if not result["ioc_hits"] and not result["parser_crashes"]:
        result["notes"].append(
            "tidak ada indikator yang cocok. Ini BUKAN jaminan bersih: "
            "indikator publik hanya mengenali kampanye yang sudah terungkap, "
            "dan bundel diagnostik tidak memuat seluruh jejak sistem.")
    return result


def _add_ioc(store: dict, campaign: str, kind: str, value: str, where: str):
    key = f"{kind}:{value.lower()}"
    cur = store.get(key)
    if cur:
        cur["count"] += 1
        if where not in cur["where"]:
            cur["where"].append(where)
    else:
        store[key] = {"campaign": campaign, "type": kind, "value": value,
                      "count": 1, "where": [where]}


# Domain di dalam berkas log: dibatasi pada bentuk host yang wajar supaya
# tidak setiap potongan teks dianggap domain.
_HOST = re.compile(r"\b((?:[a-z0-9](?:[a-z0-9\-]{0,61}[a-z0-9])?\.){1,5}"
                   r"(?:com|net|org|io|co|info|xyz|top|cc|icu|shop|club|site|"
                   r"online|pro|biz|me|tv|cloud|app|dev|link|live|news|work))\b",
                   re.IGNORECASE)
_IP = re.compile(r"\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b")


def _match_text(text: str, where: str, store: dict):
    """Cocokkan isi satu berkas teks dengan tabel indikator."""
    # Batasi jumlah kandidat per berkas: log iOS bisa sangat panjang dan
    # pencocokan tak terbatas akan membuat sweep berjalan lama tanpa
    # menambah temuan yang berarti.
    for host in set(_HOST.findall(text[:4_000_000]))  :
        camp = indicators._domain_hit(host)
        if camp:
            _add_ioc(store, camp, "domain-name", host, _basename(where))
    for ip in set(_IP.findall(text[:2_000_000])):
        camp = indicators.ips.get(ip)
        if camp:
            _add_ioc(store, camp, "ipv4-addr", ip, _basename(where))

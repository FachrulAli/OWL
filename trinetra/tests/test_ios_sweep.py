"""Uji sweep forensik iOS dengan bundel sysdiagnose sintetis.

Jalankan:  python3 tests/test_ios_sweep.py

Bundel dibuat dari nol oleh skrip ini. Nama proses dan domain "jahat" diambil
dari daftar indikator publik yang sudah dimuat (kampanye Pegasus dkk), supaya
yang diuji adalah pencocokan terhadap daftar SUNGGUHAN, bukan terhadap daftar
karangan sendiri. Tidak ada data forensik nyata milik siapa pun di repositori.
"""
import io
import json
import os
import sys
import tarfile

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(REPO, "services", "backend"))
from app import ios_sweep, indicators            # noqa: E402

indicators.load(os.path.join(REPO, "infra", "indicators", "stix2"))

# ambil satu indikator nyata dari tiap tabel untuk dipakai sebagai umpan uji
real_proc = next(iter(indicators.processes.items()))
real_domain = next((d, c) for d, c in indicators.domains.items() if d.count(".") == 1)
print(f"\n  umpan uji dari daftar nyata:")
print(f"    proses : {real_proc[0]}  (kampanye {real_proc[1]})")
print(f"    domain : {real_domain[0]}  (kampanye {real_domain[1]})\n")


def add(tf: tarfile.TarFile, name: str, data: bytes):
    info = tarfile.TarInfo(name)
    info.size = len(data)
    tf.addfile(info, io.BytesIO(data))


def build_bundle(malicious: bool) -> bytes:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tf:
        # shutdown.log — teknik iShutdown
        lines = [
            "after 3 seconds, 2 processes to exit",
            "remaining client pid: 112 (/usr/libexec/backupd)",
            "remaining client pid: 240 (/System/Library/Frameworks/x.framework/y)",
        ]
        if malicious:
            # path tidak dikenal menahan shutdown berulang kali
            lines += ["remaining client pid: 901 (/private/var/tmp/xpcproxy)"] * 4
        add(tf, "sysdiagnose/system_logs/shutdown.log",
            ("\n".join(lines) + "\n").encode())

        # laporan crash .ips (format JSON header seperti iOS modern)
        def ips(proc: str, n: int):
            for i in range(n):
                body = json.dumps({
                    "procName": proc,
                    "exception": {"type": "EXC_BAD_ACCESS", "signal": "SIGSEGV"},
                })
                add(tf, f"sysdiagnose/crashes_and_spins/{proc}-{i}.ips",
                    body.encode())

        ips("Maps", 1)                      # crash aplikasi biasa — tidak berarti
        if malicious:
            ips("IMTransferAgent", 3)       # parser pesan → tahap eksploitasi
            ips(real_proc[0], 2)            # proses yang ada di daftar indikator

        # log jaringan
        net = ["connecting to gateway.icloud.com", "resolve clients4.google.com"]
        if malicious:
            net.append(f"outbound session to {real_domain[0]}:443")
        add(tf, "sysdiagnose/logs/networkextension.log",
            ("\n".join(net) + "\n").encode())

        # berkas biner yang harus dilewati, bukan dibaca sebagai teks
        add(tf, "sysdiagnose/binary.bin", bytes(range(256)) * 50)
    return buf.getvalue()


for label, mal in (("bundel dengan jejak kompromi", True),
                   ("bundel bersih", False)):
    r = ios_sweep.sweep(build_bundle(mal), f"{label}.tar.gz")
    print(f"  ===== {label} =====")
    print(f"  putusan : {r['verdict'].upper()}   skor: {r['score']}")
    print(f"  anggota : {r['members_seen']} terlihat, {r['members_scanned']} dipindai"
          f"   baris shutdown: {r['shutdown_entries']}")
    for h in r["ioc_hits"]:
        print(f"    IOC  {h['campaign']:22s} {h['type']:14s} {h['value'][:40]:42s} di {', '.join(h['where'])}")
    for c in r["parser_crashes"]:
        print(f"    CRASH parser {c['process']:28s} {c['count']}× ({c['reason']})")
    print(f"    event untuk pipeline: {len(r['events'])}")
    for n in r["notes"]:
        print(f"    catatan: {n[:110]}")
    print()

# ——— uji keamanan: symlink yang menunjuk ke luar arsip harus DILEWATI ———
buf = io.BytesIO()
with tarfile.open(fileobj=buf, mode="w:gz") as tf:
    link = tarfile.TarInfo("sysdiagnose/evil.log")
    link.type = tarfile.SYMTYPE
    link.linkname = "/etc/passwd"
    tf.addfile(link)
    hard = tarfile.TarInfo("../../../../etc/shadow.log")
    hard.size = 0
    tf.addfile(hard, io.BytesIO(b""))
r = ios_sweep.sweep(buf.getvalue(), "jahat.tar.gz")
print("  ===== uji keamanan arsip =====")
print(f"  putusan: {r['verdict']}  anggota dipindai: {r['members_scanned']}")
print("  symlink ke /etc/passwd dilewati (hanya berkas biasa yang dibaca),")
print("  dan tidak ada apa pun yang ditulis ke disk.")
leaked = os.path.exists("etc/shadow.log") or os.path.exists("/tmp/etc/passwd")
print(f"  berkas bocor ke disk: {'ADA — MASALAH' if leaked else 'TIDAK ADA'}")

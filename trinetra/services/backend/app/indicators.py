"""Pemuat indikator kompromi STIX2 (lapisan intel).

Memuat berkas `.stix2` yang dipublikasikan Amnesty International Security Lab
(CC-BY) dan proyek mvt-indicators (MIT), lalu mengubahnya menjadi tabel
pencocokan dalam memori. Lihat `infra/indicators/ATTRIBUTION.md`.

Posisi lapisan ini di TRINETRA: PELENGKAP, bukan tulang punggung. Indikator
hanya mengenali infrastruktur yang SUDAH diketahui publik, sedangkan tugas
utama TRINETRA adalah mengenali zero-click yang BELUM dikenal siapa pun lewat
perilaku. Karena itu kecocokan IOC tetap harus lewat jalur korelasi yang sama
dan tidak pernah langsung menjadi kasus kritis dengan sendirinya.

Subset STIX2 yang diparse (sama seperti yang dipakai MVT): domain-name,
ipv4-addr, file:hashes.sha256, app:id, app:cert.sha256, process:name,
file:path, file:name, email-addr, configuration-profile:id.
"""
import glob
import json
import os
import re

INDICATORS_DIR = os.getenv(
    "INDICATORS_DIR",
    os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(
        os.path.dirname(os.path.abspath(__file__))))), "infra", "indicators",
        "stix2"))

# pola STIX2 sederhana: [<objek>:<properti> = '<nilai>']
_PATTERN = re.compile(
    r"\[\s*([\w\-]+):([\w\.'\-]+)\s*=\s*'([^']+)'", re.IGNORECASE)
_IPV4 = re.compile(r"^\d{1,3}(\.\d{1,3}){3}$")

# nilai -> nama kampanye
domains: dict[str, str] = {}
ips: dict[str, str] = {}
hashes: dict[str, str] = {}
app_ids: dict[str, str] = {}
processes: dict[str, str] = {}
file_paths: dict[str, str] = {}
file_names: dict[str, str] = {}
emails: dict[str, str] = {}
profiles: dict[str, str] = {}

_TABLES = {
    "domain-name:value": domains,
    "ipv4-addr:value": ips,
    "file:hashes.sha256": hashes,
    "file:hashes.'sha-256'": hashes,
    "app:id": app_ids,
    "app:cert.sha256": hashes,
    "process:name": processes,
    "file:path": file_paths,
    "file:name": file_names,
    "email-addr:value": emails,
    "configuration-profile:id": profiles,
}

_meta = {"campaigns": [], "files": 0, "indicators": 0, "skipped": 0,
         "dir": INDICATORS_DIR}


def load(directory: str | None = None) -> dict:
    d = directory or INDICATORS_DIR
    for t in (domains, ips, hashes, app_ids, processes, file_paths,
              file_names, emails, profiles):
        t.clear()
    campaigns = []
    files = indicators = skipped = 0

    for path in sorted(glob.glob(os.path.join(d, "*.stix2"))):
        try:
            with open(path) as f:
                bundle = json.load(f)
        except (OSError, ValueError) as e:
            print(f"[ioc] gagal baca {os.path.basename(path)}: {e}", flush=True)
            continue
        files += 1
        objs = bundle.get("objects") or []
        # nama kampanye diambil dari objek malware di dalam bundel yang sama
        names = [o.get("name") for o in objs if o.get("type") == "malware"
                 and o.get("name")]
        campaign = names[0] if names else os.path.basename(path).split(".")[0]
        campaigns.append(campaign)

        for o in objs:
            if o.get("type") != "indicator":
                continue
            m = _PATTERN.search(o.get("pattern") or "")
            if not m:
                skipped += 1
                continue
            obj, prop, value = m.group(1).lower(), m.group(2).lower(), m.group(3)
            table = _TABLES.get(f"{obj}:{prop}")
            if table is None:
                skipped += 1
                continue
            key = value.strip().lower()
            if not key:
                continue
            # indikator pertama yang mengklaim sebuah nilai yang menang; nilai
            # yang dipakai beberapa kampanye diberi label gabungan.
            prev = table.get(key)
            if prev and campaign not in prev.split("+"):
                table[key] = f"{prev}+{campaign}"
            else:
                table.setdefault(key, campaign)
            indicators += 1

    _meta.update({"campaigns": sorted(set(campaigns)), "files": files,
                  "indicators": indicators, "skipped": skipped, "dir": d})
    print(f"[ioc] dimuat {indicators} indikator dari {files} berkas "
          f"({len(set(campaigns))} kampanye): domain={len(domains)} "
          f"ip={len(ips)} hash={len(hashes)} app={len(app_ids)} "
          f"proses={len(processes)}", flush=True)
    return _meta


def _domain_hit(host: str) -> str | None:
    """Cocokkan host persis, lalu sebagai subdomain dari indikator.

    Pencocokan subdomain dilakukan dari kanan dan harus pada batas titik,
    supaya 'notevil-example.com' TIDAK cocok dengan indikator 'example.com'.
    """
    host = host.strip().lower().rstrip(".")
    if not host:
        return None
    hit = domains.get(host)
    if hit:
        return hit
    parts = host.split(".")
    for i in range(1, len(parts) - 1):
        hit = domains.get(".".join(parts[i:]))
        if hit:
            return hit
    return None


def match(ev: dict) -> tuple[str, str] | None:
    """Kembalikan (label_kampanye, jenis_indikator) jika event cocok IOC."""
    host = str(ev.get("dns_domain") or "")
    if host:
        if _IPV4.match(host):
            c = ips.get(host)
            if c:
                return c, "ipv4-addr"
        else:
            c = _domain_hit(host)
            if c:
                return c, "domain-name"

    ip = str(ev.get("dest_ip") or "")
    if ip:
        c = ips.get(ip.strip().lower())
        if c:
            return c, "ipv4-addr"

    h = str(ev.get("pkg_sha256") or "").strip().lower()
    if h:
        c = hashes.get(h)
        if c:
            return c, "sha256"

    pkg = str(ev.get("pkg_name") or "").strip().lower()
    if pkg:
        c = app_ids.get(pkg)
        if c:
            return c, "app-id"

    for field in ("crash_proc", "foreground_app"):
        v = str(ev.get(field) or "").strip().lower()
        if v:
            c = processes.get(v)
            if c:
                return c, "process-name"

    return None


def enrich(ev: dict) -> dict:
    """Tandai event dengan kampanye spyware yang cocok, jika ada."""
    hit = match(ev)
    ev["ioc_match"] = f"{hit[0]}/{hit[1]}" if hit else ""
    return ev


def stats() -> dict:
    return dict(_meta, tables={
        "domains": len(domains), "ips": len(ips), "hashes": len(hashes),
        "app_ids": len(app_ids), "processes": len(processes),
        "file_paths": len(file_paths), "file_names": len(file_names),
        "emails": len(emails), "profiles": len(profiles)})

"""The 8 insider-threat anomaly scenarios (§10.3 FR-10).

Each scenario is a generator that, given a base event dict for an entity,
mutates it into a malicious-looking event. Scenarios are injected at a low
rate on top of normal traffic so detection has to find the needle.

NOTE: these produce *synthetic telemetry describing* malicious behavior
(for testing the blue-team detector). They are not real attack tools.
"""
import random

# scenario key -> (anomaly categories it should trigger, human label)
SCENARIOS = {
    "data_exfiltration": (["data_exfiltration"], "Eksfiltrasi data besar ke tujuan eksternal"),
    "privilege_abuse":   (["privilege_abuse"], "Eskalasi/penyalahgunaan privilege"),
    "lateral_movement":  (["lateral_movement"], "Pergerakan lateral antar endpoint"),
    "logon_anomaly":     (["logon_anomaly"], "Login di luar jam / impossible travel"),
    "suspicious_process":(["suspicious_process"], "Eksekusi proses/command mencurigakan"),
    "mass_file_access":  (["mass_file_access"], "Akses/duplikasi file massal"),
    "usb_exfiltration":  (["usb_exfiltration", "data_exfiltration"], "Eksfiltrasi via media USB"),
    "config_tampering":  (["config_tampering"], "Perubahan konfigurasi di luar jendela maintenance"),
}

# Command/process indicators a rule engine will flag (detection signatures,
# not implementations).
SUSPICIOUS_COMMANDS = ["mimikatz", "rm -rf /", "dd if=/dev/zero", "nc -e",
                       "ncat --exec", "certutil -urlcache", "powershell -enc",
                       "wmic process call create", "psexec", "bloodhound"]


def apply_scenario(ev: dict, scenario: str) -> dict:
    """Mutate a normal event into an anomalous one for the given scenario."""
    cats, _label = SCENARIOS[scenario]
    ev["label_scenario"] = scenario

    if scenario == "data_exfiltration":
        ev["category"] = "network"
        ev["activity"] = "data_transfer"
        ev["egress_mb"] = round(random.uniform(600, 4000), 1)
        ev["dest_class"] = random.choice(["cloud_personal", "foreign"])
        ev["src_geo"] = random.choice(["ID-OFFICE", "SG-VPN"])

    elif scenario == "privilege_abuse":
        ev["category"] = "config"
        ev["activity"] = "privilege_escalation"
        ev["privilege_change"] = 1
        ev["command"] = random.choice(["usermod -aG sudo", "net localgroup administrators /add",
                                       "sudo -i", "Add-LocalGroupMember Administrators"])

    elif scenario == "lateral_movement":
        ev["category"] = "network"
        ev["activity"] = "remote_logon"
        ev["endpoints_touched"] = random.randint(40, 180)
        ev["command"] = random.choice(["psexec", "wmic process call create", "ssh pivot"])

    elif scenario == "logon_anomaly":
        ev["category"] = "logon"
        ev["activity"] = "interactive_logon"
        ev["login_hour"] = random.choice([1, 2, 3, 4])
        ev["src_geo"] = random.choice(["CN", "RU", "NL-VPN"])
        ev["src_ip"] = f"45.{random.randint(1,255)}.{random.randint(1,255)}.{random.randint(1,255)}"

    elif scenario == "suspicious_process":
        ev["category"] = "process"
        ev["activity"] = "process_launch"
        ev["command"] = random.choice(SUSPICIOUS_COMMANDS)
        ev["process_name"] = ev["command"].split()[0]

    elif scenario == "mass_file_access":
        ev["category"] = "file"
        ev["activity"] = "bulk_read"
        ev["files_accessed"] = random.randint(400, 3000)

    elif scenario == "usb_exfiltration":
        ev["category"] = "usb"
        ev["activity"] = "usb_write"
        ev["usb_event"] = 1
        ev["egress_mb"] = round(random.uniform(200, 2000), 1)
        ev["dest_class"] = "removable"

    elif scenario == "config_tampering":
        ev["category"] = "config"
        ev["activity"] = "config_change"
        ev["config_change"] = 1
        ev["login_hour"] = random.choice([0, 1, 2, 23])
        ev["command"] = random.choice(["iptables -F", "systemctl disable auditd",
                                        "reg delete HKLM\\...\\Audit", "crontab -e (backdoor)"])
    return ev

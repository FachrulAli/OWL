"""Entity roster + per-role normal behavior profiles.

Mirrors the Postgres seed (infra/postgres/init.sql). Each profile defines the
normal distribution of behavioral parameters used to synthesize realistic
"business as usual" telemetry so the UEBA baseline has something to learn.
"""

# entity_id, role, node_id, tier, os
ENTITIES = [
    ("usr-admin-01",   "admin_satsiber", "pusat",     0, "linux"),
    ("usr-admin-02",   "admin_satsiber", "pusat",     0, "windows"),
    ("usr-analyst-a1", "csirt_analyst",  "kodam-a",   1, "linux"),
    ("usr-analyst-a2", "csirt_analyst",  "kodam-a",   1, "linux"),
    ("usr-analyst-b1", "csirt_analyst",  "kodam-b",   1, "windows"),
    ("usr-lead-a",     "team_lead",      "kodam-a",   1, "windows"),
    ("usr-lead-c",     "team_lead",      "kodam-c",   1, "windows"),
    ("usr-op-a1",      "operator",       "satuan-a1", 2, "linux"),
    ("usr-op-b1",      "operator",       "satuan-b1", 2, "linux"),
    ("usr-op-c1",      "operator",       "satuan-c1", 2, "windows"),
    ("usr-cust-a1",    "data_custodian", "satuan-a1", 2, "linux"),
    ("usr-cust-c2",    "data_custodian", "satuan-c2", 2, "linux"),
    ("usr-personel-a1","personel",       "satuan-a1", 2, "windows"),
    ("usr-personel-a2","personel",       "satuan-a2", 2, "windows"),
    ("usr-personel-b1","personel",       "satuan-b1", 2, "windows"),
    ("usr-personel-c1","personel",       "satuan-c1", 2, "windows"),
    ("usr-auditor-01", "auditor",        "pusat",     0, "windows"),
]

# Normal-behavior profile per role.
# Values are (mean, std) unless noted. Used to sample per-event metrics.
ROLE_PROFILES = {
    "admin_satsiber": {
        "login_hours": (6, 20),          # normal working window
        "egress_mb": (8, 6),             # per active event
        "files_accessed": (6, 4),
        "endpoints_touched": (4, 3),
        "commands": ["systemctl", "kubectl", "ssh", "ansible", "grep", "tail",
                     "docker", "vault", "psql", "journalctl"],
        "processes": ["sshd", "bash", "ansible-playbook", "kubectl", "vault"],
        "privilege_rate": 0.0,
        "usb_rate": 0.0,
        "config_rate": 0.0,
    },
    "csirt_analyst": {
        "login_hours": (7, 21),
        "egress_mb": (4, 3),
        "files_accessed": (12, 6),
        "endpoints_touched": (14, 5),     # analysts touch many hosts (normal)
        "commands": ["volatility", "yara", "tshark", "grep", "jq", "curl",
                     "python", "zeek", "suricata-update"],
        "processes": ["python", "wireshark", "zeek", "chrome", "code"],
        "privilege_rate": 0.0,
        "usb_rate": 0.0,
        "config_rate": 0.0,
    },
    "team_lead": {
        "login_hours": (7, 19),
        "egress_mb": (3, 2),
        "files_accessed": (8, 4),
        "endpoints_touched": (3, 2),
        "commands": ["grep", "cat", "less", "git", "curl"],
        "processes": ["outlook", "chrome", "teams", "code"],
        "privilege_rate": 0.0,
        "usb_rate": 0.0,
        "config_rate": 0.0,
    },
    "operator": {
        "login_hours": (6, 18),
        "egress_mb": (2, 2),
        "files_accessed": (5, 3),
        "endpoints_touched": (6, 3),
        "commands": ["ping", "ip", "tcpdump", "systemctl", "nmap", "snmpwalk"],
        "processes": ["bash", "tcpdump", "zabbix_agentd", "sshd"],
        "privilege_rate": 0.0,
        "usb_rate": 0.0,
        "config_rate": 0.0,
    },
    "data_custodian": {
        "login_hours": (7, 20),
        "egress_mb": (10, 8),
        "files_accessed": (20, 10),
        "endpoints_touched": (4, 2),
        "commands": ["pg_dump", "rsync", "tar", "systemctl", "psql", "cron"],
        "processes": ["postgres", "pg_dump", "rsync", "sshd"],
        "privilege_rate": 0.0,
        "usb_rate": 0.0,
        "config_rate": 0.0,       # scheduled maintenance windows
    },
    "personel": {
        "login_hours": (7, 17),
        "egress_mb": (1, 1),
        "files_accessed": (10, 6),
        "endpoints_touched": (1, 1),
        "commands": ["explorer", "winword", "excel", "chrome"],
        "processes": ["explorer.exe", "winword.exe", "chrome.exe", "outlook.exe"],
        "privilege_rate": 0.0,
        "usb_rate": 0.0,
        "config_rate": 0.0,
    },
    "auditor": {
        "login_hours": (8, 17),
        "egress_mb": (2, 1),
        "files_accessed": (15, 8),
        "endpoints_touched": (5, 3),
        "commands": ["grep", "cat", "less", "auditctl", "ausearch"],
        "processes": ["chrome", "code", "python"],
        "privilege_rate": 0.0,
        "usb_rate": 0.0,
        "config_rate": 0.0,
    },
}

OFFICE_SUBNETS = ["10.21.", "10.22.", "10.23."]           # trusted ranges
FOREIGN_GEOS = ["CN", "RU", "SG-VPN", "NL-VPN", "US-CLOUD"]
NORMAL_GEO = "ID-OFFICE"

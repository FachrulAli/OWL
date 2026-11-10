"""Entity roster + per-role normal behavior profiles.

Mirrors the Postgres seed (infra/postgres/init.sql). Each profile defines the
normal distribution of behavioral parameters used to synthesize realistic
"business as usual" telemetry so the UEBA baseline has something to learn.
"""

# entity_id, role, node_id, tier, os
ENTITIES = [
    ("usr-admin-01", "admin_satsiber", "pusat", 0, "linux"),
    ("usr-admin-02", "admin_satsiber", "pusat", 0, "windows"),
    ("usr-auditor-01", "auditor", "pusat", 0, "windows"),
    ("usr-kodam-jaya", "operator", "kodam-jaya", 1, "linux"),
    ("usr-kodam-im", "csirt_analyst", "kodam-im", 1, "windows"),
    ("usr-kodam-1", "personel", "kodam-1", 1, "linux"),
    ("usr-kodam-2", "data_custodian", "kodam-2", 1, "windows"),
    ("usr-kodam-3", "team_lead", "kodam-3", 1, "linux"),
    ("usr-kodam-4", "operator", "kodam-4", 1, "windows"),
    ("usr-kodam-5", "csirt_analyst", "kodam-5", 1, "linux"),
    ("usr-kodam-6", "personel", "kodam-6", 1, "windows"),
    ("usr-kodam-9", "data_custodian", "kodam-9", 1, "linux"),
    ("usr-kodam-12", "team_lead", "kodam-12", 1, "windows"),
    ("usr-kodam-13", "operator", "kodam-13", 1, "linux"),
    ("usr-kodam-14", "operator", "kodam-14", 1, "windows"),
    ("usr-kodam-16", "personel", "kodam-16", 1, "linux"),
    ("usr-kodam-17", "personel", "kodam-17", 1, "windows"),
    ("usr-kodam-18", "team_lead", "kodam-18", 1, "linux"),
    ("usr-kodam-19", "operator", "kodam-19", 1, "windows"),
    ("usr-kodam-20", "csirt_analyst", "kodam-20", 1, "linux"),
    ("usr-kodam-21", "personel", "kodam-21", 1, "windows"),
    ("usr-kodam-22", "data_custodian", "kodam-22", 1, "linux"),
    ("usr-kodam-23", "team_lead", "kodam-23", 1, "windows"),
    ("usr-kodam-24", "operator", "kodam-24", 1, "linux"),
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

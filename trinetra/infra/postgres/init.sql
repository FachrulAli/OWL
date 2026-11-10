-- TRINETRA Postgres schema — identity/role registry, baselines meta, cases, feedback, orchestration tree

-- 3-tier orchestration topology (pusat -> kodam -> satuan)
CREATE TABLE IF NOT EXISTS nodes (
    node_id     TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    tier        SMALLINT NOT NULL,       -- 0 pusat, 1 kodam, 2 satuan
    parent_id   TEXT REFERENCES nodes(node_id),
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- Role catalog with risk weighting (§7, §11)
CREATE TABLE IF NOT EXISTS roles (
    role        TEXT PRIMARY KEY,
    label       TEXT NOT NULL,
    risk_level  TEXT NOT NULL,           -- low, medium, high, very_high
    base_weight REAL NOT NULL DEFAULT 1.0
);

-- Identity registry (AD/LDAP enrichment source)
CREATE TABLE IF NOT EXISTS entities (
    entity_id   TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    role        TEXT NOT NULL REFERENCES roles(role),
    node_id     TEXT NOT NULL REFERENCES nodes(node_id),
    enabled     BOOLEAN DEFAULT true,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- Role baseline parameters & thresholds (§11) — hybrid static/relative config
CREATE TABLE IF NOT EXISTS role_baselines (
    role        TEXT NOT NULL REFERENCES roles(role),
    parameter   TEXT NOT NULL,           -- egress_mb, files_accessed, login_hour, ...
    normal_low  REAL,
    normal_high REAL,
    static_crit REAL,                    -- absolute critical threshold
    rel_mult    REAL DEFAULT 5.0,        -- relative: x times rolling mean
    weight      REAL DEFAULT 1.0,
    PRIMARY KEY (role, parameter)
);

-- Live entity risk (decayed cumulative) — materialized here for fast dashboard reads
CREATE TABLE IF NOT EXISTS entity_risk (
    entity_id   TEXT PRIMARY KEY REFERENCES entities(entity_id),
    risk_score  REAL NOT NULL DEFAULT 0,
    last_event  TIMESTAMPTZ,
    updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Alerts / cases (§10.6 case management)
CREATE TABLE IF NOT EXISTS cases (
    case_id     BIGSERIAL PRIMARY KEY,
    entity_id   TEXT NOT NULL REFERENCES entities(entity_id),
    role        TEXT NOT NULL,
    node_id     TEXT NOT NULL,
    tier        SMALLINT NOT NULL,
    severity    TEXT NOT NULL,           -- low, medium, high, critical
    risk_score  REAL NOT NULL,
    categories  TEXT[] NOT NULL DEFAULT '{}',
    title       TEXT NOT NULL,
    summary     TEXT,
    status      TEXT NOT NULL DEFAULT 'open',  -- open, investigating, escalated, closed
    verdict     TEXT,                    -- true_positive, false_positive, null
    assignee    TEXT,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Analyst feedback → ML tuning loop (§9.1)
CREATE TABLE IF NOT EXISTS feedback (
    feedback_id BIGSERIAL PRIMARY KEY,
    case_id     BIGINT REFERENCES cases(case_id),
    entity_id   TEXT NOT NULL,
    verdict     TEXT NOT NULL,           -- true_positive, false_positive
    note        TEXT,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- Cross-node correlation findings (§8 Tier 0 korelasi)
CREATE TABLE IF NOT EXISTS correlations (
    corr_id     BIGSERIAL PRIMARY KEY,
    pattern     TEXT NOT NULL,
    entity_ids  TEXT[] NOT NULL,
    node_ids    TEXT[] NOT NULL,
    score       REAL NOT NULL,
    summary     TEXT,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================ SEED DATA ============================

INSERT INTO roles (role, label, risk_level, base_weight) VALUES
    ('admin_satsiber', 'Super Admin Satsiber (Pusat)', 'very_high', 1.5),
    ('csirt_analyst',  'CSIRT Analyst (Kartika/Kodam)', 'high', 1.3),
    ('team_lead',      'CSIRT Team Lead / Komandan', 'high', 1.2),
    ('operator',       'Network/Security Operator (Satuan)', 'medium', 1.0),
    ('data_custodian', 'Server/Data Custodian', 'high', 1.3),
    ('personel',       'Personel Satuan (End User)', 'medium', 0.9),
    ('auditor',        'Auditor / Inspektor', 'medium', 1.0)
ON CONFLICT DO NOTHING;

-- National orchestration tree: Pusat (Mabes TNI AD/Pussiberad) + 21 Kodam
-- (15 lama + 6 baru XIX-XXIV per Agustus 2025), each at its real HQ city.
INSERT INTO nodes (node_id, name, tier, parent_id) VALUES
    ('pusat', 'Mabes TNI AD / Pussiberad', 0, NULL)
ON CONFLICT DO NOTHING;
INSERT INTO nodes (node_id, name, tier, parent_id) VALUES
    ('kodam-jaya', 'Kodam Jaya / Jayakarta', 1, 'pusat'),
    ('kodam-im', 'Kodam Iskandar Muda', 1, 'pusat'),
    ('kodam-1', 'Kodam I / Bukit Barisan', 1, 'pusat'),
    ('kodam-2', 'Kodam II / Sriwijaya', 1, 'pusat'),
    ('kodam-3', 'Kodam III / Siliwangi', 1, 'pusat'),
    ('kodam-4', 'Kodam IV / Diponegoro', 1, 'pusat'),
    ('kodam-5', 'Kodam V / Brawijaya', 1, 'pusat'),
    ('kodam-6', 'Kodam VI / Mulawarman', 1, 'pusat'),
    ('kodam-9', 'Kodam IX / Udayana', 1, 'pusat'),
    ('kodam-12', 'Kodam XII / Tanjungpura', 1, 'pusat'),
    ('kodam-13', 'Kodam XIII / Merdeka', 1, 'pusat'),
    ('kodam-14', 'Kodam XIV / Hasanuddin', 1, 'pusat'),
    ('kodam-16', 'Kodam XVI / Pattimura', 1, 'pusat'),
    ('kodam-17', 'Kodam XVII / Cenderawasih', 1, 'pusat'),
    ('kodam-18', 'Kodam XVIII / Kasuari', 1, 'pusat'),
    ('kodam-19', 'Kodam XIX / Tuanku Tambusai', 1, 'pusat'),
    ('kodam-20', 'Kodam XX / Tuanku Imam Bonjol', 1, 'pusat'),
    ('kodam-21', 'Kodam XXI / Radin Inten', 1, 'pusat'),
    ('kodam-22', 'Kodam XXII / Tambun Bungai', 1, 'pusat'),
    ('kodam-23', 'Kodam XXIII / Palaka Wira', 1, 'pusat'),
    ('kodam-24', 'Kodam XXIV / Mandala Trikora', 1, 'pusat')
ON CONFLICT DO NOTHING;

-- Role baseline thresholds (§11.2)
INSERT INTO role_baselines (role, parameter, normal_low, normal_high, static_crit, rel_mult, weight) VALUES
    ('admin_satsiber', 'egress_mb',        0,   100,  500,  5,  1.4),
    ('admin_satsiber', 'login_hour',       6,   20,   NULL, 0,  0.8),
    ('admin_satsiber', 'privilege_change', 0,   2,    5,    3,  1.2),
    ('csirt_analyst',  'endpoints_touched',10,  20,   100,  4,  1.2),
    ('csirt_analyst',  'egress_mb',        0,   50,   300,  5,  1.0),
    ('operator',       'login_hour',       6,   18,   NULL, 0,  1.0),
    ('operator',       'egress_mb',        0,   30,   200,  5,  1.0),
    ('data_custodian', 'config_change',    0,   3,    10,   3,  1.3),
    ('personel',       'files_accessed',   0,   50,   500,  6,  1.1),
    ('personel',       'usb_event',        0,   0,    1,    1,  1.4),
    ('personel',       'egress_mb',        0,   20,   150,  5,  1.0)
ON CONFLICT DO NOTHING;

-- Entities (one+ per role across nodes)
INSERT INTO entities (entity_id, display_name, role, node_id) VALUES
    ('usr-admin-01', 'Admin Pusat 01', 'admin_satsiber', 'pusat'),
    ('usr-admin-02', 'Admin Pusat 02', 'admin_satsiber', 'pusat'),
    ('usr-auditor-01', 'Auditor Pusat', 'auditor', 'pusat'),
    ('usr-kodam-jaya', 'Operator Jakarta', 'operator', 'kodam-jaya'),
    ('usr-kodam-im', 'Analis CSIRT Banda Aceh', 'csirt_analyst', 'kodam-im'),
    ('usr-kodam-1', 'Personel Medan', 'personel', 'kodam-1'),
    ('usr-kodam-2', 'Custodian Palembang', 'data_custodian', 'kodam-2'),
    ('usr-kodam-3', 'Komandan Bandung', 'team_lead', 'kodam-3'),
    ('usr-kodam-4', 'Operator Semarang', 'operator', 'kodam-4'),
    ('usr-kodam-5', 'Analis CSIRT Surabaya', 'csirt_analyst', 'kodam-5'),
    ('usr-kodam-6', 'Personel Balikpapan', 'personel', 'kodam-6'),
    ('usr-kodam-9', 'Custodian Denpasar', 'data_custodian', 'kodam-9'),
    ('usr-kodam-12', 'Komandan Pontianak', 'team_lead', 'kodam-12'),
    ('usr-kodam-13', 'Operator Manado', 'operator', 'kodam-13'),
    ('usr-kodam-14', 'Operator Makassar', 'operator', 'kodam-14'),
    ('usr-kodam-16', 'Personel Ambon', 'personel', 'kodam-16'),
    ('usr-kodam-17', 'Personel Jayapura', 'personel', 'kodam-17'),
    ('usr-kodam-18', 'Komandan Manokwari', 'team_lead', 'kodam-18'),
    ('usr-kodam-19', 'Operator Pekanbaru', 'operator', 'kodam-19'),
    ('usr-kodam-20', 'Analis CSIRT Padang', 'csirt_analyst', 'kodam-20'),
    ('usr-kodam-21', 'Personel Bandar Lampung', 'personel', 'kodam-21'),
    ('usr-kodam-22', 'Custodian Palangka Raya', 'data_custodian', 'kodam-22'),
    ('usr-kodam-23', 'Komandan Palu', 'team_lead', 'kodam-23'),
    ('usr-kodam-24', 'Operator Merauke', 'operator', 'kodam-24')
ON CONFLICT DO NOTHING;

INSERT INTO entity_risk (entity_id, risk_score)
    SELECT entity_id, 0 FROM entities ON CONFLICT DO NOTHING;

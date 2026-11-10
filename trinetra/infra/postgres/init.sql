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

-- Orchestration tree: 1 pusat, 3 kodam, 5 satuan
INSERT INTO nodes (node_id, name, tier, parent_id) VALUES
    ('pusat',   'Satsiber TNI AD / Pussiberad (Kartika CSIRT)', 0, NULL)
ON CONFLICT DO NOTHING;
INSERT INTO nodes (node_id, name, tier, parent_id) VALUES
    ('kodam-a', 'Kodam III / Siliwangi', 1, 'pusat'),
    ('kodam-b', 'Kodam V / Brawijaya', 1, 'pusat'),
    ('kodam-c', 'Kodam XIV / Hasanuddin', 1, 'pusat')
ON CONFLICT DO NOTHING;
INSERT INTO nodes (node_id, name, tier, parent_id) VALUES
    ('satuan-a1', 'Satuan Bekasi', 2, 'kodam-a'),
    ('satuan-a2', 'Satuan Cirebon', 2, 'kodam-a'),
    ('satuan-b1', 'Satuan Semarang', 2, 'kodam-b'),
    ('satuan-c1', 'Satuan Gowa', 2, 'kodam-c'),
    ('satuan-c2', 'Satuan Mamuju', 2, 'kodam-c')
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
    ('usr-admin-01',  'Admin Pusat 01',       'admin_satsiber', 'pusat'),
    ('usr-admin-02',  'Admin Pusat 02',       'admin_satsiber', 'pusat'),
    ('usr-analyst-a1','Analis Kodam A 01',     'csirt_analyst',  'kodam-a'),
    ('usr-analyst-a2','Analis Kodam A 02',     'csirt_analyst',  'kodam-a'),
    ('usr-analyst-b1','Analis Kodam B 01',     'csirt_analyst',  'kodam-b'),
    ('usr-lead-a',    'Komandan CSIRT Kodam A','team_lead',      'kodam-a'),
    ('usr-lead-c',    'Komandan CSIRT Kodam C','team_lead',      'kodam-c'),
    ('usr-op-a1',     'Operator Satuan A1',    'operator',       'satuan-a1'),
    ('usr-op-b1',     'Operator Satuan B1',    'operator',       'satuan-b1'),
    ('usr-op-c1',     'Operator Satuan C1',    'operator',       'satuan-c1'),
    ('usr-cust-a1',   'Custodian Satuan A1',   'data_custodian', 'satuan-a1'),
    ('usr-cust-c2',   'Custodian Satuan C2',   'data_custodian', 'satuan-c2'),
    ('usr-personel-a1','Personel Satuan A1',   'personel',       'satuan-a1'),
    ('usr-personel-a2','Personel Satuan A2',   'personel',       'satuan-a2'),
    ('usr-personel-b1','Personel Satuan B1',   'personel',       'satuan-b1'),
    ('usr-personel-c1','Personel Satuan C1',   'personel',       'satuan-c1'),
    ('usr-auditor-01','Auditor Pusat',         'auditor',        'pusat')
ON CONFLICT DO NOTHING;

INSERT INTO entity_risk (entity_id, risk_score)
    SELECT entity_id, 0 FROM entities ON CONFLICT DO NOTHING;

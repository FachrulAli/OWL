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

-- ====================================================================
-- Domain MOBILE (MTD): pangkat/jabatan, roster HP dinas, baseline HP.
-- Satu 'entity' = satu HP dinas yang dipegang satu personel.
-- ====================================================================
INSERT INTO roles (role, label, risk_level, base_weight) VALUES
    ('pati', 'Perwira Tinggi / Pangdam', 'very_high', 1.6),
    ('pamen_intel', 'Pamen Intelijen', 'very_high', 1.5),
    ('ajudan', 'Ajudan Pimpinan', 'high', 1.4),
    ('pamen_ops', 'Pamen Operasi', 'high', 1.2),
    ('pama_siber', 'Pama Satuan Siber', 'medium', 1.0),
    ('bintara_komlek', 'Bintara Komlek', 'medium', 1.0),
    ('prajurit', 'Prajurit', 'low', 0.8)
ON CONFLICT (role) DO NOTHING;

INSERT INTO entities (entity_id, display_name, role, node_id) VALUES
    ('hp-pusat-pangti', 'Pangdam · iPhone 15 Pro (IOS 17.5.1)', 'pati', 'pusat'),
    ('hp-pusat-intel', 'Pamen Intel · Samsung S24 (ANDROID 14)', 'pamen_intel', 'pusat'),
    ('hp-pusat-siber', 'Pama Siber · Pixel 8 (ANDROID 15)', 'pama_siber', 'pusat'),
    ('hp-pusat-ajudan', 'Ajudan · iPhone 13 (IOS 16.7.8)', 'ajudan', 'pusat'),
    ('hp-kodam-jaya-01', 'Pangdam · iPhone 15 (IOS 17.4)', 'pati', 'kodam-jaya'),
    ('hp-kodam-jaya-02', 'Pamen Intel · Samsung S23 (ANDROID 14)', 'pamen_intel', 'kodam-jaya'),
    ('hp-kodam-im-01', 'Pamen Ops · Oppo Reno 10 (ANDROID 13)', 'pamen_ops', 'kodam-im'),
    ('hp-kodam-1-01', 'Pamen Intel · Samsung A54 (ANDROID 14)', 'pamen_intel', 'kodam-1'),
    ('hp-kodam-2-01', 'Ba Komlek · Xiaomi Redmi 12 (ANDROID 12)', 'bintara_komlek', 'kodam-2'),
    ('hp-kodam-3-01', 'Pangdam · iPhone 14 Pro (IOS 17.5)', 'pati', 'kodam-3'),
    ('hp-kodam-4-01', 'Prajurit · Vivo Y27 (ANDROID 13)', 'prajurit', 'kodam-4'),
    ('hp-kodam-5-01', 'Pamen Intel · iPhone 13 Pro (IOS 16.6)', 'pamen_intel', 'kodam-5'),
    ('hp-kodam-5-02', 'Prajurit · Samsung A34 (ANDROID 14)', 'prajurit', 'kodam-5'),
    ('hp-kodam-6-01', 'Pamen Ops · Pixel 7a (ANDROID 14)', 'pamen_ops', 'kodam-6'),
    ('hp-kodam-9-01', 'Ba Komlek · Samsung A24 (ANDROID 13)', 'bintara_komlek', 'kodam-9'),
    ('hp-kodam-12-01', 'Prajurit · Realme C55 (ANDROID 12)', 'prajurit', 'kodam-12'),
    ('hp-kodam-13-01', 'Pamen Ops · Samsung S22 (ANDROID 14)', 'pamen_ops', 'kodam-13'),
    ('hp-kodam-14-01', 'Pamen Intel · Pixel 8 Pro (ANDROID 15)', 'pamen_intel', 'kodam-14'),
    ('hp-kodam-16-01', 'Prajurit · Infinix Note 30 (ANDROID 13)', 'prajurit', 'kodam-16'),
    ('hp-kodam-17-01', 'Pamen Intel · Samsung S23 FE (ANDROID 14)', 'pamen_intel', 'kodam-17'),
    ('hp-kodam-17-02', 'Ba Komlek · Xiaomi Poco M5 (ANDROID 12)', 'bintara_komlek', 'kodam-17'),
    ('hp-kodam-18-01', 'Prajurit · Oppo A78 (ANDROID 13)', 'prajurit', 'kodam-18'),
    ('hp-kodam-19-01', 'Pamen Ops · Samsung A55 (ANDROID 14)', 'pamen_ops', 'kodam-19'),
    ('hp-kodam-20-01', 'Prajurit · Vivo Y36 (ANDROID 13)', 'prajurit', 'kodam-20'),
    ('hp-kodam-21-01', 'Ba Komlek · Redmi Note 12 (ANDROID 12)', 'bintara_komlek', 'kodam-21'),
    ('hp-kodam-22-01', 'Prajurit · Samsung A15 (ANDROID 14)', 'prajurit', 'kodam-22'),
    ('hp-kodam-23-01', 'Pamen Ops · Pixel 7 (ANDROID 14)', 'pamen_ops', 'kodam-23'),
    ('hp-kodam-24-01', 'Pamen Intel · iPhone 14 (IOS 17.2)', 'pamen_intel', 'kodam-24'),
    ('hp-kodam-24-02', 'Prajurit · Itel P55 (ANDROID 13)', 'prajurit', 'kodam-24')
ON CONFLICT (entity_id) DO NOTHING;

-- Ambang baseline per pangkat untuk parameter MOBILE.
INSERT INTO role_baselines (role, parameter, normal_low, normal_high, static_crit, rel_mult, weight) VALUES
    ('pati', 'egress_mb', 0, 4.6, 10.2, 5, 1.2),
    ('pati', 'idle_egress_mb', 0, 1.8, 8, 4, 1.4),
    ('pati', 'thermal_state', 0, 2, 3, 2, 1.0),
    ('pati', 'battery_drop_pct', 0, 2.1, 4, 3, 1.1),
    ('pati', 'cpu_pct', 0, 32, 70, 3, 0.9),
    ('pati', 'crash_count', 0, 1, 2, 2, 1.3),
    ('pamen_intel', 'egress_mb', 0, 8.4, 18.8, 5, 1.2),
    ('pamen_intel', 'idle_egress_mb', 0, 3.2, 8, 4, 1.4),
    ('pamen_intel', 'thermal_state', 0, 2, 3, 2, 1.0),
    ('pamen_intel', 'battery_drop_pct', 0, 2.6, 4, 3, 1.1),
    ('pamen_intel', 'cpu_pct', 0, 38, 70, 3, 0.9),
    ('pamen_intel', 'crash_count', 0, 1, 2, 2, 1.3),
    ('pamen_ops', 'egress_mb', 0, 3.6, 8.0, 5, 1.2),
    ('pamen_ops', 'idle_egress_mb', 0, 1.4, 8, 4, 1.4),
    ('pamen_ops', 'thermal_state', 0, 2, 3, 2, 1.0),
    ('pamen_ops', 'battery_drop_pct', 0, 2.2, 4, 3, 1.1),
    ('pamen_ops', 'cpu_pct', 0, 31, 70, 3, 0.9),
    ('pamen_ops', 'crash_count', 0, 1, 2, 2, 1.3),
    ('pama_siber', 'egress_mb', 0, 13.5, 29.5, 5, 1.2),
    ('pama_siber', 'idle_egress_mb', 0, 5.5, 8, 4, 1.4),
    ('pama_siber', 'thermal_state', 0, 2, 3, 2, 1.0),
    ('pama_siber', 'battery_drop_pct', 0, 3.8, 4, 3, 1.1),
    ('pama_siber', 'cpu_pct', 0, 56, 70, 3, 0.9),
    ('pama_siber', 'crash_count', 0, 1, 2, 2, 1.3),
    ('bintara_komlek', 'egress_mb', 0, 2.6, 8.0, 5, 1.2),
    ('bintara_komlek', 'idle_egress_mb', 0, 1.0, 8, 4, 1.4),
    ('bintara_komlek', 'thermal_state', 0, 2, 3, 2, 1.0),
    ('bintara_komlek', 'battery_drop_pct', 0, 1.9, 4, 3, 1.1),
    ('bintara_komlek', 'cpu_pct', 0, 26, 70, 3, 0.9),
    ('bintara_komlek', 'crash_count', 0, 1, 2, 2, 1.3),
    ('ajudan', 'egress_mb', 0, 3.0, 8.0, 5, 1.2),
    ('ajudan', 'idle_egress_mb', 0, 1.2, 8, 4, 1.4),
    ('ajudan', 'thermal_state', 0, 2, 3, 2, 1.0),
    ('ajudan', 'battery_drop_pct', 0, 2.3, 4, 3, 1.1),
    ('ajudan', 'cpu_pct', 0, 29, 70, 3, 0.9),
    ('ajudan', 'crash_count', 0, 1, 2, 2, 1.3),
    ('prajurit', 'egress_mb', 0, 1.9, 8.0, 5, 1.2),
    ('prajurit', 'idle_egress_mb', 0, 0.7, 8, 4, 1.4),
    ('prajurit', 'thermal_state', 0, 2, 3, 2, 1.0),
    ('prajurit', 'battery_drop_pct', 0, 2.9, 4, 3, 1.1),
    ('prajurit', 'cpu_pct', 0, 34, 70, 3, 0.9),
    ('prajurit', 'crash_count', 0, 1, 2, 2, 1.3)
ON CONFLICT (role, parameter) DO NOTHING;

INSERT INTO entity_risk (entity_id, risk_score)
SELECT entity_id, 0 FROM entities ON CONFLICT (entity_id) DO NOTHING;

-- Perangkat UJI LAPANGAN: satu-satunya entity yang datanya datang dari agent
-- MTD nyata di perangkat Android, bukan dari simulator. Sengaja dipisah agar
-- pada dashboard jelas mana telemetri sungguhan dan mana yang disimulasikan;
-- label_scenario pada event dari agent bernilai 'live_agent'.
INSERT INTO entities (entity_id, display_name, role, node_id) VALUES
    ('hp-uji-01', 'Pama Siber · HP Uji Lapangan (agent nyata)', 'pama_siber', 'kodam-jaya')
ON CONFLICT (entity_id) DO NOTHING;
INSERT INTO entity_risk (entity_id, risk_score) VALUES ('hp-uji-01', 0)
ON CONFLICT (entity_id) DO NOTHING;

-- ====================================================================
-- Identitas PEMEGANG perangkat, dipisah dari identitas perangkat.
--
-- Alasan pemisahan: `display_name` sebelumnya mencampur orang dan HP dalam
-- satu teks ("Pangdam · iPhone 15 Pro"), sehingga operator tidak bisa
-- menjawab dua pertanyaan berbeda yang sama pentingnya: SIAPA yang harus
-- dihubungi, dan PERANGKAT APA yang harus ditangani.
--
-- Spesifikasi perangkat (model, OS, umur patch) sengaja TIDAK disimpan di
-- sini: itu diambil dari telemetri terakhir yang benar-benar diterima. Yang
-- didaftarkan bisa usang atau salah; yang terbaca adalah kenyataan.
--
-- SELURUH NAMA DI BAWAH INI FIKTIF dan ditandai demikian di antarmuka.
-- ====================================================================
ALTER TABLE entities ADD COLUMN IF NOT EXISTS holder_rank TEXT;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS holder_name TEXT;
ALTER TABLE entities ADD COLUMN IF NOT EXISTS holder_nrp  TEXT;

UPDATE entities e SET
    holder_rank = v.rank, holder_name = v.nama, holder_nrp = v.nrp
FROM (VALUES
    ('hp-pusat-pangti', 'Mayjen TNI', 'Bagas Pratama', '11930000'),
    ('hp-pusat-intel', 'Kolonel Inf', 'Rizal Nugroho', '11931373'),
    ('hp-pusat-siber', 'Kapten Ctp', 'Dimas Saputra', '11932746'),
    ('hp-pusat-ajudan', 'Lettu Inf', 'Arif Wibowo', '11934119'),
    ('hp-kodam-jaya-01', 'Mayjen TNI', 'Yoga Permana', '11935492'),
    ('hp-kodam-jaya-02', 'Kolonel Inf', 'Teguh Santoso', '11936865'),
    ('hp-kodam-im-01', 'Letkol Inf', 'Hendra Kusuma', '11938238'),
    ('hp-kodam-1-01', 'Kolonel Inf', 'Fajar Maulana', '11939611'),
    ('hp-kodam-2-01', 'Serka', 'Galih Prasetyo', '11940984'),
    ('hp-kodam-3-01', 'Mayjen TNI', 'Bayu Anggara', '11942357'),
    ('hp-kodam-4-01', 'Praka', 'Reza Mahendra', '11943730'),
    ('hp-kodam-5-01', 'Kolonel Inf', 'Andi Firmansyah', '11945103'),
    ('hp-kodam-5-02', 'Praka', 'Wahyu Setiawan', '11946476'),
    ('hp-kodam-6-01', 'Letkol Inf', 'Eko Purnomo', '11947849'),
    ('hp-kodam-9-01', 'Serka', 'Iqbal Ramadhan', '11949222'),
    ('hp-kodam-12-01', 'Praka', 'Satria Hutama', '11950595'),
    ('hp-kodam-13-01', 'Letkol Inf', 'Gilang Aditya', '11951968'),
    ('hp-kodam-14-01', 'Kolonel Inf', 'Doni Hermawan', '11953341'),
    ('hp-kodam-16-01', 'Praka', 'Panji Nugraha', '11954714'),
    ('hp-kodam-17-01', 'Kolonel Inf', 'Krisna Wijaya', '11956087'),
    ('hp-kodam-17-02', 'Serka', 'Agus Riyanto', '11957460'),
    ('hp-kodam-18-01', 'Praka', 'Beni Saputro', '11958833'),
    ('hp-kodam-19-01', 'Letkol Inf', 'Candra Dwi', '11960206'),
    ('hp-kodam-20-01', 'Praka', 'Dedi Kurnia', '11961579'),
    ('hp-kodam-21-01', 'Serka', 'Erlangga Putra', '11962952'),
    ('hp-kodam-22-01', 'Praka', 'Faisal Rahman', '11964325'),
    ('hp-kodam-23-01', 'Letkol Inf', 'Gunawan Adi', '11965698'),
    ('hp-kodam-24-01', 'Kolonel Inf', 'Hadi Susanto', '11967071'),
    ('hp-kodam-24-02', 'Praka', 'Irfan Maulidi', '11968444'),
    ('hp-uji-01', 'Kapten Ctp', 'Perangkat Uji Lapangan', '11000001')
) AS v(entity_id, rank, nama, nrp)
WHERE e.entity_id = v.entity_id;

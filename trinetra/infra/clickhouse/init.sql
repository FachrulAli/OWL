-- TRINETRA ClickHouse schema — telemetry time-series + risk scores
-- Events are stored post-normalization (OCSF-aligned) for fast analytical queries.

CREATE DATABASE IF NOT EXISTS trinetra;

-- Normalized telemetry events (OCSF-aligned subset)
CREATE TABLE IF NOT EXISTS trinetra.events
(
    event_id        UUID,
    ts              DateTime64(3),
    tier            UInt8,                -- 0 pusat, 1 kodam, 2 satuan
    node_id         LowCardinality(String),   -- e.g. kodam-a
    unit_id         LowCardinality(String),   -- e.g. satuan-a1
    entity_id       LowCardinality(String),   -- user/account id
    role            LowCardinality(String),   -- csirt_analyst, admin_satsiber, ...
    endpoint_id     LowCardinality(String),
    os              LowCardinality(String),
    category        LowCardinality(String),   -- ocsf class group: process, file, network, logon, usb, config
    activity        LowCardinality(String),   -- specific activity
    -- behavioral metrics (per-event contribution to baselines)
    egress_mb       Float64 DEFAULT 0,
    dest_class      LowCardinality(String) DEFAULT 'internal', -- internal, cloud_personal, foreign
    files_accessed  UInt32 DEFAULT 0,
    endpoints_touched UInt32 DEFAULT 0,
    usb_event       UInt8 DEFAULT 0,
    privilege_change UInt8 DEFAULT 0,
    config_change   UInt8 DEFAULT 0,
    login_hour      UInt8 DEFAULT 0,
    src_ip          String DEFAULT '',
    src_geo         LowCardinality(String) DEFAULT '',
    command         String DEFAULT '',
    process_name    String DEFAULT '',
    raw             String DEFAULT '',        -- original event json
    -- ====== domain MOBILE (MTD / zero-click) ======
    domain          LowCardinality(String) DEFAULT 'endpoint',  -- endpoint | mobile
    platform        LowCardinality(String) DEFAULT '',          -- android | ios
    os_version      LowCardinality(String) DEFAULT '',
    device_model    LowCardinality(String) DEFAULT '',
    -- konteks interaksi: inti pembeda zero-click dari aktivitas sah
    screen_on       UInt8 DEFAULT 0,
    user_interaction UInt8 DEFAULT 0,
    idle            UInt8 DEFAULT 0,
    foreground_app  String DEFAULT '',
    -- jaringan
    ingress_mb      Float64 DEFAULT 0,
    dest_asn        LowCardinality(String) DEFAULT '',
    dest_ip         String DEFAULT '',
    dns_domain      String DEFAULT '',
    beacon_interval_s UInt32 DEFAULT 0,
    tls_mitm        UInt8 DEFAULT 0,
    ioc_match       String DEFAULT '',          -- indikator STIX2 yang cocok
    -- daya & beban
    thermal_state   UInt8 DEFAULT 0,
    battery_drop_pct Float64 DEFAULT 0,
    cpu_pct         Float64 DEFAULT 0,
    charging        UInt8 DEFAULT 0,
    -- pesan masuk (METADATA saja; tidak ada isi pesan di skema ini)
    inbound_msg     UInt8 DEFAULT 0,
    sender_known    UInt8 DEFAULT 1,
    notified        UInt8 DEFAULT 1,
    msg_app         LowCardinality(String) DEFAULT '',
    msg_has_attachment UInt8 DEFAULT 0,
    msg_binary      UInt8 DEFAULT 0,
    -- sensor
    mic_active      UInt8 DEFAULT 0,
    cam_active      UInt8 DEFAULT 0,
    -- proses
    crash_proc      String DEFAULT '',
    crash_count     UInt32 DEFAULT 0,
    crash_reason    LowCardinality(String) DEFAULT '',
    -- aplikasi
    pkg_added       UInt8 DEFAULT 0,
    pkg_name        String DEFAULT '',
    pkg_sha256      String DEFAULT '',
    pkg_hidden      UInt8 DEFAULT 0,
    installer_source LowCardinality(String) DEFAULT '',
    perm_sensitive  UInt8 DEFAULT 0,
    accessibility_granted UInt8 DEFAULT 0,
    device_admin_granted UInt8 DEFAULT 0,
    -- integritas perangkat
    integrity_fail  UInt8 DEFAULT 0,
    profile_added   UInt8 DEFAULT 0,
    profile_trusted UInt8 DEFAULT 1,
    tamper_detail   LowCardinality(String) DEFAULT '',
    patch_age_days  UInt32 DEFAULT 0,
    -- radio seluler
    net_gen         LowCardinality(String) DEFAULT '',
    cell_unknown    UInt8 DEFAULT 0,
    cell_encryption UInt8 DEFAULT 1,
    radio_anomaly   UInt8 DEFAULT 0,
    -- field turunan yang dipakai aturan Sigma
    silent_inbound  UInt8 DEFAULT 0,
    parser_crash    UInt8 DEFAULT 0,
    covert_sensor   UInt8 DEFAULT 0,
    idle_thermal    UInt8 DEFAULT 0,
    sideloaded      UInt8 DEFAULT 0,
    idle_egress_mb  Float64 DEFAULT 0,
    -- korelasi rantai (untuk timeline kill-chain di dashboard)
    chain_id        String DEFAULT '',
    chain_stage     LowCardinality(String) DEFAULT '',
    chain_step      UInt8 DEFAULT 0,
    chain_len       UInt8 DEFAULT 0,
    -- labels (for demo/eval only — ground truth of injected scenarios)
    label_scenario  LowCardinality(String) DEFAULT 'normal'
)
ENGINE = MergeTree
PARTITION BY toYYYYMMDD(ts)
ORDER BY (tier, node_id, entity_id, ts);

-- Per-evaluation risk score snapshots (one row per scored event that produced a signal)
CREATE TABLE IF NOT EXISTS trinetra.risk_scores
(
    score_id        UUID,
    ts              DateTime64(3),
    entity_id       LowCardinality(String),
    role            LowCardinality(String),
    tier            UInt8,
    node_id         LowCardinality(String),
    risk_score      Float64,              -- 0..100 (entity cumulative at time of event)
    event_score     Float64,              -- 0..100 contribution of this event
    rule_signals    UInt32 DEFAULT 0,
    ml_anomaly      Float64 DEFAULT 0,    -- 0..1 anomaly score from UEBA
    categories      Array(String),        -- anomaly categories matched
    contributors    String DEFAULT '',    -- json: weighted contributor breakdown
    event_id        UUID
)
ENGINE = MergeTree
PARTITION BY toYYYYMMDD(ts)
ORDER BY (entity_id, ts);

-- Aggregated per-entity-per-role feature rows used to train/update baselines
CREATE TABLE IF NOT EXISTS trinetra.entity_features
(
    bucket_ts       DateTime,             -- hourly bucket
    entity_id       LowCardinality(String),
    role            LowCardinality(String),
    egress_mb       Float64,
    files_accessed  UInt32,
    endpoints_touched UInt32,
    usb_events      UInt32,
    privilege_changes UInt32,
    off_hours_logins UInt32,
    foreign_dest    UInt32,
    event_count     UInt32
)
ENGINE = SummingMergeTree
PARTITION BY toYYYYMM(bucket_ts)
ORDER BY (role, entity_id, bucket_ts);

-- Korelasi kill-chain yang dinyalakan engine Sigma (temporal_ordered dkk).
-- Satu baris = satu rantai utuh yang terbukti, bukan satu indikator lepas.
CREATE TABLE IF NOT EXISTS trinetra.chain_hits
(
    hit_id          UUID,
    ts              DateTime64(3),
    entity_id       LowCardinality(String),
    node_id         LowCardinality(String),
    tier            UInt8,
    corr_id         LowCardinality(String),   -- mis. corr_zeroclick_fullchain
    corr_type       LowCardinality(String),   -- temporal_ordered | temporal | event_count
    title           String,
    category        LowCardinality(String),
    severity        Float64,
    level           LowCardinality(String),
    response        LowCardinality(String),   -- isolate | quarantine | investigate | patch
    span_s          Float64,                  -- rentang waktu rantai (detik)
    timespan_s      UInt32,                   -- jendela aturan
    kill_chain      Array(String),
    mitre           Array(String),
    members         String DEFAULT ''         -- json: tahap + event_id + waktu
)
ENGINE = MergeTree
PARTITION BY toYYYYMMDD(ts)
ORDER BY (entity_id, ts);

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

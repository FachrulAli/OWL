import os


class Settings:
    KAFKA_BOOTSTRAP = os.getenv("KAFKA_BOOTSTRAP", "localhost:9092")
    TOPIC_RAW = os.getenv("TOPIC_RAW", "trinetra.telemetry.raw")
    CONSUMER_GROUP = os.getenv("CONSUMER_GROUP", "trinetra-backend")

    PG_DSN = os.getenv("PG_DSN", "postgresql://trinetra:trinetra@localhost:5432/trinetra")

    CLICKHOUSE_HOST = os.getenv("CLICKHOUSE_HOST", "localhost")
    CLICKHOUSE_PORT = int(os.getenv("CLICKHOUSE_PORT", "8123"))
    CLICKHOUSE_USER = os.getenv("CLICKHOUSE_USER", "trinetra")
    CLICKHOUSE_PASSWORD = os.getenv("CLICKHOUSE_PASSWORD", "trinetra")
    CLICKHOUSE_DB = os.getenv("CLICKHOUSE_DB", "trinetra")

    ML_URL = os.getenv("ML_URL", "http://localhost:8001")

    # risk scoring
    ALERT_THRESHOLD = float(os.getenv("ALERT_THRESHOLD", "50"))     # entity risk -> open case
    CRITICAL_THRESHOLD = float(os.getenv("CRITICAL_THRESHOLD", "70"))
    DECAY_HALF_LIFE_MIN = float(os.getenv("DECAY_HALF_LIFE_MIN", "180"))  # risk half-life

    # batching
    CH_FLUSH_EVENTS = int(os.getenv("CH_FLUSH_EVENTS", "200"))
    CH_FLUSH_SECONDS = float(os.getenv("CH_FLUSH_SECONDS", "2.0"))


settings = Settings()

"""Database clients: Postgres (asyncpg pool) + ClickHouse (clickhouse-connect).

ClickHouse calls are synchronous under the hood; we run them in a thread via
asyncio.to_thread so they don't block the event loop.
"""
import asyncio

import asyncpg
import clickhouse_connect

from .config import settings

_pg_pool: asyncpg.Pool | None = None
_ch_client = None


async def init_pg(retries: int = 30) -> asyncpg.Pool:
    global _pg_pool
    last = None
    for _ in range(retries):
        try:
            _pg_pool = await asyncpg.create_pool(settings.PG_DSN, min_size=2, max_size=10)
            return _pg_pool
        except Exception as e:  # wait for postgres to be ready
            last = e
            await asyncio.sleep(2)
    raise RuntimeError(f"postgres not reachable: {last}")


def pg() -> asyncpg.Pool:
    assert _pg_pool is not None, "pg pool not initialized"
    return _pg_pool


def _connect_ch():
    return clickhouse_connect.get_client(
        host=settings.CLICKHOUSE_HOST,
        port=settings.CLICKHOUSE_PORT,
        username=settings.CLICKHOUSE_USER,
        password=settings.CLICKHOUSE_PASSWORD,
        database=settings.CLICKHOUSE_DB,
    )


async def init_ch(retries: int = 30):
    global _ch_client
    last = None
    for _ in range(retries):
        try:
            _ch_client = await asyncio.to_thread(_connect_ch)
            await asyncio.to_thread(_ch_client.command, "SELECT 1")
            return _ch_client
        except Exception as e:
            last = e
            await asyncio.sleep(2)
    raise RuntimeError(f"clickhouse not reachable: {last}")


def ch():
    assert _ch_client is not None, "clickhouse client not initialized"
    return _ch_client


async def ch_insert(table: str, rows: list[list], column_names: list[str]):
    if not rows:
        return
    await asyncio.to_thread(ch().insert, table, rows, column_names=column_names)


async def ch_query(sql: str, parameters: dict | None = None):
    res = await asyncio.to_thread(ch().query, sql, parameters=parameters or {})
    return res.result_rows, [c for c in res.column_names]

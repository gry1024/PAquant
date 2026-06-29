from __future__ import annotations

import sqlite3

DDL = [
    """
    CREATE TABLE IF NOT EXISTS instruments (
      symbol TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      payload_json TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS candles (
      id INTEGER PRIMARY KEY,
      timestamp TEXT NOT NULL,
      symbol TEXT NOT NULL,
      timeframe TEXT NOT NULL,
      open REAL NOT NULL,
      high REAL NOT NULL,
      low REAL NOT NULL,
      close REAL NOT NULL,
      volume REAL NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY,
      symbol TEXT NOT NULL,
      timeframe TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS ai_traders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      payload_json TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS trader_profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      payload_json TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS analysis_runs (
      id INTEGER PRIMARY KEY,
      trader_id TEXT NOT NULL,
      symbol TEXT NOT NULL,
      timeframe TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS agent_runs (
      id INTEGER PRIMARY KEY,
      session_id INTEGER,
      trader_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS agent_actions (
      id INTEGER PRIMARY KEY,
      analysis_run_id INTEGER NOT NULL,
      sequence INTEGER NOT NULL,
      tool TEXT NOT NULL,
      payload_json TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS chart_objects (
      id TEXT PRIMARY KEY,
      agent_run_id INTEGER,
      payload_json TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS drawing_objects (
      id TEXT PRIMARY KEY,
      analysis_run_id INTEGER,
      payload_json TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS simulated_orders (
      id TEXT PRIMARY KEY,
      agent_run_id INTEGER,
      payload_json TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      analysis_run_id INTEGER,
      payload_json TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS simulated_trades (
      id INTEGER PRIMARY KEY,
      order_id TEXT NOT NULL,
      payload_json TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS trades (
      id INTEGER PRIMARY KEY,
      order_id TEXT NOT NULL,
      payload_json TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS trade_reviews (
      id INTEGER PRIMARY KEY,
      agent_run_id INTEGER,
      trade_id INTEGER,
      payload_json TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS trade_snapshots (
      id INTEGER PRIMARY KEY,
      trade_id INTEGER,
      payload_json TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS model_calls (
      id INTEGER PRIMARY KEY,
      agent_run_id INTEGER,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      input_tokens INTEGER NOT NULL,
      output_tokens INTEGER NOT NULL,
      estimated_cost_usd REAL NOT NULL,
      payload_json TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS llm_usage (
      id INTEGER PRIMARY KEY,
      analysis_run_id INTEGER,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      input_tokens INTEGER NOT NULL,
      output_tokens INTEGER NOT NULL,
      estimated_cost_usd REAL NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS journals (
      id INTEGER PRIMARY KEY,
      analysis_run_id INTEGER,
      entry_type TEXT NOT NULL,
      payload_json TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS knowledge_sources (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      payload_json TEXT NOT NULL
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS knowledge_chunks (
      id INTEGER PRIMARY KEY,
      source_id TEXT NOT NULL,
      chunk_key TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      UNIQUE(source_id, chunk_key)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS setup_dossiers (
      key TEXT PRIMARY KEY,
      payload_json TEXT NOT NULL
    )
    """,
]


def create_schema(connection: sqlite3.Connection) -> None:
    for statement in DDL:
        connection.execute(statement)
    connection.commit()


def list_tables(connection: sqlite3.Connection) -> list[str]:
    rows = connection.execute("SELECT name FROM sqlite_master WHERE type = 'table'").fetchall()
    return [row[0] for row in rows]

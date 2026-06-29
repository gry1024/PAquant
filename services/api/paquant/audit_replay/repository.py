from __future__ import annotations

import json
import sqlite3
from typing import Any

_COUNTABLE_TABLES = {
    "analysis_runs",
    "candles",
    "drawing_objects",
    "journals",
    "llm_usage",
    "orders",
    "trade_snapshots",
    "trader_profiles",
    "trades",
}


class AuditRepository:
    def __init__(self, connection: sqlite3.Connection) -> None:
        self.connection = connection

    def record_analysis_run(
        self,
        *,
        trader_id: str,
        symbol: str,
        timeframe: str,
        payload: dict[str, Any],
    ) -> int:
        cursor = self.connection.execute(
            """
            INSERT INTO analysis_runs (trader_id, symbol, timeframe, payload_json)
            VALUES (?, ?, ?, ?)
            """,
            (trader_id, symbol, timeframe, json.dumps(payload, ensure_ascii=False)),
        )
        self.connection.commit()
        return int(cursor.lastrowid)

    def record_model_call(
        self,
        *,
        analysis_run_id: int,
        provider: str,
        model: str,
        input_tokens: int,
        output_tokens: int,
        estimated_cost_usd: float,
    ) -> int:
        cursor = self.connection.execute(
            """
            INSERT INTO llm_usage
              (analysis_run_id, provider, model, input_tokens, output_tokens, estimated_cost_usd)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (analysis_run_id, provider, model, input_tokens, output_tokens, estimated_cost_usd),
        )
        self.connection.commit()
        return int(cursor.lastrowid)

    def record_drawing_object(
        self, *, object_id: str, analysis_run_id: int, payload: dict[str, Any]
    ) -> None:
        self.connection.execute(
            "INSERT INTO drawing_objects (id, analysis_run_id, payload_json) VALUES (?, ?, ?)",
            (object_id, analysis_run_id, json.dumps(payload, ensure_ascii=False)),
        )
        self.connection.commit()

    def record_order(
        self, *, order_id: str, analysis_run_id: int, payload: dict[str, Any]
    ) -> None:
        self.connection.execute(
            "INSERT INTO orders (id, analysis_run_id, payload_json) VALUES (?, ?, ?)",
            (order_id, analysis_run_id, json.dumps(payload, ensure_ascii=False)),
        )
        self.connection.commit()

    def record_trade(self, *, order_id: str, payload: dict[str, Any]) -> int:
        cursor = self.connection.execute(
            "INSERT INTO trades (order_id, payload_json) VALUES (?, ?)",
            (order_id, json.dumps(payload, ensure_ascii=False)),
        )
        self.connection.commit()
        return int(cursor.lastrowid)

    def record_journal(
        self, *, analysis_run_id: int, entry_type: str, payload: dict[str, Any]
    ) -> int:
        cursor = self.connection.execute(
            """
            INSERT INTO journals (analysis_run_id, entry_type, payload_json)
            VALUES (?, ?, ?)
            """,
            (analysis_run_id, entry_type, json.dumps(payload, ensure_ascii=False)),
        )
        self.connection.commit()
        return int(cursor.lastrowid)

    def upsert_trader_profile(
        self, *, profile_id: str, name: str, payload: dict[str, Any]
    ) -> None:
        self.connection.execute(
            """
            INSERT INTO trader_profiles (id, name, payload_json)
            VALUES (?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              payload_json = excluded.payload_json
            """,
            (profile_id, name, json.dumps(payload, ensure_ascii=False)),
        )
        self.connection.commit()

    def list_trader_profiles(self) -> list[dict[str, Any]]:
        rows = self.connection.execute(
            "SELECT id, name, payload_json FROM trader_profiles"
        ).fetchall()
        profiles: list[dict[str, Any]] = []
        for profile_id, name, payload_json in rows:
            payload = json.loads(payload_json)
            payload["id"] = profile_id
            payload["name"] = name
            profiles.append(payload)
        return profiles

    def count_rows(self, table_name: str) -> int:
        if table_name not in _COUNTABLE_TABLES:
            raise ValueError(f"cannot count unknown audit table: {table_name}")
        row = self.connection.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()
        return int(row[0])

from __future__ import annotations

import json
import sqlite3
from typing import Any

_COUNTABLE_TABLES = {
    "agent_actions",
    "agent_runs",
    "ai_traders",
    "analysis_runs",
    "candles",
    "chart_objects",
    "drawing_objects",
    "instruments",
    "journals",
    "knowledge_chunks",
    "knowledge_sources",
    "llm_usage",
    "model_calls",
    "orders",
    "sessions",
    "setup_dossiers",
    "simulated_orders",
    "simulated_trades",
    "trade_reviews",
    "trade_snapshots",
    "trader_profiles",
    "trades",
}


class AuditRepository:
    def __init__(self, connection: sqlite3.Connection) -> None:
        self.connection = connection

    def upsert_instrument(
        self,
        *,
        symbol: str,
        display_name: str,
        payload: dict[str, Any],
    ) -> None:
        self.connection.execute(
            """
            INSERT INTO instruments (symbol, display_name, payload_json)
            VALUES (?, ?, ?)
            ON CONFLICT(symbol) DO UPDATE SET
              display_name = excluded.display_name,
              payload_json = excluded.payload_json
            """,
            (symbol, display_name, json.dumps(payload, ensure_ascii=False)),
        )
        self.connection.commit()

    def record_session(
        self,
        *,
        symbol: str,
        timeframe: str,
        payload: dict[str, Any],
    ) -> int:
        cursor = self.connection.execute(
            """
            INSERT INTO sessions (symbol, timeframe, payload_json)
            VALUES (?, ?, ?)
            """,
            (symbol, timeframe, json.dumps(payload, ensure_ascii=False)),
        )
        self.connection.commit()
        return int(cursor.lastrowid)

    def upsert_ai_trader(
        self,
        *,
        trader_id: str,
        name: str,
        payload: dict[str, Any],
    ) -> None:
        self.connection.execute(
            """
            INSERT INTO ai_traders (id, name, payload_json)
            VALUES (?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              payload_json = excluded.payload_json
            """,
            (trader_id, name, json.dumps(payload, ensure_ascii=False)),
        )
        self.connection.commit()

    def record_agent_run(
        self,
        *,
        session_id: int,
        trader_id: str,
        payload: dict[str, Any],
    ) -> int:
        cursor = self.connection.execute(
            """
            INSERT INTO agent_runs (session_id, trader_id, payload_json)
            VALUES (?, ?, ?)
            """,
            (session_id, trader_id, json.dumps(payload, ensure_ascii=False)),
        )
        self.connection.commit()
        return int(cursor.lastrowid)

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

    def record_agent_action(
        self,
        *,
        analysis_run_id: int,
        sequence: int,
        tool: str,
        payload: dict[str, Any],
    ) -> int:
        cursor = self.connection.execute(
            """
            INSERT INTO agent_actions (analysis_run_id, sequence, tool, payload_json)
            VALUES (?, ?, ?, ?)
            """,
            (
                analysis_run_id,
                sequence,
                tool,
                json.dumps(payload, ensure_ascii=False),
            ),
        )
        self.connection.commit()
        return int(cursor.lastrowid)

    def record_canonical_model_call(
        self,
        *,
        agent_run_id: int,
        provider: str,
        model: str,
        input_tokens: int,
        output_tokens: int,
        estimated_cost_usd: float,
        payload: dict[str, Any],
    ) -> int:
        cursor = self.connection.execute(
            """
            INSERT INTO model_calls
              (
                agent_run_id,
                provider,
                model,
                input_tokens,
                output_tokens,
                estimated_cost_usd,
                payload_json
              )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                agent_run_id,
                provider,
                model,
                input_tokens,
                output_tokens,
                estimated_cost_usd,
                json.dumps(payload, ensure_ascii=False),
            ),
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

    def record_chart_object(
        self, *, object_id: str, agent_run_id: int, payload: dict[str, Any]
    ) -> None:
        self.connection.execute(
            "INSERT INTO chart_objects (id, agent_run_id, payload_json) VALUES (?, ?, ?)",
            (object_id, agent_run_id, json.dumps(payload, ensure_ascii=False)),
        )
        self.connection.commit()

    def record_drawing_object(
        self, *, object_id: str, analysis_run_id: int, payload: dict[str, Any]
    ) -> None:
        self.connection.execute(
            "INSERT INTO drawing_objects (id, analysis_run_id, payload_json) VALUES (?, ?, ?)",
            (object_id, analysis_run_id, json.dumps(payload, ensure_ascii=False)),
        )
        self.connection.commit()

    def record_simulated_order(
        self, *, order_id: str, agent_run_id: int, payload: dict[str, Any]
    ) -> None:
        self.connection.execute(
            "INSERT INTO simulated_orders (id, agent_run_id, payload_json) VALUES (?, ?, ?)",
            (order_id, agent_run_id, json.dumps(payload, ensure_ascii=False)),
        )
        self.connection.commit()

    def record_order(self, *, order_id: str, analysis_run_id: int, payload: dict[str, Any]) -> None:
        self.connection.execute(
            "INSERT INTO orders (id, analysis_run_id, payload_json) VALUES (?, ?, ?)",
            (order_id, analysis_run_id, json.dumps(payload, ensure_ascii=False)),
        )
        self.connection.commit()

    def record_simulated_trade(self, *, order_id: str, payload: dict[str, Any]) -> int:
        cursor = self.connection.execute(
            "INSERT INTO simulated_trades (order_id, payload_json) VALUES (?, ?)",
            (order_id, json.dumps(payload, ensure_ascii=False)),
        )
        self.connection.commit()
        return int(cursor.lastrowid)

    def record_trade(self, *, order_id: str, payload: dict[str, Any]) -> int:
        cursor = self.connection.execute(
            "INSERT INTO trades (order_id, payload_json) VALUES (?, ?)",
            (order_id, json.dumps(payload, ensure_ascii=False)),
        )
        self.connection.commit()
        return int(cursor.lastrowid)

    def record_trade_review(
        self,
        *,
        agent_run_id: int,
        trade_id: int,
        payload: dict[str, Any],
    ) -> int:
        cursor = self.connection.execute(
            """
            INSERT INTO trade_reviews (agent_run_id, trade_id, payload_json)
            VALUES (?, ?, ?)
            """,
            (agent_run_id, trade_id, json.dumps(payload, ensure_ascii=False)),
        )
        self.connection.commit()
        return int(cursor.lastrowid)

    def record_trade_snapshot(self, *, trade_id: int, payload: dict[str, Any]) -> int:
        cursor = self.connection.execute(
            """
            INSERT INTO trade_snapshots (trade_id, payload_json)
            VALUES (?, ?)
            """,
            (trade_id, json.dumps(payload, ensure_ascii=False)),
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

    def upsert_trader_profile(self, *, profile_id: str, name: str, payload: dict[str, Any]) -> None:
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

    def record_knowledge_source(
        self,
        *,
        source_id: str,
        title: str,
        payload: dict[str, Any],
    ) -> None:
        self.connection.execute(
            """
            INSERT INTO knowledge_sources (id, title, payload_json)
            VALUES (?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              title = excluded.title,
              payload_json = excluded.payload_json
            """,
            (source_id, title, json.dumps(payload, ensure_ascii=False)),
        )
        self.connection.commit()

    def record_knowledge_chunk(
        self,
        *,
        source_id: str,
        chunk_key: str,
        payload: dict[str, Any],
    ) -> None:
        self.connection.execute(
            """
            INSERT INTO knowledge_chunks (source_id, chunk_key, payload_json)
            VALUES (?, ?, ?)
            ON CONFLICT(source_id, chunk_key) DO UPDATE SET
              payload_json = excluded.payload_json
            """,
            (source_id, chunk_key, json.dumps(payload, ensure_ascii=False)),
        )
        self.connection.commit()

    def record_setup_dossier(
        self,
        *,
        dossier_key: str,
        payload: dict[str, Any],
    ) -> None:
        self.connection.execute(
            """
            INSERT INTO setup_dossiers (key, payload_json)
            VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET
              payload_json = excluded.payload_json
            """,
            (dossier_key, json.dumps(payload, ensure_ascii=False)),
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

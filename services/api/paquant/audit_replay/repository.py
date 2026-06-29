from __future__ import annotations

import json
import sqlite3
from typing import Any


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

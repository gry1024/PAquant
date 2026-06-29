import pytest
from paquant.data_layer.sample_data import load_sample_candles
from paquant.drawing_engine.schemas import AnchorPoint
from paquant.drawing_engine.tools import (
    REQUIRED_BROOKS_TOOL_NAMES,
    ToolCommand,
    execute_drawing_plan,
)


def _anchor(time_index: int, price: float) -> dict[str, float | int]:
    return {"time_index": time_index, "price": price}


def test_execute_drawing_plan_covers_required_brooks_tools():
    commands = [
        ToolCommand(
            tool="find_swings",
            arguments={"left_strength": 2, "right_strength": 2, "limit": 8},
        ),
        ToolCommand(
            tool="snap_to_swing",
            arguments={"time_index": 9, "price": 2311.4, "side": "low"},
        ),
        ToolCommand(
            tool="draw_trendline",
            arguments={
                "id": "tl-auto",
                "label": "Auto swing support",
                "start": _anchor(0, 2306.5),
                "end": _anchor(40, 2329.0),
            },
        ),
        ToolCommand(
            tool="draw_channel",
            arguments={
                "id": "channel-auto",
                "label": "Auto channel projection",
                "base_id": "tl-auto",
                "parallel_anchor": _anchor(17, 2322.4),
            },
        ),
        ToolCommand(
            tool="draw_box",
            arguments={
                "id": "box-auto",
                "label": "Pullback box",
                "start_index": 0,
                "end_index": 12,
                "high": 2316.0,
                "low": 2306.5,
            },
        ),
        ToolCommand(
            tool="draw_fibonacci",
            arguments={
                "id": "fib-auto",
                "label": "Swing retracement map",
                "start": _anchor(0, 2306.5),
                "end": _anchor(24, 2325.2),
            },
        ),
        ToolCommand(
            tool="measure_leg",
            arguments={"start": _anchor(4, 2310.0), "end": _anchor(18, 2320.0)},
        ),
        ToolCommand(
            tool="compare_legs",
            arguments={
                "first": {"start": _anchor(4, 2310.0), "end": _anchor(18, 2320.0)},
                "second": {"start": _anchor(20, 2315.0), "end": _anchor(29, 2326.9)},
            },
        ),
        ToolCommand(tool="count_bars", arguments={"start_index": 8, "end_index": 17}),
        ToolCommand(
            tool="project_line",
            arguments={
                "start": _anchor(0, 2306.5),
                "end": _anchor(40, 2329.0),
                "time_index": 60,
            },
        ),
        ToolCommand(
            tool="measure_deviation",
            arguments={
                "start": _anchor(0, 2306.5),
                "end": _anchor(40, 2329.0),
                "point": _anchor(29, 2326.9),
            },
        ),
    ]

    result = execute_drawing_plan(load_sample_candles(), commands)

    assert {action.tool for action in result.actions} >= REQUIRED_BROOKS_TOOL_NAMES
    assert result.actions[0].output["swings"]
    assert any(chart_object.kind == "channel" for chart_object in result.chart_objects)
    count_action = next(action for action in result.actions if action.tool == "count_bars")
    assert count_action.output["bars"] == 10
    deviation_action = next(
        action for action in result.actions if action.tool == "measure_deviation"
    )
    assert deviation_action.output["points"] == pytest.approx(4.0875)
    snap_action = next(action for action in result.actions if action.tool == "snap_to_swing")
    assert snap_action.output["anchor"]["time_index"] >= 0
    serialized = result.model_dump(mode="json")
    assert serialized["actions"][0]["tool"] == "find_swings"
    assert serialized["chart_objects"]


def test_line_projection_and_snap_outputs_are_structured():
    result = execute_drawing_plan(
        load_sample_candles(),
        [
            ToolCommand(
                tool="project_line",
                arguments={
                    "start": AnchorPoint(time_index=0, price=2300).model_dump(),
                    "end": AnchorPoint(time_index=10, price=2320).model_dump(),
                    "time_index": 15,
                },
            ),
            ToolCommand(
                tool="snap_to_swing",
                arguments={"time_index": 17, "price": 2320.8, "side": "high"},
            ),
        ],
    )

    assert result.actions[0].output == {"time_index": 15, "price": 2330.0}
    assert result.actions[1].output["anchor"]["price"] > 0

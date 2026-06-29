import pytest
from paquant.drawing_engine.geometry import (
    build_fibonacci_levels,
    line_value_at,
    measure_leg,
)
from paquant.drawing_engine.schemas import AnchorPoint


def test_line_value_at_interpolates_between_anchors():
    value = line_value_at(
        AnchorPoint(time_index=0, price=2300),
        AnchorPoint(time_index=10, price=2320),
        time_index=5,
    )

    assert value == pytest.approx(2310)


def test_measure_leg_returns_points_bars_and_direction():
    measurement = measure_leg(
        AnchorPoint(time_index=4, price=2308),
        AnchorPoint(time_index=14, price=2331),
    )

    assert measurement.points == pytest.approx(23)
    assert measurement.bars == 10
    assert measurement.direction == "up"


def test_build_fibonacci_levels_from_anchors():
    levels = build_fibonacci_levels(
        AnchorPoint(time_index=0, price=2300),
        AnchorPoint(time_index=10, price=2350),
    )

    assert levels["0.500"] == pytest.approx(2325)
    assert levels["0.618"] == pytest.approx(2319.1)

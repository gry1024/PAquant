from paquant.drawing_engine.schemas import AnchorPoint, TrendLine, deserialize_chart_object


def test_trendline_round_trips():
    obj = TrendLine(
        id="tl-1",
        label="bull trend line",
        anchors=[
            AnchorPoint(time_index=0, price=2300),
            AnchorPoint(time_index=10, price=2320),
        ],
    )

    restored = deserialize_chart_object(obj.model_dump(mode="json"))

    assert restored == obj

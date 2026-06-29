from paquant.broker_adapter.base import BrokerOrderIntent, MockBrokerAdapter


def test_mock_broker_adapter_never_places_live_orders():
    adapter = MockBrokerAdapter()

    receipt = adapter.place_order(
        BrokerOrderIntent(
            symbol="XAUUSDc",
            side="buy",
            order_type="market",
            quantity=0.01,
            entry=None,
            stop=2300,
            target=2320,
        )
    )

    assert receipt.status == "accepted_simulated"
    assert receipt.live is False

import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import { OrdersPanel } from "./OrdersPanel";
import type { SimulatedOrder } from "../lib/workbenchTypes";

const stopOrder: SimulatedOrder = {
  id: "order-stop-signal",
  symbol: "XAUUSD",
  timeframe: "5m",
  side: "buy",
  order_type: "stop",
  activation_price: 2323.03,
  entry: 2323.03,
  filled_entry: null,
  stop: 2316.59,
  target: 2335.91,
  quantity: 1,
  setup_name: "Brooks signal-bar breakout in always-in long context",
  reason: "入场标记：突破信号K线高点 2322.93 后，以 2323.03 触发 buy stop。",
  status: "submitted",
  execution_plan: {
    order_type_label: "buy stop",
    signal_bar_index: 17,
    signal_bar_time: "2026-06-30T01:25:00+00:00",
    signal_bar_pattern: "多头信号K线：实体方向一致，收盘位置支持 buy stop",
    trigger_price: 2323.03,
    trigger_condition: "突破信号K线高点 2322.93 后，以 2323.03 触发 buy stop",
    entry_tactic: "buy stop stop order，等待信号K线被触发后才入场；触发前不成交"
  }
};

test("orders panel shows concrete stop-order execution plan instead of only prices", () => {
  render(<OrdersPanel orders={[stopOrder]} trades={[]} />);

  const panel = screen.getByText("模拟订单").closest("section");
  expect(panel).not.toBeNull();
  const scope = within(panel as HTMLElement);

  expect(scope.getByText("Stop 单")).toBeInTheDocument();
  expect(scope.getByText("2323.03")).toBeInTheDocument();
  expect(scope.getByText("仓位")).toBeInTheDocument();
  expect(scope.getByText("信号K线 18")).toBeInTheDocument();
  expect(scope.getByText(/2026-06-30 01:25/)).toBeInTheDocument();
  expect(scope.getAllByText(/突破信号K线高点 2322\.93/).length).toBeGreaterThan(1);
  expect(scope.getByText(/触发前不成交/)).toBeInTheDocument();
  expect(scope.getByText(/交易理由/)).toBeInTheDocument();
});

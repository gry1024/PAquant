import { ListChecks } from "lucide-react";
import { formatOrderSide, formatOrderStatus, formatOrderType, translateText } from "../lib/displayText";
import type { SimulatedOrder, SimulatedTrade } from "../lib/workbenchTypes";

interface OrdersPanelProps {
  orders: SimulatedOrder[];
  trades: SimulatedTrade[];
}

export function OrdersPanel({ orders, trades }: OrdersPanelProps) {
  return (
    <section className="data-panel">
      <div className="panel-heading">
        <ListChecks size={16} />
        模拟订单
      </div>
      <div className="table-like">
        <div className="table-row table-head">
          <span>方向</span>
          <span>类型</span>
          <span>入场</span>
          <span>成交</span>
          <span>止损</span>
          <span>止盈</span>
          <span>仓位</span>
          <span>状态</span>
        </div>
        {orders.map((order) => (
          <div className="order-block" key={order.id}>
            <div className="table-row">
              <span>{formatOrderSide(order.side)}</span>
              <span>{formatOrderType(order.order_type)}</span>
              <span>{order.entry.toFixed(2)}</span>
              <span>{order.filled_entry == null ? "-" : order.filled_entry.toFixed(2)}</span>
              <span>{order.stop.toFixed(2)}</span>
              <span>{order.target.toFixed(2)}</span>
              <span>{order.quantity}</span>
              <span>{formatOrderStatus(order.status)}</span>
            </div>
            {order.execution_plan ? (
              <div className="order-execution-plan">
                <span className="order-plan-chip">
                  信号K线 {order.execution_plan.signal_bar_index + 1}
                </span>
                <span>{formatSignalTime(order.execution_plan.signal_bar_time)}</span>
                <span>{order.execution_plan.signal_bar_pattern}</span>
                <strong>{order.execution_plan.trigger_condition}</strong>
                <span>{order.execution_plan.entry_tactic}</span>
              </div>
            ) : null}
            <div className="order-reason">
              <strong>交易理由</strong>
              <span>{translateText(order.reason)}</span>
            </div>
          </div>
        ))}
      </div>
      {trades.map((trade) => (
        <div className="trade-result" key={trade.order_id}>
          <strong>{trade.r_multiple.toFixed(1)}R</strong>
          <span>{translateText(trade.outcome)} | 盈亏 {trade.pnl.toFixed(2)}</span>
          <span className="trade-excursion">
            <span>MFE</span> {trade.mfe_points.toFixed(2)}
            <span>MAE</span> {trade.mae_points.toFixed(2)}
          </span>
        </div>
      ))}
    </section>
  );
}

function formatSignalTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toISOString().slice(0, 16).replace("T", " ");
}

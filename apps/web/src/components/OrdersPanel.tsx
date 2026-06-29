import { ListChecks } from "lucide-react";
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
        Simulated orders
      </div>
      <div className="table-like">
        <div className="table-row table-head">
          <span>Side</span>
          <span>Type</span>
          <span>Entry</span>
          <span>Fill</span>
          <span>Stop</span>
          <span>Target</span>
          <span>Qty</span>
          <span>Status</span>
        </div>
        {orders.map((order) => (
          <div className="table-row" key={order.id}>
            <span>{order.side.toUpperCase()}</span>
            <span>{order.order_type.replace("_", "-").toUpperCase()}</span>
            <span>{order.entry.toFixed(2)}</span>
            <span>{order.filled_entry == null ? "-" : order.filled_entry.toFixed(2)}</span>
            <span>{order.stop.toFixed(2)}</span>
            <span>{order.target.toFixed(2)}</span>
            <span>{order.quantity}</span>
            <span>{order.status}</span>
            <span className="order-reason">{order.reason}</span>
          </div>
        ))}
      </div>
      {trades.map((trade) => (
        <div className="trade-result" key={trade.order_id}>
          <strong>{trade.r_multiple.toFixed(1)}R</strong>
          <span>{trade.outcome} | pnl {trade.pnl.toFixed(2)}</span>
          <span className="trade-excursion">
            <span>MFE</span> {trade.mfe_points.toFixed(2)}
            <span>MAE</span> {trade.mae_points.toFixed(2)}
          </span>
        </div>
      ))}
    </section>
  );
}

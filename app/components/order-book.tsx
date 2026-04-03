"use client";

import { Card, ScrollShadow } from "@heroui/react";

import type { OrderBookLevel } from "@/lib/market";
import { formatCompact, formatPrice } from "./shared/format";

type OrderBookProps = {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
};

export function OrderBook({ bids, asks }: OrderBookProps) {
  const maxBidQty = Math.max(...bids.map((l) => l.quantity), 1);
  const maxAskQty = Math.max(...asks.map((l) => l.quantity), 1);
  const maxQty = Math.max(maxBidQty, maxAskQty);

  return (
    <Card className="panel-surface rounded-lg border shadow-none">
      <Card.Header className="flex-col items-start gap-0 px-3 pt-3 pb-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          Order Book
        </p>
        <Card.Title className="text-sm font-semibold text-white">
          Top 10 深度
        </Card.Title>
      </Card.Header>
      <Card.Content className="px-0 pb-0">
        <div className="mt-2 overflow-hidden rounded-md border border-white/5">
          <div className="grid grid-cols-2 bg-white/[0.03] px-3 py-2 text-[10px] uppercase tracking-[0.15em] text-slate-500">
            <span>Price</span>
            <span className="text-right">Size</span>
          </div>

          {/* Asks (reversed: highest at top) */}
          <ScrollShadow className="max-h-[260px] divide-y divide-white/5">
            {[...asks].reverse().map((level, i) => (
              <div
                key={`ask-${i}`}
                className="relative grid grid-cols-2 px-3 py-1.5 text-xs font-mono"
              >
                <div
                  className="depth-bar depth-bar-ask"
                  style={{ width: `${(level.quantity / maxQty) * 100}%` }}
                />
                <span className="relative text-rose-400">{formatPrice(level.price)}</span>
                <span className="relative text-right text-slate-400">{formatCompact(level.quantity)}</span>
              </div>
            ))}
          </ScrollShadow>

          {/* Spread */}
          <div className="border-y border-white/5 px-3 py-1.5 text-center text-[10px] text-slate-500">
            {asks.length > 0 && bids.length > 0
              ? `Spread: ${formatPrice(asks[0].price - bids[0].price)}`
              : "—"}
          </div>

          {/* Bids */}
          <ScrollShadow className="max-h-[260px] divide-y divide-white/5">
            {bids.map((level, i) => (
              <div
                key={`bid-${i}`}
                className="relative grid grid-cols-2 px-3 py-1.5 text-xs font-mono"
              >
                <div
                  className="depth-bar depth-bar-bid"
                  style={{ width: `${(level.quantity / maxQty) * 100}%` }}
                />
                <span className="relative text-emerald-400">{formatPrice(level.price)}</span>
                <span className="relative text-right text-slate-400">{formatCompact(level.quantity)}</span>
              </div>
            ))}
          </ScrollShadow>
        </div>
      </Card.Content>
    </Card>
  );
}

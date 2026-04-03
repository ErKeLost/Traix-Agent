"use client";

import { Card, ScrollShadow } from "@heroui/react";

import type { Trade } from "@/lib/market";
import { formatCompact, formatPrice, formatTime } from "./shared/format";

type TradesListProps = {
  trades: Trade[];
};

export function TradesList({ trades }: TradesListProps) {
  return (
    <Card className="panel-surface rounded-lg border shadow-none">
      <Card.Header className="flex-col items-start gap-0 px-3 pt-3 pb-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          Recent Trades
        </p>
        <Card.Title className="text-sm font-semibold text-white">
          逐笔成交
        </Card.Title>
      </Card.Header>
      <Card.Content className="px-0 pb-0">
        <div className="mt-2 overflow-hidden rounded-md border border-white/5">
          <div className="grid grid-cols-[1.2fr_1fr_1fr] bg-white/[0.03] px-3 py-2 text-[10px] uppercase tracking-[0.15em] text-slate-500">
            <span>Price</span>
            <span>Qty</span>
            <span className="text-right">Time</span>
          </div>
          <ScrollShadow className="max-h-[520px] divide-y divide-white/5">
            {trades.map((trade) => (
              <div
                key={trade.id}
                className="grid grid-cols-[1.2fr_1fr_1fr] px-3 py-1.5 text-xs font-mono"
              >
                <span className={trade.isBuyerMaker ? "text-rose-400" : "text-emerald-400"}>
                  {formatPrice(trade.price)}
                </span>
                <span className="text-slate-300">{formatCompact(trade.quantity)}</span>
                <span className="text-right text-slate-500">{formatTime(trade.time)}</span>
              </div>
            ))}
          </ScrollShadow>
        </div>
      </Card.Content>
    </Card>
  );
}

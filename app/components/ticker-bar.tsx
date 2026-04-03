"use client";

import type { BookTicker, Ticker24h } from "@/lib/market";
import { formatCompact, formatPercent, formatPrice } from "./shared/format";

type TickerBarProps = {
  ticker24h: Ticker24h;
  bookTicker: BookTicker;
  lastClose: number;
};

export function TickerBar({ ticker24h, bookTicker, lastClose }: TickerBarProps) {
  const price = ticker24h.lastPrice || lastClose;
  const change = ticker24h.priceChangePercent;
  const isUp = change >= 0;

  return (
    <div className="flex items-center gap-3 overflow-x-auto">
      {/* Price */}
      <div className="flex items-baseline gap-2 shrink-0">
        <span className={`text-2xl font-mono font-semibold ${isUp ? "text-emerald-400" : "text-rose-400"}`}>
          {formatPrice(price)}
        </span>
        <span className={`text-sm font-mono font-medium ${isUp ? "text-emerald-400" : "text-rose-400"}`}>
          {formatPercent(change)}
        </span>
      </div>

      <div className="h-6 w-px shrink-0 bg-white/10" />

      {/* 24h stats */}
      <div className="flex items-center gap-4 shrink-0 text-xs">
        <Stat label="24h High" value={formatPrice(ticker24h.highPrice)} />
        <Stat label="24h Low" value={formatPrice(ticker24h.lowPrice)} />
        <Stat label="Volume" value={formatCompact(ticker24h.volume)} />
      </div>

      <div className="h-6 w-px shrink-0 bg-white/10" />

      {/* Bid / Ask */}
      <div className="flex items-center gap-3 shrink-0 text-xs">
        <div>
          <span className="text-[10px] uppercase tracking-wider text-slate-500">Bid </span>
          <span className="font-mono text-emerald-400">{formatPrice(bookTicker.bidPrice)}</span>
          <span className="ml-1 text-slate-500">{formatCompact(bookTicker.bidQuantity)}</span>
        </div>
        <div>
          <span className="text-[10px] uppercase tracking-wider text-slate-500">Ask </span>
          <span className="font-mono text-rose-400">{formatPrice(bookTicker.askPrice)}</span>
          <span className="ml-1 text-slate-500">{formatCompact(bookTicker.askQuantity)}</span>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[10px] uppercase tracking-wider text-slate-500">{label} </span>
      <span className="font-mono text-slate-200">{value}</span>
    </div>
  );
}

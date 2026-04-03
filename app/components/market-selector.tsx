"use client";

import { Button, Card, Input, ScrollShadow, Spinner } from "@heroui/react";
import { startTransition, useEffect, useRef, useState } from "react";

import { MARKET_SYMBOLS, normalizeMarketSymbol, type MarketSymbol } from "@/lib/market";

type MarketSelectorProps = {
  open: boolean;
  symbol: MarketSymbol;
  onSymbolChange: (symbol: MarketSymbol) => void;
  onClose: () => void;
};

type SymbolItem = { symbol: string; base: string; quote: string };

const FAVORITES: SymbolItem[] = MARKET_SYMBOLS.map((m) => ({
  symbol: m.symbol,
  base: m.base,
  quote: m.quote,
}));

export function MarketSelector({ open, symbol, onSymbolChange, onClose }: MarketSelectorProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SymbolItem[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    debounceRef.current = setTimeout(async () => {
      try {
        const resp = await fetch(
          `/api/market/symbols?q=${encodeURIComponent(query.trim())}`,
        );
        const data = (await resp.json()) as { symbols: SymbolItem[] };
        setResults(data.symbols);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query]);

  function select(sym: string) {
    const normalized = normalizeMarketSymbol(sym);

    if (!normalized) {
      return;
    }

    startTransition(() => {
      onSymbolChange(normalized);
    });
    onClose();
  }

  if (!open) {
    return null;
  }

  const listItems = query.trim() ? results : FAVORITES;

  return (
    <div className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm" onClick={onClose}>
      <Card
        className="absolute left-1/2 top-[10vh] w-[min(640px,94vw)] -translate-x-1/2 border border-white/10 bg-[#081526] text-white shadow-[0_24px_60px_rgba(0,0,0,0.45)]"
        onClick={(event) => event.stopPropagation()}
      >
        <Card.Header className="items-start justify-between border-b border-white/10 px-4 py-3">
          <div className="w-full space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-widest text-slate-500">Markets</span>
              <Button
                isIconOnly
                size="sm"
                variant="light"
                className="text-slate-400"
                onClick={onClose}
                aria-label="关闭搜索"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </Button>
            </div>
            <div className="relative">
              <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              {loading ? (
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                  <Spinner size="sm" color="default" />
                </span>
              ) : null}
              <Input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value.toUpperCase())}
                placeholder="搜索币种，如 BTC、XRPUSDT…"
                className="w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-9 text-slate-100 placeholder:text-slate-500"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const first = listItems[0];

                    if (first) {
                      select(first.symbol);
                    }
                  }
                }}
              />
            </div>
          </div>
        </Card.Header>
        <Card.Content className="px-3 pb-3 pt-2">
          <ScrollShadow className="max-h-[56vh] space-y-2 pr-1">
            {!query.trim() ? (
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                常用币种
              </p>
            ) : null}
            {listItems.length === 0 && !loading ? (
              <p className="px-2 py-6 text-center text-sm text-slate-500">没有找到匹配的币种</p>
            ) : (
              listItems.map((item) => {
                const active = item.symbol === symbol;

                return (
                  <Button
                    key={item.symbol}
                    fullWidth
                    variant={active ? "primary" : "ghost"}
                    className={`h-auto justify-start rounded-xl px-3 py-2.5 ${
                      active
                        ? "bg-emerald-500/15 text-white"
                        : "text-slate-300 hover:bg-white/8 hover:text-white"
                    }`}
                    onClick={() => select(item.symbol)}
                  >
                    <div className="w-full text-left">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">{item.base}</span>
                        <span className="text-[10px] text-slate-500">{item.quote}</span>
                      </div>
                      <p className="text-[11px] text-slate-500">{item.symbol}</p>
                    </div>
                  </Button>
                );
              })
            )}
          </ScrollShadow>
        </Card.Content>
      </Card>
    </div>
  );
}

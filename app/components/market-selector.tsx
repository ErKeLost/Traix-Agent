"use client";

import { startTransition, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { MARKET_SYMBOLS, normalizeMarketSymbol, type MarketSymbol } from "@/lib/market";

type MarketSelectorProps = {
  open: boolean;
  symbol: MarketSymbol;
  onSymbolChange: (symbol: MarketSymbol) => void;
  onClose: () => void;
};

type SearchMarket = "spot" | "perpetual";

type SymbolItem = { symbol: string; base: string; quote: string; markets: SearchMarket[] };

const FAVORITES: SymbolItem[] = MARKET_SYMBOLS.map((m) => ({
  symbol: m.symbol,
  base: m.base,
  quote: m.quote,
  markets: ["spot", "perpetual"],
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
    <div className="fixed inset-0 z-40 bg-[#081016]/72 backdrop-blur-md" onClick={onClose}>
      <Card
        className="absolute left-1/2 top-[8vh] w-[min(760px,94vw)] -translate-x-1/2 border border-[#2f3a47] bg-[#121922] py-0 text-white shadow-[0_32px_90px_rgba(0,0,0,0.52)]"
        onClick={(event) => event.stopPropagation()}
      >
        <CardHeader className="items-start justify-between border-b border-white/8 px-5 py-4">
          <div className="w-full space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Market directory</p>
                <h2 className="mt-1 text-lg font-medium tracking-[-0.03em] text-[#f3eee5]">切换交易标的</h2>
              </div>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                className="rounded-full border border-white/10 text-slate-400 hover:bg-white/6"
                onClick={onClose}
                aria-label="关闭搜索"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </Button>
            </div>
            <p className="text-sm leading-6 text-slate-400">
              现货和永续一起搜索。
            </p>
            <div className="relative">
              <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              {loading ? (
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                  <Spinner className="size-4 text-slate-400" />
                </span>
              ) : null}
              <Input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value.toUpperCase())}
                placeholder="搜索币种，如 BTC、XRPUSDT…"
                className="h-11 w-full rounded-2xl border-[#354252] bg-[#0d141b] pl-9 pr-9 text-slate-100 placeholder:text-slate-500"
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
        </CardHeader>
        <CardContent className="px-3 pb-3 pt-2">
          <ScrollArea className="max-h-[56vh] pr-1">
            <div className="space-y-2 pr-2">
              {!query.trim() ? (
                <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  常用币种
                </p>
              ) : null}
              {listItems.length === 0 && !loading ? (
                <p className="px-2 py-6 text-center text-sm text-slate-500">没有找到匹配的币种</p>
              ) : (
                <div className="grid gap-2 md:grid-cols-2">
                  {listItems.map((item) => {
                    const active = item.symbol === symbol;

                    return (
                      <Button
                        key={`${item.symbol}-${item.markets.join("-")}`}
                        type="button"
                        variant={active ? "secondary" : "ghost"}
                        className={`h-auto w-full justify-start rounded-2xl border px-3 py-3 ${
                          active
                            ? "border-[#4f647d] bg-[#1b2631] text-white"
                            : "border-white/6 text-slate-300 hover:bg-white/6 hover:text-white"
                        }`}
                        onClick={() => select(item.symbol)}
                      >
                        <div className="w-full text-left">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <span className="text-sm font-semibold">{item.base}</span>
                              <p className="mt-1 text-[11px] text-slate-500">{item.symbol}</p>
                            </div>
                            <div className="flex flex-wrap items-center justify-end gap-1.5">
                              <span className="rounded-full border border-white/8 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-slate-500">
                                {item.quote}
                              </span>
                              {item.markets.includes("spot") ? (
                                <span className="rounded-full border border-[#415164] bg-[#111923] px-2 py-0.5 text-[10px] tracking-[0.12em] text-slate-300">
                                  现货
                                </span>
                              ) : null}
                              {item.markets.includes("perpetual") ? (
                                <span className="rounded-full border border-[#8b7143]/28 bg-[#1a1814] px-2 py-0.5 text-[10px] tracking-[0.12em] text-[#d6c2a1]">
                                  永续
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

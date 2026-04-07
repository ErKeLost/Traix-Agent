"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { SparklesIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import {
  INTERVALS,
  type Candle,
  type MarketPayload,
  type MarketSymbol,
} from "@/lib/market";
import { formatPercent, formatPrice } from "./shared/format";

import { CandlestickChart } from "./candlestick-chart";
import { IntervalSelector } from "./interval-selector";
import { MarketSelector } from "./market-selector";

const ChatPanel = dynamic(
  () => import("./chat-panel").then((mod) => mod.ChatPanel),
  { ssr: false },
);

const CANDLE_LIMIT = 240;
const HISTORY_PAGE_SIZE = 300;
const RANGE_OPTIONS = [
  { key: "1d", label: "1天", seconds: 24 * 60 * 60 },
  { key: "3d", label: "3天", seconds: 3 * 24 * 60 * 60 },
  { key: "1w", label: "1周", seconds: 7 * 24 * 60 * 60 },
  { key: "1m", label: "1个月", seconds: 30 * 24 * 60 * 60 },
] as const;

type TimeRangeKey = (typeof RANGE_OPTIONS)[number]["key"];
type EventContractResult = {
  stance: "long" | "short" | "wait";
  label: "看多" | "看空" | "观望";
  confidence: number;
  contractQuestion: string;
  timeHorizon: string;
  thesis: string;
  drivers: string[];
  risks: string[];
};

export function TradingTerminal() {
  const [symbol, setSymbol] = useState<MarketSymbol>("BTCUSDT");
  const [interval, setInterval] = useState<(typeof INTERVALS)[number]>("1m");
  const [timeRange, setTimeRange] = useState<TimeRangeKey>("1d");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [status, setStatus] = useState<"loading" | "live" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoadingMoreHistory, setIsLoadingMoreHistory] = useState(false);
  const [historyExhausted, setHistoryExhausted] = useState(false);
  const [eventContractResult, setEventContractResult] = useState<EventContractResult | null>(null);
  const [eventContractLoading, setEventContractLoading] = useState(false);
  const [eventContractError, setEventContractError] = useState<string | null>(null);

  // 实时 tick 直接调用 chart 的 update()，完全绕过 React state，避免每秒全量 setData
  const chartUpdateRef = useRef<((candle: Candle) => void) | null>(null);
  const candlesRef = useRef<Candle[]>([]);
  const activeDatasetKeyRef = useRef("");
  const datasetKey = `${symbol}-${interval}-${timeRange}`;

  useEffect(() => {
    candlesRef.current = candles;
  }, [candles]);

  useEffect(() => {
    activeDatasetKeyRef.current = datasetKey;
  }, [datasetKey]);

  useEffect(() => {
    let cancelled = false;
    const requestDatasetKey = datasetKey;

    async function loadCandles() {
      setStatus((current) => (candlesRef.current.length === 0 ? "loading" : current));
      setErrorMessage(null);
      setIsLoadingMoreHistory(false);

      try {
        const rangeSeconds = RANGE_OPTIONS.find((item) => item.key === timeRange)?.seconds ?? 0;
        const intervalSeconds = getIntervalSeconds(interval);
        const rangeLimit = intervalSeconds > 0
          ? Math.ceil(rangeSeconds / intervalSeconds)
          : CANDLE_LIMIT;
        const limit = Math.max(CANDLE_LIMIT, Math.min(rangeLimit, 1500));
        const response = await fetch(
          `/api/market/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
        );

        if (!response.ok) {
          throw new Error("Unable to load klines.");
        }

        const payload = (await response.json()) as MarketPayload;

        if (!cancelled && activeDatasetKeyRef.current === requestDatasetKey) {
          setCandles(sortCandlesAsc(payload.candles));
          setHistoryExhausted(false);
          setIsLoadingMoreHistory(false);
          setStatus("live");
        }
      } catch {
        if (!cancelled && activeDatasetKeyRef.current === requestDatasetKey) {
          setStatus("error");
          setErrorMessage("K线数据暂时不可用。请检查网络或稍后重试。");
        }
      }
    }

    void loadCandles();

    return () => {
      cancelled = true;
    };
  }, [datasetKey, interval, symbol, timeRange]);

  async function loadMoreHistory() {
    const requestDatasetKey = activeDatasetKeyRef.current;
    const currentCandles = candlesRef.current;

    if (isLoadingMoreHistory || historyExhausted || currentCandles.length === 0) {
      return;
    }

    const earliestCandle = currentCandles[0];

    if (!earliestCandle) {
      return;
    }

    setIsLoadingMoreHistory(true);

    try {
      const endTime = earliestCandle.time * 1000 - 1;
      const response = await fetch(
        `/api/market/klines?symbol=${symbol}&interval=${interval}&limit=${HISTORY_PAGE_SIZE}&endTime=${endTime}`,
      );

      if (!response.ok) {
        throw new Error("Unable to load more history.");
      }

      const payload = (await response.json()) as MarketPayload;
      const olderCandles = payload.candles.filter((item) => item.time < earliestCandle.time);

      if (activeDatasetKeyRef.current !== requestDatasetKey) {
        return;
      }

      if (olderCandles.length === 0) {
        setHistoryExhausted(true);
        return;
      }

      setCandles((current) => {
        if (activeDatasetKeyRef.current !== requestDatasetKey) {
          return current;
        }

        return mergeOlderCandles(current, olderCandles);
      });

      if (
        olderCandles.length < HISTORY_PAGE_SIZE &&
        activeDatasetKeyRef.current === requestDatasetKey
      ) {
        setHistoryExhausted(true);
      }
    } catch {
      if (activeDatasetKeyRef.current === requestDatasetKey) {
        setErrorMessage("加载更早历史数据失败。");
      }
    } finally {
      if (activeDatasetKeyRef.current === requestDatasetKey) {
        setIsLoadingMoreHistory(false);
      }
    }
  }

  useEffect(() => {
    const streamBase = symbol.toLowerCase();
    const stream = `${streamBase}@kline_${interval}`;
    const wsUrls = [
      `wss://stream.binance.com:9443/stream?streams=${stream}`,
      `wss://stream.binance.com:443/stream?streams=${stream}`,
      `wss://ws-api.binance.com:443/stream?streams=${stream}`,
      `wss://data-stream.binance.vision:9443/stream?streams=${stream}`,
    ];

    let cancelled = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let connectTimeout: ReturnType<typeof setTimeout> | null = null;
    let workingIndex = 0;
    let reconnectDelay = 2000;

    function connect(urlIndex: number) {
      if (cancelled || urlIndex >= wsUrls.length) {
        return;
      }

      if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        socket.close();
        socket = null;
      }

      socket = new WebSocket(wsUrls[urlIndex]);
      connectTimeout = setTimeout(() => {
        if (!cancelled && socket?.readyState !== WebSocket.OPEN) {
          socket?.close();
          connect(urlIndex + 1);
        }
      }, 5000);

      socket.onopen = () => {
        if (cancelled) {
          return;
        }

        if (connectTimeout) {
          clearTimeout(connectTimeout);
        }

        workingIndex = urlIndex;
        reconnectDelay = 2000;
        setStatus("live");
        setErrorMessage(null);
      };

      socket.onmessage = (event) => {
        const packet = JSON.parse(event.data) as {
          stream?: string;
          data?: Record<string, unknown>;
        };
        const data = packet.data;

        if (!data || !packet.stream?.endsWith(`@kline_${interval}`)) {
          return;
        }

        const candle = data.k as {
          t: number;
          o: string;
          h: string;
          l: string;
          c: string;
          v: string;
        } | undefined;

        if (!candle) {
          return;
        }

        const parsedCandle: Candle = {
          time: Math.floor(candle.t / 1000),
          open: Number(candle.o),
          high: Number(candle.h),
          low: Number(candle.l),
          close: Number(candle.c),
          volume: Number(candle.v),
        };

        // 优先直接调用 chart.update()，零 React re-render
        // 仅当图表尚未初始化时回退到 state 更新
        if (chartUpdateRef.current) {
          chartUpdateRef.current(parsedCandle);
        } else {
          setCandles((current) => mergeRealtimeCandle(current, parsedCandle));
        }
      };

      socket.onerror = () => {
        if (connectTimeout) {
          clearTimeout(connectTimeout);
        }
      };

      socket.onclose = () => {
        if (cancelled) {
          return;
        }

        if (connectTimeout) {
          clearTimeout(connectTimeout);
        }

        setStatus((current) => (current === "loading" ? current : "error"));
        setErrorMessage("实时流断开，正在重连…");
        reconnectTimer = setTimeout(() => {
          if (cancelled) {
            return;
          }

          reconnectDelay = Math.min(reconnectDelay * 1.5, 30000);
          connect(workingIndex);
        }, reconnectDelay);
      };
    }

    connect(0);

    return () => {
      cancelled = true;

      if (connectTimeout) {
        clearTimeout(connectTimeout);
      }

      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }

      if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        socket.close();
      }
    };
  }, [symbol, interval]);

  const displaySymbol = useMemo(() => formatDisplaySymbol(symbol), [symbol]);
  const marketSnapshot = useMemo(() => {
    const first = candles[0];
    const last = candles.at(-1);

    if (!first || !last) {
      return {
        priceLabel: "--",
        changeLabel: "0.00%",
        changeTone: "text-slate-500",
      };
    }

    const delta = first.open > 0
      ? ((last.close - first.open) / first.open) * 100
      : 0;

    return {
      priceLabel: formatPrice(last.close),
      changeLabel: formatPercent(delta),
      changeTone:
        delta > 0
          ? "text-emerald-300"
          : delta < 0
            ? "text-rose-300"
            : "text-slate-400",
    };
  }, [candles]);
  const [searchOpen, setSearchOpen] = useState(false);

  async function analyzeEventContract() {
    setEventContractLoading(true);
    setEventContractError(null);

    try {
      const response = await fetch("/api/event-contract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          symbol,
          interval,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        result?: EventContractResult;
      };

      if (!response.ok || !payload.result) {
        throw new Error(payload.error ?? "事件合约分析失败。");
      }

      setEventContractResult(payload.result);
    } catch (error) {
      setEventContractError(error instanceof Error ? error.message : "事件合约分析失败。");
    } finally {
      setEventContractLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#0f141a]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-12%] top-[-10%] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(201,160,94,0.16),transparent_58%)] blur-3xl" />
        <div className="absolute right-[-8%] top-[2%] h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(circle,rgba(109,143,179,0.18),transparent_62%)] blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/26 to-transparent" />
      </div>

      <div className="absolute inset-0">
        <CandlestickChart
          key={datasetKey}
          candles={candles}
          resetKey={datasetKey}
          onLoadMore={loadMoreHistory}
          isLoadingMore={isLoadingMoreHistory}
          updateRef={chartUpdateRef}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-4 px-4 pb-10 pt-4">
        <Button
          variant="secondary"
          className="pointer-events-auto h-auto min-w-[18rem] justify-start rounded-[24px] border border-white/10 bg-[#121922]/92 px-4 py-3 text-left text-[#f2ede4] shadow-[0_18px_60px_rgba(0,0,0,0.34)] backdrop-blur-xl transition-colors hover:bg-[#18202a]"
          onClick={() => setSearchOpen(true)}
        >
          <div className="flex w-full items-start justify-between gap-5">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-[#3c4a5c] bg-[#1c2530] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.26em] text-[#c9a05e]">
                  Desk
                </span>
                <span className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                  Binance market stream
                </span>
              </div>
              <div className="flex items-end gap-3">
                <span className="text-2xl font-semibold tracking-[-0.04em] text-[#f3eee5]">
                  {displaySymbol}
                </span>
                <span className="pb-0.5 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  Switch
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm text-slate-200 tabular-nums">
                  {marketSnapshot.priceLabel}
                </span>
                <span className={`text-xs font-semibold ${marketSnapshot.changeTone}`}>
                  {marketSnapshot.changeLabel}
                </span>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              <span
                suppressHydrationWarning
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.22em] ${
                  status === "live"
                    ? "border-emerald-500/25 bg-emerald-500/12 text-emerald-200"
                    : status === "error"
                      ? "border-amber-500/25 bg-amber-500/12 text-amber-200"
                      : "border-white/8 bg-white/5 text-slate-400"
                }`}
              >
                <span
                  suppressHydrationWarning
                  className={`h-1.5 w-1.5 rounded-full ${
                    status === "live"
                      ? "bg-emerald-400"
                      : status === "error"
                        ? "bg-amber-400"
                        : "bg-slate-500"
                  }`}
                />
                {statusLabel(status)}
              </span>
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/8 bg-black/10 text-slate-500">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
              </span>
            </div>
          </div>
        </Button>

        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <div className="flex items-center rounded-[24px] border border-white/10 bg-[#121922]/90 p-2 shadow-[0_18px_60px_rgba(0,0,0,0.34)] backdrop-blur-xl">
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={(value) => {
              if (value) {
                setTimeRange(value as TimeRangeKey);
                setEventContractResult(null);
                setEventContractError(null);
              }
            }}
            size="sm"
            variant="default"
            spacing={0}
            className="rounded-[18px] bg-black/10"
          >
            {RANGE_OPTIONS.map((item) => (
              <ToggleGroupItem
                key={item.key}
                value={item.key}
                className="h-8 min-w-0 px-3 text-[11px] font-medium tracking-[0.04em] text-slate-400 data-[state=on]:bg-[#2f3843] data-[state=on]:text-[#f4efe7] hover:bg-white/6 hover:text-white"
                aria-label={item.label}
              >
                {item.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <div className="mx-2 h-5 w-px shrink-0 bg-white/10" />
          <IntervalSelector
            interval={interval}
            onIntervalChange={(nextInterval) => {
              setInterval(nextInterval);
              setEventContractResult(null);
              setEventContractError(null);
            }}
          />
          <div className="mx-2 h-5 w-px shrink-0 bg-white/10" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void analyzeEventContract()}
            disabled={eventContractLoading}
            className="h-8 rounded-[14px] bg-[#1a2028] px-3 text-[11px] font-medium tracking-[0.04em] text-[#e9ded1] hover:bg-[#232b35] hover:text-white disabled:opacity-60"
          >
            <SparklesIcon className="mr-1.5 size-3.5" />
            {eventContractLoading ? "分析中..." : "事件合约"}
          </Button>
          </div>

          {eventContractResult || eventContractError ? (
            <div className="mt-2 w-full max-w-[24rem] rounded-[22px] bg-[#111821]/92 px-4 py-3 shadow-[0_16px_48px_rgba(0,0,0,0.34)] backdrop-blur-xl">
              {eventContractError ? (
                <p className="text-sm text-amber-300">{eventContractError}</p>
              ) : eventContractResult ? (
                <EventContractCard result={eventContractResult} symbol={displaySymbol} />
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 z-10 rounded-full border border-white/8 bg-[#121922]/78 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-slate-500 shadow-[0_12px_40px_rgba(0,0,0,0.22)] backdrop-blur-xl">
        {errorMessage ? (
          <span className="text-amber-400">{errorMessage}</span>
        ) : isLoadingMoreHistory ? (
          "加载历史中…"
        ) : historyExhausted ? (
          "已到最早数据"
        ) : (
          "向左拖动加载更早 K 线"
        )}
      </div>

      {/* Symbol search modal */}
      <MarketSelector
        open={searchOpen}
        symbol={symbol}
        onSymbolChange={(nextSymbol) => {
          setSymbol(nextSymbol);
          setEventContractResult(null);
          setEventContractError(null);
        }}
        onClose={() => setSearchOpen(false)}
      />

      <ChatPanel symbol={symbol} interval={interval} />
    </div>
  );
}

function mergeRealtimeCandle(current: Candle[], next: Candle) {
  return sortCandlesAsc([...current, next]).slice(-CANDLE_LIMIT);
}

function mergeOlderCandles(current: Candle[], older: Candle[]) {
  return sortCandlesAsc([...older, ...current]);
}

function sortCandlesAsc(items: Candle[]) {
  const deduped = new Map<number, Candle>();

  for (const item of items) {
    deduped.set(item.time, item);
  }

  return Array.from(deduped.values()).sort((left, right) => left.time - right.time);
}

function getIntervalSeconds(interval: (typeof INTERVALS)[number]) {
  if (interval.endsWith("s")) {
    return Number(interval.slice(0, -1));
  }

  if (interval.endsWith("m")) {
    return Number(interval.slice(0, -1)) * 60;
  }

  if (interval.endsWith("h")) {
    return Number(interval.slice(0, -1)) * 60 * 60;
  }

  if (interval.endsWith("d")) {
    return Number(interval.slice(0, -1)) * 24 * 60 * 60;
  }

  return 0;
}

function statusLabel(status: "loading" | "live" | "error") {
  if (status === "loading") {
    return "Loading";
  }

  if (status === "error") {
    return "Feed Error";
  }

  return "Live Feed";
}

function formatDisplaySymbol(symbol: MarketSymbol) {
  const match = symbol.match(/^([A-Z0-9]+?)(USDT|USDC|BUSD|BTC|ETH)$/);

  if (!match) {
    return symbol;
  }

  return `${match[1]}/${match[2]}`;
}

function EventContractCard({
  result,
  symbol,
}: {
  result: EventContractResult;
  symbol: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[#b79481]">
            Event Contract
          </p>
          <p className="mt-1 text-sm font-medium text-[#f3eee5]">{symbol}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${getEventContractTone(result.stance)}`}>
          {result.label}
        </span>
      </div>

      <div className="space-y-1">
        <p className="text-sm leading-6 text-[#e8edf3]">{result.contractQuestion}</p>
        <div className="flex items-center gap-3 text-xs text-[#8e99a8]">
          <span>{result.timeHorizon}</span>
          <span>置信度 {result.confidence}%</span>
        </div>
      </div>

      <p className="text-sm leading-6 text-[#d8e0ea]">{result.thesis}</p>

      <div className="space-y-1.5">
        {result.drivers.map((item) => (
          <p key={item} className="text-xs leading-5 text-[#98a4b2]">
            {item}
          </p>
        ))}
      </div>

      <div className="space-y-1">
        {result.risks.map((item) => (
          <p key={item} className="text-xs leading-5 text-[#b99585]">
            风险: {item}
          </p>
        ))}
      </div>
    </div>
  );
}

function getEventContractTone(stance: EventContractResult["stance"]) {
  if (stance === "long") {
    return "bg-emerald-500/12 text-emerald-200";
  }

  if (stance === "short") {
    return "bg-rose-500/12 text-rose-200";
  }

  return "bg-amber-500/12 text-amber-200";
}

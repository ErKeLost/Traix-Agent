"use client";

import dynamic from "next/dynamic";
import { Button, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  INTERVALS,
  type Candle,
  type MarketPayload,
  type MarketSymbol,
} from "@/lib/market";

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

export function TradingTerminal() {
  const [symbol, setSymbol] = useState<MarketSymbol>("BTCUSDT");
  const [interval, setInterval] = useState<(typeof INTERVALS)[number]>("1m");
  const [timeRange, setTimeRange] = useState<TimeRangeKey>("1d");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [status, setStatus] = useState<"loading" | "live" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoadingMoreHistory, setIsLoadingMoreHistory] = useState(false);
  const [historyExhausted, setHistoryExhausted] = useState(false);

  // 实时 tick 直接调用 chart 的 update()，完全绕过 React state，避免每秒全量 setData
  const chartUpdateRef = useRef<((candle: Candle) => void) | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCandles() {
      setStatus((current) => (candles.length === 0 ? "loading" : current));
      setErrorMessage(null);

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

        if (!cancelled) {
          setCandles(payload.candles);
          setHistoryExhausted(false);
          setIsLoadingMoreHistory(false);
          setStatus("live");
        }
      } catch {
        if (!cancelled) {
          setStatus("error");
          setErrorMessage("K线数据暂时不可用。请检查网络或稍后重试。");
        }
      }
    }

    void loadCandles();

    return () => {
      cancelled = true;
    };
  }, [symbol, interval, timeRange]);

  async function loadMoreHistory() {
    if (isLoadingMoreHistory || historyExhausted || candles.length === 0) {
      return;
    }

    const earliestCandle = candles[0];

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

      if (olderCandles.length === 0) {
        setHistoryExhausted(true);
        return;
      }

      setCandles((current) => mergeOlderCandles(current, olderCandles));

      if (olderCandles.length < HISTORY_PAGE_SIZE) {
        setHistoryExhausted(true);
      }
    } catch {
      setErrorMessage("加载更早历史数据失败。");
    } finally {
      setIsLoadingMoreHistory(false);
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
  const [searchOpen, setSearchOpen] = useState(false);

  const selectedTimeRange = useMemo(() => new Set([timeRange]), [timeRange]);

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#08111f]">
      {/* Full-screen chart */}
      <div className="absolute inset-0">
        <CandlestickChart
          key={symbol}
          candles={candles}
          resetKey={`${symbol}-${interval}`}
          onLoadMore={loadMoreHistory}
          isLoadingMore={isLoadingMoreHistory}
          updateRef={chartUpdateRef}
        />
      </div>

      {/* Top overlay bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 bg-gradient-to-b from-[#08111f]/95 via-[#08111f]/60 to-transparent px-4 pb-6 pt-3">
        {/* Left: symbol + status */}
        <Button
          variant="secondary"
          className="pointer-events-auto h-auto min-w-0 justify-start gap-2.5 rounded-xl bg-white/5 px-3 py-2 text-left transition-colors hover:bg-white/10"
          onClick={() => setSearchOpen(true)}
        >
          <span className="text-base font-bold text-white">{displaySymbol}</span>
          <span
            suppressHydrationWarning
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest ${
              status === "live"
                ? "bg-emerald-500/15 text-emerald-300"
                : status === "error"
                  ? "bg-amber-500/15 text-amber-300"
                  : "bg-white/8 text-slate-400"
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
          <svg className="h-3 w-3 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
        </Button>

        {/* Right: time range + interval in one connected bar */}
        <div className="pointer-events-auto flex items-center rounded-lg border border-white/15 bg-[#0f1c31]/80 p-1">
          <ToggleButtonGroup
            size="sm"
            selectionMode="single"
            selectedKeys={selectedTimeRange}
            onSelectionChange={(keys) => {
              const next =
                keys instanceof Set ? Array.from(keys)[0] : keys;

              if (typeof next === "string") {
                setTimeRange(next as TimeRangeKey);
              }
            }}
          >
            {RANGE_OPTIONS.map((item, index) => (
              <ToggleButton
                key={item.key}
                id={item.key}
                variant="ghost"
                className="h-7 min-w-0 rounded-md px-2.5 text-xs text-slate-300"
                aria-label={item.label}
              >
                {index > 0 ? <ToggleButtonGroup.Separator /> : null}
                {item.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
          <div className="mx-1.5 h-4 w-px shrink-0 bg-white/20" />
          <IntervalSelector interval={interval} onIntervalChange={setInterval} />
        </div>
      </div>

      {/* Bottom-left hint */}
      <div className="pointer-events-none absolute bottom-3 left-4 z-10 text-[10px] text-slate-600">
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
        onSymbolChange={setSymbol}
        onClose={() => setSearchOpen(false)}
      />

      <ChatPanel symbol={symbol} interval={interval} />
    </div>
  );
}

function mergeRealtimeCandle(current: Candle[], next: Candle) {
  if (current.length === 0) {
    return [next];
  }

  const last = current.at(-1);

  if (!last) {
    return [next];
  }

  if (last.time === next.time) {
    return [...current.slice(0, -1), next];
  }

  return [...current.slice(-(CANDLE_LIMIT - 1)), next];
}

function mergeOlderCandles(current: Candle[], older: Candle[]) {
  const seen = new Set(current.map((item) => item.time));
  const uniqueOlder = older.filter((item) => !seen.has(item.time));
  return [...uniqueOlder, ...current];
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

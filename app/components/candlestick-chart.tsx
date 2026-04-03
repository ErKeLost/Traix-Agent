"use client";

import React, { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  createChart,
  type IChartApi,
  type LogicalRange,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";

import type { Candle } from "@/lib/market";

type CandlestickChartProps = {
  candles: Candle[];
  resetKey: string;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  /** 传入此 ref 后，调用方可直接调用 ref.current(candle) 更新最后一根 K 线，
   *  完全绕过 React state，避免每个 tick 触发全量 setData */
  updateRef?: React.MutableRefObject<((candle: Candle) => void) | null>;
};

export function CandlestickChart({
  candles,
  resetKey,
  onLoadMore,
  isLoadingMore = false,
  updateRef,
}: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const previousResetKeyRef = useRef<string | null>(null);
  const isLoadingMoreRef = useRef(false);
  const onLoadMoreRef = useRef<CandlestickChartProps["onLoadMore"]>(onLoadMore);

  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  }, [onLoadMore]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "#08111f" },
        textColor: "#94a3b8",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(148, 163, 184, 0.08)" },
        horzLines: { color: "rgba(148, 163, 184, 0.08)" },
      },
      crosshair: {
        vertLine: { color: "rgba(148, 163, 184, 0.35)" },
        horzLine: { color: "rgba(148, 163, 184, 0.35)" },
      },
      rightPriceScale: {
        borderColor: "rgba(148, 163, 184, 0.18)",
      },
      timeScale: {
        borderColor: "rgba(148, 163, 184, 0.18)",
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
      priceLineVisible: true,
      lastValueVisible: true,
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: {
        type: "volume",
      },
      priceScaleId: "",
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.82,
        bottom: 0,
      },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    // 注册实时单根 K 线 update 函数，调用方可通过 ref 直接更新，绕过 React state
    if (updateRef) {
      updateRef.current = (candle: Candle) => {
        candleSeries.update({
          time: candle.time as UTCTimestamp,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
        });
        volumeSeries.update({
          time: candle.time as UTCTimestamp,
          value: candle.volume,
          color:
            candle.close >= candle.open
              ? "rgba(34, 197, 94, 0.45)"
              : "rgba(239, 68, 68, 0.45)",
        });
      };
    }

    const handleVisibleRangeChange = (range: LogicalRange | null) => {
      if (!range || !onLoadMoreRef.current || isLoadingMoreRef.current) {
        return;
      }

      if (range.from < 20) {
        isLoadingMoreRef.current = true;
        onLoadMoreRef.current();
      }
    };

    chart.timeScale().subscribeVisibleLogicalRangeChange(handleVisibleRangeChange);

    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      if (updateRef) {
        updateRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isLoadingMore) {
      isLoadingMoreRef.current = false;
    }
  }, [isLoadingMore]);

  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    const chart = chartRef.current;

    if (!candleSeries || !volumeSeries || !chart) {
      return;
    }

    candleSeries.setData(
      candles.map((candle) => ({
        time: candle.time as UTCTimestamp,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      })),
    );

    volumeSeries.setData(
      candles.map((candle) => ({
        time: candle.time as UTCTimestamp,
        value: candle.volume,
        color:
          candle.close >= candle.open
            ? "rgba(34, 197, 94, 0.45)"
            : "rgba(239, 68, 68, 0.45)",
      })),
    );

    if (previousResetKeyRef.current !== resetKey) {
      chart.timeScale().fitContent();
      previousResetKeyRef.current = resetKey;
    }
  }, [candles, resetKey]);

  return <div ref={containerRef} className="chart-shell h-full min-h-[430px] w-full" />;
}

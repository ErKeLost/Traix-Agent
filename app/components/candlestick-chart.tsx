"use client";

import React, { useEffect, useRef } from "react";
import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  type TickMarkType,
  createChart,
  type IChartApi,
  type LogicalRange,
  type ISeriesApi,
  type Time,
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

const BEIJING_LOCALE = "zh-CN";
const BEIJING_TIME_ZONE = "Asia/Shanghai";

const beijingTimeFormatter = new Intl.DateTimeFormat(BEIJING_LOCALE, {
  timeZone: BEIJING_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const beijingTimeOnlyFormatter = new Intl.DateTimeFormat(BEIJING_LOCALE, {
  timeZone: BEIJING_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const beijingDateTimeFormatter = new Intl.DateTimeFormat(BEIJING_LOCALE, {
  timeZone: BEIJING_TIME_ZONE,
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const beijingDateFormatter = new Intl.DateTimeFormat(BEIJING_LOCALE, {
  timeZone: BEIJING_TIME_ZONE,
  year: "2-digit",
  month: "numeric",
  day: "numeric",
});

function toBeijingDate(time: Time) {
  if (typeof time === "number") {
    return new Date(time * 1000);
  }

  if ("timestamp" in time && typeof time.timestamp === "number") {
    return new Date(time.timestamp * 1000);
  }

  return new Date(Date.UTC(time.year, time.month - 1, time.day));
}

function formatTickMark(time: Time, tickMarkType: TickMarkType) {
  const date = toBeijingDate(time);

  if (
    tickMarkType === "time" ||
    tickMarkType === "time-with-seconds" ||
    tickMarkType === "minute1" ||
    tickMarkType === "minute5" ||
    tickMarkType === "minute30" ||
    tickMarkType === "hour1" ||
    tickMarkType === "hour3" ||
    tickMarkType === "hour6" ||
    tickMarkType === "hour12"
  ) {
    return beijingTimeOnlyFormatter.format(date);
  }

  if (tickMarkType === "day-of-month") {
    return beijingDateTimeFormatter.format(date);
  }

  return beijingDateFormatter.format(date);
}

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

    const container = containerRef.current;
    const chart = createChart(container, {
      width: Math.max(1, Math.floor(container.clientWidth)),
      height: Math.max(1, Math.floor(container.clientHeight)),
      layout: {
        background: { type: ColorType.Solid, color: "#0f141a" },
        textColor: "#8f9bad",
        attributionLogo: false,
      },
      localization: {
        locale: BEIJING_LOCALE,
        dateFormat: "yyyy-MM-dd",
        timeFormatter: (time) => beijingTimeFormatter.format(toBeijingDate(time)),
      },
      grid: {
        vertLines: { color: "rgba(143, 155, 173, 0.06)" },
        horzLines: { color: "rgba(143, 155, 173, 0.06)" },
      },
      crosshair: {
        vertLine: { color: "rgba(201, 160, 94, 0.22)" },
        horzLine: { color: "rgba(201, 160, 94, 0.22)" },
      },
      rightPriceScale: {
        borderColor: "rgba(143, 155, 173, 0.14)",
      },
      timeScale: {
        borderColor: "rgba(143, 155, 173, 0.14)",
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time, tickMarkType) => formatTickMark(time, tickMarkType),
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#49b88f",
      downColor: "#cd7278",
      borderVisible: false,
      wickUpColor: "#49b88f",
      wickDownColor: "#cd7278",
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

    const syncChartSize = () => {
      const target = containerRef.current;

      if (!target || !chartRef.current) {
        return;
      }

      const rect = target.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));

      chartRef.current.resize(width, height);
    };

    syncChartSize();
    const frame = requestAnimationFrame(syncChartSize);
    const resizeObserver = new ResizeObserver(() => {
      syncChartSize();
    });
    resizeObserver.observe(container);
    container.addEventListener("pointerenter", syncChartSize);
    window.addEventListener("resize", syncChartSize);
    window.visualViewport?.addEventListener("resize", syncChartSize);
    window.visualViewport?.addEventListener("scroll", syncChartSize);

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
              ? "rgba(73, 184, 143, 0.34)"
              : "rgba(205, 114, 120, 0.34)",
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
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      container.removeEventListener("pointerenter", syncChartSize);
      window.removeEventListener("resize", syncChartSize);
      window.visualViewport?.removeEventListener("resize", syncChartSize);
      window.visualViewport?.removeEventListener("scroll", syncChartSize);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      if (updateRef) {
        updateRef.current = null;
      }
    };
  }, [updateRef]);

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

    const orderedCandles = [...candles].sort((left, right) => left.time - right.time);

    candleSeries.setData(
      orderedCandles.map((candle) => ({
        time: candle.time as UTCTimestamp,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      })),
    );

    volumeSeries.setData(
      orderedCandles.map((candle) => ({
        time: candle.time as UTCTimestamp,
        value: candle.volume,
        color:
          candle.close >= candle.open
            ? "rgba(73, 184, 143, 0.34)"
            : "rgba(205, 114, 120, 0.34)",
      })),
    );

    if (previousResetKeyRef.current !== resetKey) {
      chart.timeScale().fitContent();
      previousResetKeyRef.current = resetKey;
    }
  }, [candles, resetKey]);

  return <div ref={containerRef} className="chart-shell h-full min-h-[430px] w-full" />;
}

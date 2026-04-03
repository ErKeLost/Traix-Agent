import { buildMarketAnalysis, buildTimeframeSummary } from "@/lib/analysis";
import { fetchBinanceCandles, fetchBinanceSnapshot } from "@/lib/binance-public";
import { fetchDerivativesSnapshot } from "@/lib/derivatives";
import { fetchLatestHeadlines } from "@/lib/news";
import {
  ANALYSIS_INTERVALS,
  type DerivativesSnapshot,
  type MarketAnalysisPayload,
  type MarketInterval,
  type MarketSymbol,
  type Ticker24h,
} from "@/lib/market";

export async function buildRulesOnlyMarketAnalysis(
  symbol: MarketSymbol,
  interval: MarketInterval,
) {
  const intervalSet = Array.from(new Set([interval, ...ANALYSIS_INTERVALS]));
  const candles = await fetchBinanceCandles(symbol, interval, 240);

  const [snapshotResult, headlinesResult, derivativesResult, multiTimeframeResults] =
    await Promise.allSettled([
      fetchBinanceSnapshot(symbol),
      fetchLatestHeadlines(),
      fetchDerivativesSnapshot(symbol),
      Promise.all(
        intervalSet.map(async (currentInterval) => ({
          interval: currentInterval,
          candles: await fetchBinanceCandles(symbol, currentInterval, 240),
        })),
      ),
    ]);

  const snapshot =
    snapshotResult.status === "fulfilled"
      ? snapshotResult.value
      : buildFallbackSnapshot(candles);

  const headlines = headlinesResult.status === "fulfilled" ? headlinesResult.value : [];
  const derivatives =
    derivativesResult.status === "fulfilled"
      ? derivativesResult.value
      : buildFallbackDerivativesSnapshot();

  const multiTimeframeCandles =
    multiTimeframeResults.status === "fulfilled"
      ? multiTimeframeResults.value.filter((item) => item.candles.length > 0)
      : [];

  return buildMarketAnalysis({
    symbol,
    interval,
    candles,
    ticker24h: snapshot.ticker24h,
    bids: snapshot.bids,
    asks: snapshot.asks,
    trades: snapshot.trades,
    headlines,
    multiTimeframe: multiTimeframeCandles.map((item) =>
      buildTimeframeSummary({
        interval: item.interval,
        candles: item.candles,
        ticker24h: snapshot.ticker24h,
        bids: snapshot.bids,
        asks: snapshot.asks,
        trades: snapshot.trades,
        derivatives,
      }),
    ),
    derivatives,
  }) satisfies MarketAnalysisPayload;
}

function buildFallbackSnapshot(candles: Awaited<ReturnType<typeof fetchBinanceCandles>>) {
  const last = candles.at(-1);
  const previous = candles.at(-2);
  const highPrice = candles.reduce((max, candle) => Math.max(max, candle.high), 0);
  const lowPrice =
    candles.length > 0
      ? candles.reduce((min, candle) => Math.min(min, candle.low), Number.POSITIVE_INFINITY)
      : 0;
  const volume = candles.reduce((sum, candle) => sum + candle.volume, 0);
  const weightedAveragePrice =
    candles.length > 0
      ? candles.reduce((sum, candle) => sum + candle.close, 0) / candles.length
      : 0;

  return {
    ticker24h: {
      lastPrice: last?.close ?? 0,
      priceChangePercent:
        previous && previous.close !== 0
          ? (((last?.close ?? previous.close) - previous.close) / previous.close) * 100
          : 0,
      highPrice,
      lowPrice: Number.isFinite(lowPrice) ? lowPrice : 0,
      volume,
      quoteVolume: volume * (last?.close ?? 0),
      weightedAveragePrice,
    } satisfies Ticker24h,
    bookTicker: {
      bidPrice: last?.close ?? 0,
      bidQuantity: 0,
      askPrice: last?.close ?? 0,
      askQuantity: 0,
    },
    bids: [],
    asks: [],
    trades: [],
  };
}

function buildFallbackDerivativesSnapshot(): DerivativesSnapshot {
  return {
    openInterest: 0,
    openInterestTime: Date.now(),
    openInterestValue: 0,
    openInterestChangePercent: 0,
    fundingRate: 0,
    fundingTime: Date.now(),
    markPrice: 0,
    longShortRatio: 0,
    longAccount: 0,
    shortAccount: 0,
    globalLongShortRatio: 0,
    globalLongAccount: 0,
    globalShortAccount: 0,
    topPositionLongShortRatio: 0,
    topRatioTime: Date.now(),
    takerBuySellRatio: 0,
    takerBuyVolume: 0,
    takerSellVolume: 0,
    takerRatioTime: Date.now(),
  };
}

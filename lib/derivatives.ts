import type { DerivativesSnapshot, MarketSymbol } from "@/lib/market";

const BINANCE_FUTURES_API_BASE = "https://fapi.binance.com";
const FUTURES_TIMEOUT_MS = 5000;

export async function fetchDerivativesSnapshot(symbol: MarketSymbol) {
  const [
    openInterestRaw,
    fundingRaw,
    topRatioRaw,
    globalRatioRaw,
    topPositionRatioRaw,
    takerRaw,
    openInterestHistoryRaw,
  ] = await Promise.all([
    fetchFutures<{ openInterest: string; symbol: string; time: number }>(
      `/fapi/v1/openInterest?symbol=${symbol}`,
    ),
    fetchFutures<
      Array<{
        fundingRate: string;
        fundingTime: number;
        markPrice: string;
      }>
    >(`/fapi/v1/fundingRate?symbol=${symbol}&limit=1`),
    fetchFutures<
      Array<{
        longShortRatio: string;
        longAccount: string;
        shortAccount: string;
        timestamp: string;
      }>
    >(`/futures/data/topLongShortAccountRatio?symbol=${symbol}&period=1h&limit=1`),
    fetchFutures<
      Array<{
        longShortRatio: string;
        longAccount: string;
        shortAccount: string;
        timestamp: string;
      }>
    >(`/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=1h&limit=1`),
    fetchFutures<
      Array<{
        longShortRatio: string;
        longAccount: string;
        shortAccount: string;
        timestamp: string;
      }>
    >(`/futures/data/topLongShortPositionRatio?symbol=${symbol}&period=1h&limit=1`),
    fetchFutures<
      Array<{
        buySellRatio: string;
        buyVol: string;
        sellVol: string;
        timestamp: string;
      }>
    >(`/futures/data/takerlongshortRatio?symbol=${symbol}&period=5m&limit=1`),
    fetchFutures<
      Array<{
        sumOpenInterest: string;
        sumOpenInterestValue: string;
        timestamp: string;
      }>
    >(`/futures/data/openInterestHist?symbol=${symbol}&period=5m&limit=2`),
  ]);

  const latestFunding = fundingRaw[0];
  const latestTopRatio = topRatioRaw[0];
  const latestGlobalRatio = globalRatioRaw[0];
  const latestTopPositionRatio = topPositionRatioRaw[0];
  const latestTaker = takerRaw[0];
  const latestOpenInterestHist = openInterestHistoryRaw[0];
  const previousOpenInterestHist = openInterestHistoryRaw[1];
  const latestOiValue = Number(latestOpenInterestHist?.sumOpenInterestValue ?? 0);
  const previousOiValue = Number(previousOpenInterestHist?.sumOpenInterestValue ?? latestOiValue);
  const openInterestChangePercent =
    previousOiValue === 0 ? 0 : ((latestOiValue - previousOiValue) / previousOiValue) * 100;

  const snapshot: DerivativesSnapshot = {
    openInterest: Number(openInterestRaw.openInterest ?? 0),
    openInterestTime: openInterestRaw.time ?? Date.now(),
    openInterestValue: latestOiValue,
    openInterestChangePercent,
    fundingRate: Number(latestFunding?.fundingRate ?? 0),
    fundingTime: latestFunding?.fundingTime ?? Date.now(),
    markPrice: Number(latestFunding?.markPrice ?? 0),
    longShortRatio: Number(latestTopRatio?.longShortRatio ?? 0),
    longAccount: Number(latestTopRatio?.longAccount ?? 0),
    shortAccount: Number(latestTopRatio?.shortAccount ?? 0),
    globalLongShortRatio: Number(latestGlobalRatio?.longShortRatio ?? 0),
    globalLongAccount: Number(latestGlobalRatio?.longAccount ?? 0),
    globalShortAccount: Number(latestGlobalRatio?.shortAccount ?? 0),
    topPositionLongShortRatio: Number(latestTopPositionRatio?.longShortRatio ?? 0),
    topRatioTime: Number(latestTopRatio?.timestamp ?? Date.now()),
    takerBuySellRatio: Number(latestTaker?.buySellRatio ?? 0),
    takerBuyVolume: Number(latestTaker?.buyVol ?? 0),
    takerSellVolume: Number(latestTaker?.sellVol ?? 0),
    takerRatioTime: Number(latestTaker?.timestamp ?? Date.now()),
  };

  return snapshot;
}

async function fetchFutures<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, FUTURES_TIMEOUT_MS);

  const response = await fetch(`${BINANCE_FUTURES_API_BASE}${path}`, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
    signal: controller.signal,
  }).finally(() => {
    clearTimeout(timeout);
  });

  if (!response.ok) {
    throw new Error(`Binance Futures returned ${response.status} for ${path}`);
  }

  return (await response.json()) as T;
}

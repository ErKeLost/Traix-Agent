import { NextRequest } from "next/server";

import { fetchBinanceCandles } from "@/lib/binance-public";
import {
  isMarketInterval,
  normalizeMarketSymbol,
  type MarketInterval,
  type MarketPayload,
  type MarketSymbol,
} from "@/lib/market";

const DEFAULT_SYMBOL: MarketSymbol = "BTCUSDT";
const DEFAULT_INTERVAL: MarketInterval = "1h";
const DEFAULT_LIMIT = 200;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const rawSymbol = searchParams.get("symbol") ?? DEFAULT_SYMBOL;
  const rawInterval = searchParams.get("interval") ?? DEFAULT_INTERVAL;
  const rawLimit = Number(searchParams.get("limit") ?? DEFAULT_LIMIT);
  const rawEndTime = Number(searchParams.get("endTime"));

  const symbol = normalizeMarketSymbol(rawSymbol) ?? DEFAULT_SYMBOL;
  const interval = isMarketInterval(rawInterval) ? rawInterval : DEFAULT_INTERVAL;
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(Math.floor(rawLimit), 50), 500)
    : DEFAULT_LIMIT;
  const endTime = Number.isFinite(rawEndTime) && rawEndTime > 0 ? rawEndTime : undefined;

  const candles = await fetchBinanceCandles(symbol, interval, limit, endTime);
  const payload: MarketPayload = {
    symbol,
    interval,
    source: "binance",
    candles,
  };

  return Response.json(payload);
}

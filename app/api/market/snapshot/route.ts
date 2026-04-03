import { NextRequest } from "next/server";

import { fetchBinanceSnapshot } from "@/lib/binance-public";
import {
  normalizeMarketSymbol,
  type MarketSnapshotPayload,
  type MarketSymbol,
} from "@/lib/market";

const DEFAULT_SYMBOL: MarketSymbol = "BTCUSDT";

export async function GET(request: NextRequest) {
  const rawSymbol = request.nextUrl.searchParams.get("symbol") ?? DEFAULT_SYMBOL;
  const symbol = normalizeMarketSymbol(rawSymbol) ?? DEFAULT_SYMBOL;

  const snapshot = await fetchBinanceSnapshot(symbol);
  const payload: MarketSnapshotPayload = {
    symbol,
    source: "binance",
    ...snapshot,
  };

  return Response.json(payload);
}

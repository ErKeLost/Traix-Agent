import { NextResponse } from "next/server";

type SpotSymbol = {
  symbol: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
};

type FuturesSymbol = {
  symbol: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
  contractType: string;
};

type SearchMarket = "spot" | "perpetual";

type SearchSymbol = {
  symbol: string;
  base: string;
  quote: string;
  markets: SearchMarket[];
};

type SearchSymbolEntry = {
  symbol: string;
  base: string;
  quote: string;
  market: SearchMarket;
};

function mergeSymbols(items: SearchSymbolEntry[]) {
  const merged = new Map<string, SearchSymbol>();

  for (const item of items) {
    const existing = merged.get(item.symbol);

    if (!existing) {
      merged.set(item.symbol, {
        symbol: item.symbol,
        base: item.base,
        quote: item.quote,
        markets: [item.market],
      });
      continue;
    }

    if (!existing.markets.includes(item.market)) {
      existing.markets.push(item.market);
    }
  }

  return Array.from(merged.values()).sort((left, right) => {
    if (left.markets.length !== right.markets.length) {
      return right.markets.length - left.markets.length;
    }

    return left.symbol.localeCompare(right.symbol);
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim().toUpperCase() ?? "";

  try {
    const [spotResponse, futuresResponse] = await Promise.all([
      fetch("https://api.binance.com/api/v3/exchangeInfo", {
        next: { revalidate: 3600 },
      }),
      fetch("https://fapi.binance.com/fapi/v1/exchangeInfo", {
        next: { revalidate: 3600 },
      }),
    ]);

    if (!spotResponse.ok || !futuresResponse.ok) {
      throw new Error("Failed to fetch exchange info");
    }

    const [spotData, futuresData] = await Promise.all([
      spotResponse.json() as Promise<{ symbols: SpotSymbol[] }>,
      futuresResponse.json() as Promise<{ symbols: FuturesSymbol[] }>,
    ]);

    const spotSymbols = spotData.symbols
      .filter((s) => s.status === "TRADING" && s.quoteAsset === "USDT")
      .map((s) => ({
        symbol: s.symbol,
        base: s.baseAsset,
        quote: s.quoteAsset,
        market: "spot" as const,
      }));

    const perpetualSymbols = futuresData.symbols
      .filter(
        (s) =>
          s.status === "TRADING" &&
          s.quoteAsset === "USDT" &&
          s.contractType === "PERPETUAL",
      )
      .map((s) => ({
        symbol: s.symbol,
        base: s.baseAsset,
        quote: s.quoteAsset,
        market: "perpetual" as const,
      }));

    let symbols = mergeSymbols([...spotSymbols, ...perpetualSymbols]);

    if (query) {
      symbols = symbols.filter(
        (s) => s.symbol.includes(query) || s.base.includes(query),
      );
    }

    return NextResponse.json({ symbols: symbols.slice(0, 100) });
  } catch {
    const POPULAR = [
      { symbol: "BTCUSDT", base: "BTC", quote: "USDT", markets: ["spot", "perpetual"] },
      { symbol: "ETHUSDT", base: "ETH", quote: "USDT", markets: ["spot", "perpetual"] },
      { symbol: "SOLUSDT", base: "SOL", quote: "USDT", markets: ["spot", "perpetual"] },
      { symbol: "BNBUSDT", base: "BNB", quote: "USDT", markets: ["spot", "perpetual"] },
      { symbol: "XRPUSDT", base: "XRP", quote: "USDT", markets: ["spot", "perpetual"] },
      { symbol: "DOGEUSDT", base: "DOGE", quote: "USDT", markets: ["spot", "perpetual"] },
      { symbol: "ADAUSDT", base: "ADA", quote: "USDT", markets: ["spot", "perpetual"] },
      { symbol: "AVAXUSDT", base: "AVAX", quote: "USDT", markets: ["spot", "perpetual"] },
      { symbol: "DOTUSDT", base: "DOT", quote: "USDT", markets: ["spot", "perpetual"] },
      { symbol: "LINKUSDT", base: "LINK", quote: "USDT", markets: ["spot", "perpetual"] },
    ];

    const filtered = query
      ? POPULAR.filter((s) => s.symbol.includes(query) || s.base.includes(query))
      : POPULAR;

    return NextResponse.json({ symbols: filtered });
  }
}

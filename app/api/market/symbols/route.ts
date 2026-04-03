import { NextResponse } from "next/server";

type BinanceSymbol = {
  symbol: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim().toUpperCase() ?? "";

  try {
    const response = await fetch("https://api.binance.com/api/v3/exchangeInfo", {
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch exchange info");
    }

    const data = (await response.json()) as { symbols: BinanceSymbol[] };

    let symbols = data.symbols
      .filter((s) => s.status === "TRADING" && s.quoteAsset === "USDT")
      .map((s) => ({ symbol: s.symbol, base: s.baseAsset, quote: s.quoteAsset }));

    if (query) {
      symbols = symbols.filter(
        (s) => s.symbol.includes(query) || s.base.includes(query),
      );
    }

    return NextResponse.json({ symbols: symbols.slice(0, 100) });
  } catch {
    const POPULAR = [
      { symbol: "BTCUSDT", base: "BTC", quote: "USDT" },
      { symbol: "ETHUSDT", base: "ETH", quote: "USDT" },
      { symbol: "SOLUSDT", base: "SOL", quote: "USDT" },
      { symbol: "BNBUSDT", base: "BNB", quote: "USDT" },
      { symbol: "XRPUSDT", base: "XRP", quote: "USDT" },
      { symbol: "DOGEUSDT", base: "DOGE", quote: "USDT" },
      { symbol: "ADAUSDT", base: "ADA", quote: "USDT" },
      { symbol: "AVAXUSDT", base: "AVAX", quote: "USDT" },
      { symbol: "DOTUSDT", base: "DOT", quote: "USDT" },
      { symbol: "LINKUSDT", base: "LINK", quote: "USDT" },
    ];

    const filtered = query
      ? POPULAR.filter((s) => s.symbol.includes(query) || s.base.includes(query))
      : POPULAR;

    return NextResponse.json({ symbols: filtered });
  }
}

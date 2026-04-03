import type {
  BookTicker,
  Candle,
  MarketInterval,
  MarketSymbol,
  OrderBookLevel,
  Ticker24h,
  Trade,
} from "@/lib/market";

const BINANCE_API_BASE = "https://api.binance.com";
const BINANCE_TIMEOUT_MS = 5000;

export async function fetchBinanceCandles(
  symbol: MarketSymbol,
  interval: MarketInterval,
  limit: number,
  endTime?: number,
) {
  const searchParams = new URLSearchParams({
    symbol,
    interval,
    limit: String(limit),
  });

  if (endTime) {
    searchParams.set("endTime", String(endTime));
  }

  const data = await fetchBinance<
    Array<[number, string, string, string, string, string]>
  >(`/api/v3/klines?${searchParams.toString()}`);

  return data.map<Candle>((item) => ({
    time: Math.floor(item[0] / 1000),
    open: Number(item[1]),
    high: Number(item[2]),
    low: Number(item[3]),
    close: Number(item[4]),
    volume: Number(item[5]),
  }));
}

export async function fetchBinanceSnapshot(symbol: MarketSymbol) {
  const [ticker24hRaw, bookTickerRaw, depthRaw, tradesRaw] = await Promise.all([
    fetchBinance<{
      lastPrice: string;
      priceChangePercent: string;
      highPrice: string;
      lowPrice: string;
      volume: string;
      quoteVolume: string;
      weightedAvgPrice: string;
    }>(`/api/v3/ticker/24hr?symbol=${symbol}`),
    fetchBinance<{
      bidPrice: string;
      bidQty: string;
      askPrice: string;
      askQty: string;
    }>(`/api/v3/ticker/bookTicker?symbol=${symbol}`),
    fetchBinance<{
      bids: [string, string][];
      asks: [string, string][];
    }>(`/api/v3/depth?symbol=${symbol}&limit=10`),
    fetchBinance<
      Array<{
        id: number;
        price: string;
        qty: string;
        time: number;
        isBuyerMaker: boolean;
      }>
    >(`/api/v3/trades?symbol=${symbol}&limit=18`),
  ]);

  const ticker24h: Ticker24h = {
    lastPrice: Number(ticker24hRaw.lastPrice),
    priceChangePercent: Number(ticker24hRaw.priceChangePercent),
    highPrice: Number(ticker24hRaw.highPrice),
    lowPrice: Number(ticker24hRaw.lowPrice),
    volume: Number(ticker24hRaw.volume),
    quoteVolume: Number(ticker24hRaw.quoteVolume),
    weightedAveragePrice: Number(ticker24hRaw.weightedAvgPrice),
  };

  const bookTicker: BookTicker = {
    bidPrice: Number(bookTickerRaw.bidPrice),
    bidQuantity: Number(bookTickerRaw.bidQty),
    askPrice: Number(bookTickerRaw.askPrice),
    askQuantity: Number(bookTickerRaw.askQty),
  };

  const bids = depthRaw.bids.map<OrderBookLevel>(([price, quantity]) => ({
    price: Number(price),
    quantity: Number(quantity),
  }));

  const asks = depthRaw.asks.map<OrderBookLevel>(([price, quantity]) => ({
    price: Number(price),
    quantity: Number(quantity),
  }));

  const trades = tradesRaw
    .map<Trade>((trade) => ({
      id: trade.id,
      price: Number(trade.price),
      quantity: Number(trade.qty),
      time: trade.time,
      isBuyerMaker: trade.isBuyerMaker,
    }))
    .sort((left, right) => right.time - left.time);

  return { ticker24h, bookTicker, bids, asks, trades };
}

async function fetchBinance<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, BINANCE_TIMEOUT_MS);

  const response = await fetch(`${BINANCE_API_BASE}${path}`, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
    signal: controller.signal,
  }).finally(() => {
    clearTimeout(timeout);
  });

  if (!response.ok) {
    throw new Error(`Binance returned ${response.status} for ${path}`);
  }

  return (await response.json()) as T;
}

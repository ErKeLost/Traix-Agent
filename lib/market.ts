export const MARKET_SYMBOLS = [
  { symbol: "BTCUSDT", base: "BTC", quote: "USDT", name: "Bitcoin" },
  { symbol: "ETHUSDT", base: "ETH", quote: "USDT", name: "Ethereum" },
  { symbol: "SOLUSDT", base: "SOL", quote: "USDT", name: "Solana" },
  { symbol: "BNBUSDT", base: "BNB", quote: "USDT", name: "BNB" },
] as const;

export const INTERVALS = ["1s", "1m", "5m", "15m", "1h", "4h", "1d"] as const;
export const ANALYSIS_INTERVALS = ["1m", "5m", "15m", "1h"] as const;

export type MarketSymbol = string;
export type MarketInterval = (typeof INTERVALS)[number];

export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type OrderBookLevel = {
  price: number;
  quantity: number;
};

export type Trade = {
  id: number;
  price: number;
  quantity: number;
  time: number;
  isBuyerMaker: boolean;
};

export type NewsHeadline = {
  title: string;
  link: string;
  source: string;
  publishedAt: string;
};

export type DerivativesSnapshot = {
  openInterest: number;
  openInterestTime: number;
  openInterestValue: number;
  openInterestChangePercent: number;
  fundingRate: number;
  fundingTime: number;
  markPrice: number;
  longShortRatio: number;
  longAccount: number;
  shortAccount: number;
  globalLongShortRatio: number;
  globalLongAccount: number;
  globalShortAccount: number;
  topPositionLongShortRatio: number;
  topRatioTime: number;
  takerBuySellRatio: number;
  takerBuyVolume: number;
  takerSellVolume: number;
  takerRatioTime: number;
};

export type BookTicker = {
  bidPrice: number;
  bidQuantity: number;
  askPrice: number;
  askQuantity: number;
};

export type Ticker24h = {
  lastPrice: number;
  priceChangePercent: number;
  highPrice: number;
  lowPrice: number;
  volume: number;
  quoteVolume: number;
  weightedAveragePrice: number;
};

export type MarketPayload = {
  symbol: MarketSymbol;
  interval: MarketInterval;
  source: "binance";
  candles: Candle[];
};

export type MarketSnapshotPayload = {
  symbol: MarketSymbol;
  source: "binance";
  ticker24h: Ticker24h;
  bookTicker: BookTicker;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  trades: Trade[];
};

export type AccountBalance = {
  asset: string;
  free: number;
  locked: number;
  total: number;
};

export type AccountOrder = {
  symbol: string;
  side: string;
  type: string;
  quantity: number;
  price: number;
  status: string;
  updateTime: number;
};

export type BinanceAccountPayload = {
  accountType: string;
  canTrade: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
  permissions: string[];
  commissions: {
    maker: number;
    taker: number;
    buyer: number;
    seller: number;
  };
  balances: AccountBalance[];
  openOrders: AccountOrder[];
};

export type MarketAnalysisPayload = {
  symbol: MarketSymbol;
  interval: MarketInterval;
  bias: "bullish" | "bearish" | "neutral";
  confidence: number;
  riskLevel: "low" | "medium" | "high";
  summary: string;
  marketRegime: string;
  invalidation: string;
  supportLevel: number;
  resistanceLevel: number;
  setupType: string;
  noTrade: boolean;
  noTradeReason: string | null;
  indicators: {
    ema20: number;
    ema50: number;
    rsi14: number;
    macd: number;
    macdSignal: number;
    atr14: number;
    volumeRatio: number;
    orderBookImbalance: number;
    tradeDelta: number;
  };
  drivers: string[];
  risks: string[];
  scenarios: string[];
  aiNarrative: string | null;
  aiChecklist: string[];
  agentNarratives: {
    news: string | null;
    derivatives: string | null;
    supervisor: string | null;
  };
  agentChecklists: {
    news: string[];
    derivatives: string[];
    supervisor: string[];
  };
  headlines: Array<{
    title: string;
    link: string;
    source: string;
    publishedAt: string;
  }>;
  multiTimeframe: Array<{
    interval: MarketInterval;
    bias: "bullish" | "bearish" | "neutral";
    confidence: number;
    riskLevel: "low" | "medium" | "high";
    summary: string;
  }>;
  headlineImpacts: Array<{
    title: string;
    source: string;
    impact: "bullish" | "bearish" | "neutral";
    reason: string;
  }>;
  derivatives: DerivativesSnapshot;
};

export function isMarketSymbol(value: string): value is MarketSymbol {
  return normalizeMarketSymbol(value) !== null;
}

export function normalizeMarketSymbol(value: string) {
  const normalized = value.toUpperCase().replace(/[^A-Z0-9]/g, "");

  if (normalized.length < 5 || normalized.length > 20) {
    return null;
  }

  return normalized;
}

export function isMarketInterval(value: string): value is MarketInterval {
  return INTERVALS.includes(value as MarketInterval);
}

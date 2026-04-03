import { z } from "zod";

export const marketAnalysisInputSchema = z.object({
  symbol: z.string(),
  interval: z.string(),
});

export const candleSchema = z.object({
  time: z.number(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number(),
});

export const ticker24hSchema = z.object({
  lastPrice: z.number(),
  priceChangePercent: z.number(),
  highPrice: z.number(),
  lowPrice: z.number(),
  volume: z.number(),
  quoteVolume: z.number(),
  weightedAveragePrice: z.number(),
});

export const orderBookLevelSchema = z.object({
  price: z.number(),
  quantity: z.number(),
});

export const tradeSchema = z.object({
  id: z.number(),
  price: z.number(),
  quantity: z.number(),
  time: z.number(),
  isBuyerMaker: z.boolean(),
});

export const newsHeadlineSchema = z.object({
  title: z.string(),
  link: z.string(),
  source: z.string(),
  publishedAt: z.string(),
});

export const marketContextSchema = z.object({
  symbol: z.string(),
  interval: z.string(),
  candles: z.array(candleSchema),
  multiTimeframeCandles: z.array(
    z.object({
      interval: z.string(),
      candles: z.array(candleSchema),
    }),
  ),
  ticker24h: ticker24hSchema,
  bids: z.array(orderBookLevelSchema),
  asks: z.array(orderBookLevelSchema),
  trades: z.array(tradeSchema),
  headlines: z.array(newsHeadlineSchema),
  derivatives: z.object({
    openInterest: z.number(),
    openInterestTime: z.number(),
    openInterestValue: z.number(),
    openInterestChangePercent: z.number(),
    fundingRate: z.number(),
    fundingTime: z.number(),
    markPrice: z.number(),
    longShortRatio: z.number(),
    longAccount: z.number(),
    shortAccount: z.number(),
    globalLongShortRatio: z.number(),
    globalLongAccount: z.number(),
    globalShortAccount: z.number(),
    topPositionLongShortRatio: z.number(),
    topRatioTime: z.number(),
    takerBuySellRatio: z.number(),
    takerBuyVolume: z.number(),
    takerSellVolume: z.number(),
    takerRatioTime: z.number(),
  }),
});

export const marketAnalysisWorkflowOutputSchema = z.object({
  symbol: z.string(),
  interval: z.string(),
  bias: z.enum(["bullish", "bearish", "neutral"]),
  confidence: z.number(),
  riskLevel: z.enum(["low", "medium", "high"]),
  summary: z.string(),
  marketRegime: z.string(),
  invalidation: z.string(),
  supportLevel: z.number(),
  resistanceLevel: z.number(),
  setupType: z.string(),
  noTrade: z.boolean(),
  noTradeReason: z.string().nullable(),
  indicators: z.object({
    ema20: z.number(),
    ema50: z.number(),
    rsi14: z.number(),
    macd: z.number(),
    macdSignal: z.number(),
    atr14: z.number(),
    volumeRatio: z.number(),
    orderBookImbalance: z.number(),
    tradeDelta: z.number(),
  }),
  drivers: z.array(z.string()),
  risks: z.array(z.string()),
  scenarios: z.array(z.string()),
  aiNarrative: z.string().nullable(),
  aiChecklist: z.array(z.string()),
  agentNarratives: z.object({
    news: z.string().nullable(),
    derivatives: z.string().nullable(),
    supervisor: z.string().nullable(),
  }),
  agentChecklists: z.object({
    news: z.array(z.string()),
    derivatives: z.array(z.string()),
    supervisor: z.array(z.string()),
  }),
  headlines: z.array(newsHeadlineSchema),
  multiTimeframe: z.array(
    z.object({
      interval: z.string(),
      bias: z.enum(["bullish", "bearish", "neutral"]),
      confidence: z.number(),
      riskLevel: z.enum(["low", "medium", "high"]),
      summary: z.string(),
    }),
  ),
  headlineImpacts: z.array(
    z.object({
      title: z.string(),
      source: z.string(),
      impact: z.enum(["bullish", "bearish", "neutral"]),
      reason: z.string(),
    }),
  ),
  derivatives: z.object({
    openInterest: z.number(),
    openInterestTime: z.number(),
    openInterestValue: z.number(),
    openInterestChangePercent: z.number(),
    fundingRate: z.number(),
    fundingTime: z.number(),
    markPrice: z.number(),
    longShortRatio: z.number(),
    longAccount: z.number(),
    shortAccount: z.number(),
    globalLongShortRatio: z.number(),
    globalLongAccount: z.number(),
    globalShortAccount: z.number(),
    topPositionLongShortRatio: z.number(),
    topRatioTime: z.number(),
    takerBuySellRatio: z.number(),
    takerBuyVolume: z.number(),
    takerSellVolume: z.number(),
    takerRatioTime: z.number(),
  }),
});

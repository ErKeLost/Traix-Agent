import type {
  Candle,
  DerivativesSnapshot,
  MarketAnalysisPayload,
  MarketInterval,
  MarketSymbol,
  NewsHeadline,
  OrderBookLevel,
  Ticker24h,
  Trade,
} from "@/lib/market";

export function buildMarketAnalysis({
  symbol,
  interval,
  candles,
  ticker24h,
  bids,
  asks,
  trades,
  headlines = [],
  multiTimeframe = [],
  derivatives,
}: {
  symbol: MarketSymbol;
  interval: MarketInterval;
  candles: Candle[];
  ticker24h: Ticker24h;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  trades: Trade[];
  headlines?: NewsHeadline[];
  multiTimeframe?: MarketAnalysisPayload["multiTimeframe"];
  derivatives: DerivativesSnapshot;
}): MarketAnalysisPayload {
  const closes = candles.map((item) => item.close);
  const ema20 = ema(closes, 20);
  const ema50 = ema(closes, 50);
  const rsi14 = rsi(closes, 14);
  const { macd, signal } = macdValues(closes);
  const atr14 = atr(candles, 14);
  const volumeRatio = computeVolumeRatio(candles, 20);
  const orderBookImbalance = computeOrderBookImbalance(bids, asks);
  const tradeDelta = computeTradeDelta(trades);
  const lastClose = closes.at(-1) ?? 0;
  const priceTrendScore =
    (lastClose > ema20 ? 1 : -1) +
    (ema20 > ema50 ? 1 : -1) +
    (ticker24h.priceChangePercent > 0 ? 1 : -1);
  const momentumScore =
    (rsi14 > 55 ? 1 : rsi14 < 45 ? -1 : 0) +
    (macd > signal ? 1 : -1) +
    (tradeDelta > 0 ? 1 : tradeDelta < 0 ? -1 : 0);
  const liquidityScore =
    (orderBookImbalance > 0.08 ? 1 : orderBookImbalance < -0.08 ? -1 : 0) +
    (volumeRatio > 1.4 ? 1 : 0);
  const totalScore = priceTrendScore + momentumScore + liquidityScore;

  const bias: MarketAnalysisPayload["bias"] =
    totalScore >= 3 ? "bullish" : totalScore <= -3 ? "bearish" : "neutral";
  const confidence = clamp(Math.round(50 + totalScore * 8 + Math.abs(orderBookImbalance) * 80), 5, 95);
  const riskLevel = inferRiskLevel({
    atr14,
    lastClose,
    volumeRatio,
    rsi14,
  });
  const marketRegime = inferMarketRegime({
    bias,
    volumeRatio,
    atr14,
    lastClose,
    ema20,
    ema50,
  });
  const invalidation = buildInvalidation({
    bias,
    lastClose,
    ema20,
    ema50,
    atr14,
  });
  const supportLevel = Math.min(ema20, ema50, lastClose - atr14 * 0.8);
  const resistanceLevel = Math.max(ema20, ema50, lastClose + atr14 * 0.8);
  const setupType = inferSetupType({
    bias,
    volumeRatio,
    orderBookImbalance,
    tradeDelta,
    derivatives,
    marketRegime,
  });
  const noTrade = inferNoTrade({
    bias,
    rsi14,
    volumeRatio,
    orderBookImbalance,
    tradeDelta,
    derivatives,
    marketRegime,
  });
  const noTradeReason = noTrade
    ? buildNoTradeReason({
        bias,
        volumeRatio,
        orderBookImbalance,
        tradeDelta,
        derivatives,
        marketRegime,
      })
    : null;
  const drivers = buildDrivers({
    bias,
    ema20,
    ema50,
    rsi14,
    macd,
    signal,
    ticker24h,
    volumeRatio,
    orderBookImbalance,
    tradeDelta,
  });
  const risks = buildRisks({
    bias,
    rsi14,
    volumeRatio,
    orderBookImbalance,
    tradeDelta,
    atr14,
    lastClose,
  });
  const scenarios = buildScenarios({
    bias,
    lastClose,
    ema20,
    ema50,
    atr14,
  });

  return {
    symbol,
    interval,
    bias,
    confidence,
    riskLevel,
    summary: buildSummary({ bias, confidence, marketRegime }),
    marketRegime,
    invalidation,
    supportLevel,
    resistanceLevel,
    setupType,
    noTrade,
    noTradeReason,
    indicators: {
      ema20,
      ema50,
      rsi14,
      macd,
      macdSignal: signal,
      atr14,
      volumeRatio,
      orderBookImbalance,
      tradeDelta,
    },
    drivers,
    risks,
    scenarios,
    aiNarrative: null,
    aiChecklist: [],
    agentNarratives: {
      news: null,
      derivatives: null,
      supervisor: null,
    },
    agentChecklists: {
      news: [],
      derivatives: [],
      supervisor: [],
    },
    headlines,
    multiTimeframe,
    headlineImpacts: inferHeadlineImpacts(headlines),
    derivatives,
  };
}

export function buildTimeframeSummary({
  interval,
  candles,
  ticker24h,
  bids,
  asks,
  trades,
  derivatives,
}: {
  interval: MarketInterval;
  candles: Candle[];
  ticker24h: Ticker24h;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  trades: Trade[];
  derivatives: DerivativesSnapshot;
}) {
  const analysis = buildMarketAnalysis({
    symbol: "BTCUSDT",
    interval,
    candles,
    ticker24h,
    bids,
    asks,
    trades,
    derivatives,
  });

  return {
    interval,
    bias: analysis.bias,
    confidence: analysis.confidence,
    riskLevel: analysis.riskLevel,
    summary: analysis.summary,
  };
}

function ema(values: number[], period: number) {
  if (values.length === 0) {
    return 0;
  }

  const multiplier = 2 / (period + 1);
  let current = values[0];

  for (let index = 1; index < values.length; index += 1) {
    current = (values[index] - current) * multiplier + current;
  }

  return current;
}

function rsi(values: number[], period: number) {
  if (values.length <= period) {
    return 50;
  }

  let gains = 0;
  let losses = 0;

  for (let index = values.length - period; index < values.length; index += 1) {
    const diff = values[index] - values[index - 1];
    if (diff >= 0) {
      gains += diff;
    } else {
      losses += Math.abs(diff);
    }
  }

  if (losses === 0) {
    return 100;
  }

  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

function macdValues(values: number[]) {
  const fast = ema(values, 12);
  const slow = ema(values, 26);
  const macd = fast - slow;
  const lineSeed = values.map((_, index) => {
    const subset = values.slice(0, index + 1);
    return ema(subset, 12) - ema(subset, 26);
  });

  return {
    macd,
    signal: ema(lineSeed, 9),
  };
}

function atr(candles: Candle[], period: number) {
  if (candles.length < 2) {
    return 0;
  }

  const trueRanges: number[] = [];

  for (let index = 1; index < candles.length; index += 1) {
    const current = candles[index];
    const previous = candles[index - 1];
    trueRanges.push(
      Math.max(
        current.high - current.low,
        Math.abs(current.high - previous.close),
        Math.abs(current.low - previous.close),
      ),
    );
  }

  const sample = trueRanges.slice(-period);
  return sample.reduce((sum, item) => sum + item, 0) / sample.length;
}

function computeVolumeRatio(candles: Candle[], period: number) {
  if (candles.length < period + 1) {
    return 1;
  }

  const previous = candles.slice(-(period + 1), -1);
  const average = previous.reduce((sum, item) => sum + item.volume, 0) / previous.length;
  const current = candles.at(-1)?.volume ?? average;
  return average === 0 ? 1 : current / average;
}

function computeOrderBookImbalance(bids: OrderBookLevel[], asks: OrderBookLevel[]) {
  const bidVolume = bids.reduce((sum, item) => sum + item.quantity, 0);
  const askVolume = asks.reduce((sum, item) => sum + item.quantity, 0);
  const total = bidVolume + askVolume;

  if (total === 0) {
    return 0;
  }

  return (bidVolume - askVolume) / total;
}

function computeTradeDelta(trades: Trade[]) {
  if (trades.length === 0) {
    return 0;
  }

  return trades.reduce(
    (sum, trade) => sum + (trade.isBuyerMaker ? -trade.quantity : trade.quantity),
    0,
  );
}

function inferRiskLevel({
  atr14,
  lastClose,
  volumeRatio,
  rsi14,
}: {
  atr14: number;
  lastClose: number;
  volumeRatio: number;
  rsi14: number;
}) {
  const volatility = lastClose === 0 ? 0 : atr14 / lastClose;

  if (volatility > 0.02 || volumeRatio > 2 || rsi14 > 72 || rsi14 < 28) {
    return "high";
  }

  if (volatility > 0.01 || volumeRatio > 1.35) {
    return "medium";
  }

  return "low";
}

function inferMarketRegime({
  bias,
  volumeRatio,
  atr14,
  lastClose,
  ema20,
  ema50,
}: {
  bias: MarketAnalysisPayload["bias"];
  volumeRatio: number;
  atr14: number;
  lastClose: number;
  ema20: number;
  ema50: number;
}) {
  const volatility = lastClose === 0 ? 0 : atr14 / lastClose;
  const emaGap = lastClose === 0 ? 0 : Math.abs(ema20 - ema50) / lastClose;

  if (volatility < 0.006 && emaGap < 0.003) {
    return "压缩震荡";
  }

  if (bias === "bullish" && volumeRatio > 1.2) {
    return "上行趋势延续";
  }

  if (bias === "bearish" && volumeRatio > 1.2) {
    return "下行趋势延续";
  }

  return "混合轮动";
}

function buildInvalidation({
  bias,
  lastClose,
  ema20,
  ema50,
  atr14,
}: {
  bias: MarketAnalysisPayload["bias"];
  lastClose: number;
  ema20: number;
  ema50: number;
  atr14: number;
}) {
  if (bias === "bullish") {
    return `若跌破 ${formatLevel(Math.min(ema20, ema50) - atr14 * 0.4)}，当前偏多判断开始失效。`;
  }

  if (bias === "bearish") {
    return `若重新站上 ${formatLevel(Math.max(ema20, ema50) + atr14 * 0.4)}，当前偏空判断开始失效。`;
  }

  return `当前中性结构在脱离 ${formatLevel(lastClose - atr14)} 到 ${formatLevel(lastClose + atr14)} 区间后会被打破。`;
}

function buildDrivers(params: {
  bias: MarketAnalysisPayload["bias"];
  ema20: number;
  ema50: number;
  rsi14: number;
  macd: number;
  signal: number;
  ticker24h: Ticker24h;
  volumeRatio: number;
  orderBookImbalance: number;
  tradeDelta: number;
}) {
  const drivers: string[] = [];

  drivers.push(
    params.ema20 > params.ema50
      ? "短中期均线保持多头排列，趋势结构仍偏向上行。"
      : "短中期均线未形成多头排列，趋势结构仍偏谨慎。",
  );
  drivers.push(
    params.macd > params.signal
      ? "MACD 位于信号线上方，动量维持正向。"
      : "MACD 位于信号线下方，动量仍偏弱。",
  );
  drivers.push(
    params.volumeRatio > 1.25
      ? `当前成交量约为近 20 根均量的 ${params.volumeRatio.toFixed(2)} 倍，说明参与度正在放大。`
      : "当前成交量没有明显放大，信号确认度一般。",
  );
  drivers.push(
    params.orderBookImbalance > 0.08
      ? "盘口买量明显强于卖量，短线承接较强。"
      : params.orderBookImbalance < -0.08
        ? "盘口卖量明显强于买量，短线压制更强。"
        : "盘口多空力量接近平衡，单看深度没有明显倾向。",
  );
  drivers.push(
    params.tradeDelta > 0
      ? "逐笔成交以主动买入为主，短线推进更健康。"
      : "逐笔成交以主动卖出为主，短线抛压仍在。",
  );
  drivers.push(
    `${params.ticker24h.priceChangePercent >= 0 ? "24h 涨幅" : "24h 跌幅"}为 ${params.ticker24h.priceChangePercent.toFixed(2)}%，提供了更大周期背景。`,
  );

  return drivers.slice(0, 5);
}

function buildRisks({
  bias,
  rsi14,
  volumeRatio,
  orderBookImbalance,
  tradeDelta,
  atr14,
  lastClose,
}: {
  bias: MarketAnalysisPayload["bias"];
  rsi14: number;
  volumeRatio: number;
  orderBookImbalance: number;
  tradeDelta: number;
  atr14: number;
  lastClose: number;
}) {
  const risks: string[] = [];
  const volatility = lastClose === 0 ? 0 : atr14 / lastClose;

  if (rsi14 > 70) {
    risks.push("RSI 已进入超买区域，追涨风险升高。");
  } else if (rsi14 < 30) {
    risks.push("RSI 已进入超卖区域，继续杀跌的盈亏比开始变差。");
  }

  if (volumeRatio < 0.9 && bias !== "neutral") {
    risks.push("量能没有同步扩张，趋势延续的确认度不足。");
  }

  if (Math.abs(orderBookImbalance) > 0.18 && tradeDelta * orderBookImbalance < 0) {
    risks.push("盘口和逐笔成交方向不一致，容易出现假突破或假跌破。");
  }

  if (volatility > 0.02) {
    risks.push("ATR 占比偏高，当前属于高波动环境，止损需要更宽。");
  }

  if (risks.length === 0) {
    risks.push("当前没有出现特别极端的失衡，但信号仍需结合价位确认。");
  }

  return risks.slice(0, 4);
}

function buildScenarios({
  bias,
  lastClose,
  ema20,
  ema50,
  atr14,
}: {
  bias: MarketAnalysisPayload["bias"];
  lastClose: number;
  ema20: number;
  ema50: number;
  atr14: number;
}) {
  if (bias === "bullish") {
    return [
      `若价格维持在 ${formatLevel(ema20)} 上方，结构更倾向继续试探 ${formatLevel(lastClose + atr14 * 1.5)}。`,
      `若回落跌破 ${formatLevel(Math.min(ema20, ema50))}，当前多头延续判断需要降级。`,
    ];
  }

  if (bias === "bearish") {
    return [
      `若价格持续压在 ${formatLevel(ema20)} 下方，结构更倾向继续测试 ${formatLevel(lastClose - atr14 * 1.5)}。`,
      `若反弹重新站上 ${formatLevel(Math.max(ema20, ema50))}，当前空头延续判断需要降级。`,
    ];
  }

  return [
    `当前更像区间波动，突破 ${formatLevel(lastClose + atr14)} 才更容易形成新的方向延续。`,
    `若跌破 ${formatLevel(lastClose - atr14)}，则中性结构转弱。`,
  ];
}

function buildSummary({
  bias,
  confidence,
  marketRegime,
}: {
  bias: MarketAnalysisPayload["bias"];
  confidence: number;
  marketRegime: string;
}) {
  if (bias === "bullish") {
    return `当前偏多，置信度 ${confidence}，市场更像 ${marketRegime}。`;
  }

  if (bias === "bearish") {
    return `当前偏空，置信度 ${confidence}，市场更像 ${marketRegime}。`;
  }

  return `当前偏中性，置信度 ${confidence}，市场更像 ${marketRegime}。`;
}

function formatLevel(value: number) {
  return value >= 100 ? value.toFixed(2) : value.toFixed(4);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function inferSetupType({
  bias,
  volumeRatio,
  orderBookImbalance,
  tradeDelta,
  derivatives,
  marketRegime,
}: {
  bias: MarketAnalysisPayload["bias"];
  volumeRatio: number;
  orderBookImbalance: number;
  tradeDelta: number;
  derivatives: DerivativesSnapshot;
  marketRegime: string;
}) {
  if (marketRegime.includes("compression")) {
    return "压缩后等待突破";
  }

  if (
    bias === "bullish" &&
    volumeRatio > 1.2 &&
    orderBookImbalance > 0 &&
    tradeDelta > 0 &&
    derivatives.takerBuySellRatio > 1
  ) {
    return "顺势延续做多";
  }

  if (
    bias === "bearish" &&
    volumeRatio > 1.2 &&
    orderBookImbalance < 0 &&
    tradeDelta < 0 &&
    derivatives.takerBuySellRatio < 1
  ) {
    return "顺势延续做空";
  }

  return "方向混合，等待确认";
}

function inferNoTrade({
  bias,
  rsi14,
  volumeRatio,
  orderBookImbalance,
  tradeDelta,
  derivatives,
  marketRegime,
}: {
  bias: MarketAnalysisPayload["bias"];
  rsi14: number;
  volumeRatio: number;
  orderBookImbalance: number;
  tradeDelta: number;
  derivatives: DerivativesSnapshot;
  marketRegime: string;
}) {
  if (bias === "neutral") return true;
  if (marketRegime.includes("compression")) return true;
  if (Math.abs(orderBookImbalance) < 0.03 && Math.abs(tradeDelta) < 0.000001) return true;
  if (volumeRatio < 0.85) return true;
  if (rsi14 > 75 || rsi14 < 25) return true;
  if (derivatives.fundingRate > 0.0008 && derivatives.longShortRatio > 1.8) return true;
  if (derivatives.fundingRate < -0.0008 && derivatives.longShortRatio < 0.75) return true;
  return false;
}

function buildNoTradeReason({
  bias,
  volumeRatio,
  orderBookImbalance,
  tradeDelta,
  derivatives,
  marketRegime,
}: {
  bias: MarketAnalysisPayload["bias"];
  volumeRatio: number;
  orderBookImbalance: number;
  tradeDelta: number;
  derivatives: DerivativesSnapshot;
  marketRegime: string;
}) {
  if (bias === "neutral") return "当前方向偏中性，盈亏比不清晰。";
  if (marketRegime.includes("compression")) return "市场仍在压缩震荡，还没有明确方向突破。";
  if (volumeRatio < 0.85) return "量能确认太弱，暂时不算干净机会。";
  if (Math.abs(orderBookImbalance) < 0.03 && Math.abs(tradeDelta) < 0.000001) {
    return "盘口和逐笔成交太均衡，暂时不支持明确方向单。";
  }
  if (derivatives.fundingRate > 0.0008 && derivatives.longShortRatio > 1.8) {
    return "多头拥挤度偏高，挤仓和反转风险在上升。";
  }
  if (derivatives.fundingRate < -0.0008 && derivatives.longShortRatio < 0.75) {
    return "空头拥挤度偏高，挤仓和反转风险在上升。";
  }
  return "当前确认质量还不够。";
}

function inferHeadlineImpacts(headlines: NewsHeadline[]) {
  return headlines.slice(0, 6).map((headline) => {
    const text = `${headline.source} ${headline.title}`.toLowerCase();

    if (
      /war|attack|missile|explosion|sanction|conflict|iran|israel|tariff|hack|ban|liquidation/.test(
        text,
      )
    ) {
      return {
        title: headline.title,
        source: headline.source,
        impact: "bearish" as const,
        reason: "偏避险或不稳定事件，容易压制加密市场风险偏好。",
      };
    }

    if (
      /etf inflow|rate cut|cooling inflation|adoption|approval|partnership|treasury buy|accumulation/.test(
        text,
      )
    ) {
      return {
        title: headline.title,
        source: headline.source,
        impact: "bullish" as const,
        reason: "偏利多的宏观或采用消息，可能改善市场风险偏好。",
      };
    }

    return {
      title: headline.title,
      source: headline.source,
      impact: "neutral" as const,
      reason: "消息有参考价值，但方向性影响暂时不明确。",
    };
  });
}

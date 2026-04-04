import { createStep } from "@mastra/core/workflows";

import { buildMarketAnalysis, buildTimeframeSummary } from "@/lib/analysis";
import { fetchBinanceCandles, fetchBinanceSnapshot } from "@/lib/binance-public";
import { fetchDerivativesSnapshot } from "@/lib/derivatives";
import { fetchLatestHeadlines } from "@/lib/news";
import {
  ANALYSIS_INTERVALS,
  type MarketAnalysisPayload,
  type MarketInterval,
  type MarketSymbol,
} from "@/lib/market";

import { hasTradingModelAccess } from "../../agents/model";
import {
  marketAnalysisInputSchema,
  marketAnalysisWorkflowOutputSchema,
  marketContextSchema,
} from "./types";

const AGENT_TIMEOUT_MS = 6000;

export const fetchMarketContextStep = createStep({
  id: "fetch-market-context",
  description: "Fetch live Binance market data for the selected symbol and interval.",
  inputSchema: marketAnalysisInputSchema,
  outputSchema: marketContextSchema,
  execute: async ({ inputData }) => {
    const symbol = inputData.symbol as MarketSymbol;
    const interval = inputData.interval as MarketInterval;
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

    return {
      symbol,
      interval,
      candles,
      multiTimeframeCandles,
      ticker24h: snapshot.ticker24h,
      bids: snapshot.bids,
      asks: snapshot.asks,
      trades: snapshot.trades,
      headlines,
      derivatives,
    };
  },
});

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
          ? ((last?.close ?? previous.close) - previous.close) / previous.close * 100
          : 0,
      highPrice,
      lowPrice: Number.isFinite(lowPrice) ? lowPrice : 0,
      volume,
      quoteVolume: volume * (last?.close ?? 0),
      weightedAveragePrice,
    },
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

function buildFallbackDerivativesSnapshot() {
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

export const buildRuleAnalysisStep = createStep({
  id: "build-rule-analysis",
  description: "Compute deterministic market analysis from technical and orderflow features.",
  inputSchema: marketContextSchema,
  outputSchema: marketAnalysisWorkflowOutputSchema,
  execute: async ({ inputData }) => {
    const analysis = buildMarketAnalysis({
      symbol: inputData.symbol as MarketSymbol,
      interval: inputData.interval as MarketInterval,
      candles: inputData.candles,
      ticker24h: inputData.ticker24h,
      bids: inputData.bids,
      asks: inputData.asks,
      trades: inputData.trades,
      headlines: inputData.headlines,
      multiTimeframe: inputData.multiTimeframeCandles.map((item) =>
        buildTimeframeSummary({
          interval: item.interval as MarketInterval,
          candles: item.candles,
          ticker24h: inputData.ticker24h,
          bids: inputData.bids,
          asks: inputData.asks,
          trades: inputData.trades,
          derivatives: inputData.derivatives,
        }),
      ),
      derivatives: inputData.derivatives,
    });

    return {
      ...analysis,
      aiNarrative: null,
      aiChecklist: [],
    } satisfies MarketAnalysisPayload;
  },
});

export const enrichNewsNarrativeStep = createStep({
  id: "enrich-news-narrative",
  description: "Use the news analyst agent to summarize world news context.",
  inputSchema: marketAnalysisWorkflowOutputSchema,
  outputSchema: marketAnalysisWorkflowOutputSchema,
  execute: async ({ inputData, mastra }) => {
    if (!hasTradingModelAccess() || !mastra) {
      return inputData;
    }

    const agent = mastra.getAgentById("news-analyst");

    const prompt = `
Latest headlines:
${inputData.headlines
  .slice(0, 6)
  .map((item) => `- [${item.source}] ${item.title} (${item.publishedAt})`)
  .join("\n")}
`;

    try {
      const response = await Promise.race([
        agent.generate(prompt),
        timeoutAfter(AGENT_TIMEOUT_MS, "News analyst timed out."),
      ]);
      const { narrative, checklist } = parseAgentResponse(response.text);

      return {
        ...inputData,
        agentNarratives: {
          ...inputData.agentNarratives,
          news: narrative,
        },
        agentChecklists: {
          ...inputData.agentChecklists,
          news: checklist,
        },
      };
    } catch {
      return inputData;
    }
  },
});

export const enrichDerivativesNarrativeStep = createStep({
  id: "enrich-derivatives-narrative",
  description: "Use the derivatives analyst agent to summarize futures positioning.",
  inputSchema: marketAnalysisWorkflowOutputSchema,
  outputSchema: marketAnalysisWorkflowOutputSchema,
  execute: async ({ inputData, mastra }) => {
    if (!hasTradingModelAccess() || !mastra) {
      return inputData;
    }

    const agent = mastra.getAgentById("derivatives-analyst");

    const prompt = `
Symbol: ${inputData.symbol}
Derivatives snapshot:
- Open Interest: ${inputData.derivatives.openInterest}
- Funding Rate: ${inputData.derivatives.fundingRate}
- Mark Price: ${inputData.derivatives.markPrice}
- Top Trader Long/Short Ratio: ${inputData.derivatives.longShortRatio}
- Long Account Share: ${inputData.derivatives.longAccount}
- Short Account Share: ${inputData.derivatives.shortAccount}
- Taker Buy/Sell Ratio: ${inputData.derivatives.takerBuySellRatio}
- Taker Buy Volume: ${inputData.derivatives.takerBuyVolume}
- Taker Sell Volume: ${inputData.derivatives.takerSellVolume}
`;

    try {
      const response = await Promise.race([
        agent.generate(prompt),
        timeoutAfter(AGENT_TIMEOUT_MS, "Derivatives analyst timed out."),
      ]);
      const { narrative, checklist } = parseAgentResponse(response.text);

      return {
        ...inputData,
        agentNarratives: {
          ...inputData.agentNarratives,
          derivatives: narrative,
        },
        agentChecklists: {
          ...inputData.agentChecklists,
          derivatives: checklist,
        },
      };
    } catch {
      return inputData;
    }
  },
});

export const enrichSupervisorNarrativeStep = createStep({
  id: "enrich-supervisor-narrative",
  description: "Use the market supervisor agent to synthesize rule, news, and derivatives analysis.",
  inputSchema: marketAnalysisWorkflowOutputSchema,
  outputSchema: marketAnalysisWorkflowOutputSchema,
  execute: async ({ inputData, mastra }) => {
    if (!hasTradingModelAccess() || !mastra) {
      return inputData;
    }

    const agent = mastra.getAgentById("market-analyst");

    const prompt = `
Symbol: ${inputData.symbol}
Interval: ${inputData.interval}
Bias: ${inputData.bias}
Confidence: ${inputData.confidence}
Risk: ${inputData.riskLevel}
Regime: ${inputData.marketRegime}
Invalidation: ${inputData.invalidation}
Support: ${inputData.supportLevel}
Resistance: ${inputData.resistanceLevel}
Setup Type: ${inputData.setupType}
No Trade: ${inputData.noTrade ? "yes" : "no"}
No Trade Reason: ${inputData.noTradeReason ?? "n/a"}

Drivers:
${inputData.drivers.map((item) => `- ${item}`).join("\n")}

Risks:
${inputData.risks.map((item) => `- ${item}`).join("\n")}

Scenarios:
${inputData.scenarios.map((item) => `- ${item}`).join("\n")}

Multi-timeframe:
${inputData.multiTimeframe
  .map(
    (item) =>
      `- ${item.interval}: ${item.bias}, confidence ${item.confidence}, risk ${item.riskLevel}, ${item.summary}`,
  )
  .join("\n")}

News analyst summary:
${inputData.agentNarratives.news ?? "No news summary."}

Derivatives analyst summary:
${inputData.agentNarratives.derivatives ?? "No derivatives summary."}
`;

    try {
      const response = await Promise.race([
        agent.generate(prompt),
        timeoutAfter(AGENT_TIMEOUT_MS, "Supervisor analyst timed out."),
      ]);
      const { narrative, checklist } = parseAgentResponse(response.text);

      return {
        ...inputData,
        aiNarrative: narrative,
        aiChecklist: checklist,
        agentNarratives: {
          ...inputData.agentNarratives,
          supervisor: narrative,
        },
        agentChecklists: {
          ...inputData.agentChecklists,
          supervisor: checklist,
        },
      };
    } catch {
      return inputData;
    }
  },
});

function parseAgentResponse(text: string) {
  const normalized = text.trim();
  const checklist = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.replace(/^- /, ""));

  const summaryMatch = normalized.match(/summary:\s*([\s\S]*?)(?:\nchecklist:|\n- |$)/i);
  const narrative = summaryMatch?.[1]?.trim() || normalized;

  return {
    narrative,
    checklist: checklist.slice(0, 4),
  };
}

function timeoutAfter(ms: number, message: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(message));
    }, ms);
  });
}

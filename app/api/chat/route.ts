import { createUIMessageStream, createUIMessageStreamResponse, type UIMessage } from "ai";
import { convertFullStreamChunkToUIMessageStream, convertMastraChunkToAISDKv5 } from "@mastra/core/stream";
import { NextRequest } from "next/server";

import { buildRulesOnlyMarketAnalysis } from "@/lib/analysis-runtime";
import {
  isMarketInterval,
  normalizeMarketSymbol,
  type MarketInterval,
  type MarketSymbol,
} from "@/lib/market";
import { mastra } from "@/src/mastra";

const DEFAULT_SYMBOL: MarketSymbol = "BTCUSDT";
const DEFAULT_INTERVAL: MarketInterval = "1m";

type DeskMode = "auto" | "market" | "derivatives" | "news";
type ChatMode = "claude-style" | "balanced" | "deep-analysis" | "fast-brief";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      messages?: UIMessage[];
      symbol?: string;
      interval?: string;
      desk?: string;
      preferResearch?: boolean;
      mode?: string;
    };

    const rawSymbol = body.symbol ?? "";
    const rawInterval = body.interval ?? "";
    const rawDesk = body.desk ?? "auto";
    const rawMode = body.mode ?? "balanced";
    const symbol = normalizeMarketSymbol(rawSymbol) ?? DEFAULT_SYMBOL;
    const interval = isMarketInterval(rawInterval) ? rawInterval : DEFAULT_INTERVAL;
    const desk = isDeskMode(rawDesk) ? rawDesk : "auto";
    const mode = isChatMode(rawMode) ? rawMode : "balanced";
    const preferResearch = Boolean(body.preferResearch) || mode === "deep-analysis";
    const messages = Array.isArray(body.messages) ? body.messages : [];

    if (messages.length === 0) {
      return Response.json({ error: "Messages are required." }, { status: 400 });
    }

    const marketContextMessage = await buildMarketContextMessage(symbol, interval, desk, preferResearch);
    const agent = pickAgent(desk, preferResearch);
    const result = await agent.stream(messages as never, {
      system: marketContextMessage,
      abortSignal: request.signal,
      maxSteps: preferResearch ? 10 : 6,
    });

    const stream = createUIMessageStream({
      originalMessages: messages as never,
      onError: getErrorText,
      execute: async ({ writer }) => {
        const reader = result.fullStream.getReader();

        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              break;
            }

            const part = convertMastraChunkToAISDKv5({
              chunk: value,
              mode: "stream",
            });

            if (!part) {
              continue;
            }

            const uiChunk = convertFullStreamChunkToUIMessageStream({
              part: part as never,
              sendStart: true,
              sendFinish: true,
              sendReasoning: true,
              sendSources: true,
              onError: getErrorText,
            });

            if (uiChunk) {
              writer.write(uiChunk as never);
            }
          }
        } finally {
          reader.releaseLock();
        }
      },
    });

    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Chat request failed.",
      },
      { status: 500 },
    );
  }
}

function getErrorText(error: unknown) {
  return error instanceof Error ? error.message : "Chat stream failed.";
}

function isChatMode(value: string): value is ChatMode {
  return (
    value === "claude-style" ||
    value === "balanced" ||
    value === "deep-analysis" ||
    value === "fast-brief"
  );
}

function isDeskMode(value: string): value is DeskMode {
  return value === "auto" || value === "market" || value === "derivatives" || value === "news";
}

function pickAgent(desk: DeskMode, preferResearch: boolean) {
  if (preferResearch) {
    return mastra.getAgentById("deep-research");
  }

  if (desk === "market") {
    return mastra.getAgentById("market-analyst");
  }

  if (desk === "derivatives") {
    return mastra.getAgentById("derivatives-analyst");
  }

  if (desk === "news") {
    return mastra.getAgentById("news-analyst");
  }

  return mastra.getAgentById("trading-chat");
}

function getDeskLabel(desk: DeskMode) {
  if (desk === "market") {
    return "市场结构席位";
  }

  if (desk === "derivatives") {
    return "衍生品席位";
  }

  if (desk === "news") {
    return "宏观新闻席位";
  }

  return "自动路由总控席位";
}

async function buildMarketContextMessage(
  symbol: MarketSymbol,
  interval: MarketInterval,
  desk: DeskMode,
  preferResearch: boolean,
) {
  const analysis = await buildRulesOnlyMarketAnalysis(symbol, interval);

  return `
你是交易终端里的 ${getDeskLabel(desk)}。

当前分析标的：${symbol}
当前图表周期：${interval}

这是系统基于实时行情生成的规则分析，请优先基于它回答：
- Bias: ${analysis.bias}
- Confidence: ${analysis.confidence}
- Risk Level: ${analysis.riskLevel}
- Regime: ${analysis.marketRegime}
- Setup: ${analysis.setupType}
- Summary: ${analysis.summary}
- Support: ${analysis.supportLevel}
- Resistance: ${analysis.resistanceLevel}
- Invalidation: ${analysis.invalidation}
- No Trade: ${analysis.noTrade ? "yes" : "no"}
- No Trade Reason: ${analysis.noTradeReason ?? "n/a"}

Drivers:
${analysis.drivers.map((item) => `- ${item}`).join("\n")}

Risks:
${analysis.risks.map((item) => `- ${item}`).join("\n")}

Scenarios:
${analysis.scenarios.map((item) => `- ${item}`).join("\n")}

News context:
${analysis.headlineImpacts.map((item) => `- [${item.impact}] ${item.title}: ${item.reason}`).join("\n")}

Derivatives context:
- Funding Rate: ${analysis.derivatives.fundingRate}
- Open Interest: ${analysis.derivatives.openInterest}
- OI Change %: ${analysis.derivatives.openInterestChangePercent}
- Top Trader Long/Short Ratio: ${analysis.derivatives.longShortRatio}
- Taker Buy/Sell Ratio: ${analysis.derivatives.takerBuySellRatio}

Multi-timeframe:
${analysis.multiTimeframe
  .map((item) => `- ${item.interval}: ${item.bias}, confidence ${item.confidence}, ${item.summary}`)
  .join("\n")}

回答要求：
- 明确区分事实、推断、条件
- 没有边际优势时可以直接说 no-trade
- 不要编造实时价格以外的数据来源
- 如果信息不足，直接说明缺口
- 研究模式：${preferResearch ? "deep-research" : "standard"}
`;
}

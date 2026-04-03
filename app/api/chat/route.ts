import { createUIMessageStream, createUIMessageStreamResponse, type UIMessage } from "ai";
import { NextRequest } from "next/server";
import { convertFullStreamChunkToUIMessageStream, convertMastraChunkToAISDKv5 } from "@mastra/core/stream";
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

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      messages?: UIMessage[];
      symbol?: string;
      interval?: string;
      desk?: string;
    };

    const rawSymbol = body.symbol ?? "";
    const rawInterval = body.interval ?? "";
    const rawDesk = body.desk ?? "auto";
    const symbol = normalizeMarketSymbol(rawSymbol) ?? DEFAULT_SYMBOL;
    const interval = isMarketInterval(rawInterval) ? rawInterval : DEFAULT_INTERVAL;
    const desk = isDeskMode(rawDesk) ? rawDesk : "auto";
    const messages = Array.isArray(body.messages) ? body.messages : [];

    if (messages.length === 0) {
      return Response.json({ error: "Messages are required." }, { status: 400 });
    }

    try {
      const agent = mastra.getAgentById(resolveAgentId(desk));
      const marketContextMessage = await buildMarketContextMessage(symbol, interval, desk);
      const contextualMessages = [
        marketContextMessage,
        ...messages,
      ];
      const result = await agent.stream(contextualMessages, {
        abortSignal: request.signal,
      });
      const stream = createUIMessageStream<UIMessage>({
        originalMessages: messages,
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

              const uiChunk = convertFullStreamChunkToUIMessageStream<UIMessage>({
                part,
                sendStart: true,
                sendFinish: true,
                sendReasoning: true,
                onError: getErrorText,
              });

              if (uiChunk) {
                writer.write(uiChunk);
              }
            }
          } finally {
            reader.releaseLock();
          }
        },
      });

      return createUIMessageStreamResponse({ stream });
    } catch (streamError) {
      return Response.json(
        {
          error: streamError instanceof Error ? streamError.message : "Chat stream failed.",
        },
        { status: 500 },
      );
    }
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

function isDeskMode(value: string): value is DeskMode {
  return value === "auto" || value === "market" || value === "derivatives" || value === "news";
}

function resolveAgentId(desk: DeskMode) {
  if (desk === "market") {
    return "market-analyst";
  }

  if (desk === "derivatives") {
    return "derivatives-analyst";
  }

  if (desk === "news") {
    return "news-analyst";
  }

  return "trading-chat";
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

async function buildMarketContextMessage(symbol: MarketSymbol, interval: MarketInterval, desk: DeskMode) {
  const staticRules = [
    "- 只围绕当前选中的币种和周期回答",
    "- 如果用户问方向或入场，给条件式判断，不要装成确定预言",
    "- 区分事实、推断和交易条件",
    "- 如果上下文抓取失败，要明确说明信息边界",
    "- 用简洁中文回答，优先短句，不要复述全部上下文。",
    `- 当前工作模式是：${getDeskLabel(desk)}`,
  ].join("\n");

  try {
    const analysis = await buildRulesOnlyMarketAnalysis(symbol, interval);
    const multiTimeframe = analysis.multiTimeframe
      .slice(0, 4)
      .map(
        (item) =>
          `  - ${item.interval}: ${item.bias}, confidence ${item.confidence}%, ${item.summary}`,
      )
      .join("\n");
    const drivers = analysis.drivers.slice(0, 4).map((item) => `  - ${item}`).join("\n");
    const risks = analysis.risks.slice(0, 4).map((item) => `  - ${item}`).join("\n");
    const scenarios = analysis.scenarios.slice(0, 3).map((item) => `  - ${item}`).join("\n");
    const headlines = analysis.headlines
      .slice(0, 3)
      .map((item) => `  - ${item.source}: ${item.title}`)
      .join("\n");

    return {
      role: "system",
      content: `当前聊天上下文如下。\n\n工作模式:\n- Desk: ${getDeskLabel(desk)}\n\n市场:\n- Symbol: ${symbol}\n- Interval: ${interval}\n\n实时分析摘要:\n- Bias: ${analysis.bias}\n- Confidence: ${analysis.confidence}%\n- Risk: ${analysis.riskLevel}\n- Market regime: ${analysis.marketRegime}\n- Setup: ${analysis.setupType}\n- No trade: ${analysis.noTrade ? "yes" : "no"}\n- No trade reason: ${analysis.noTradeReason ?? "none"}\n- Support: ${analysis.supportLevel}\n- Resistance: ${analysis.resistanceLevel}\n- Invalidation: ${analysis.invalidation}\n- Summary: ${analysis.summary}\n\n驱动因素:\n${drivers || "  - 无"}\n\n主要风险:\n${risks || "  - 无"}\n\n条件场景:\n${scenarios || "  - 无"}\n\n多周期摘要:\n${multiTimeframe || "  - 无"}\n\n相关新闻:\n${headlines || "  - 无"}\n\n回答规则:\n${staticRules}`,
    };
  } catch {
    return {
      role: "system",
      content: `当前聊天上下文如下。\n\n工作模式:\n- Desk: ${getDeskLabel(desk)}\n\n市场:\n- Symbol: ${symbol}\n- Interval: ${interval}\n\n当前未能成功抓取实时分析上下文。\n\n回答规则:\n${staticRules}`,
    };
  }
}

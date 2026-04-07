import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
  type UIMessageStreamWriter,
} from "ai";
import { convertFullStreamChunkToUIMessageStream, convertMastraChunkToAISDKv5 } from "@mastra/core/stream";
import type { Agent } from "@mastra/core/agent";
import { NextRequest } from "next/server";

import { buildRulesOnlyMarketAnalysis } from "@/lib/analysis-runtime";
import {
  isMarketInterval,
  normalizeMarketSymbol,
  type MarketInterval,
  type MarketSymbol,
} from "@/lib/market";
import { mastra } from "@/src/mastra";
import {
  type CodexEventName,
  createCodexEventChunk,
  getMastraChunkPayload,
  getMastraChunkType,
  getStepFinishReason,
  getString,
  getToolFailureText,
  getToolResultPreviewUrl,
  getUsageFromMastraChunk,
} from "@/src/mastra/stream/codex-events";

const DEFAULT_SYMBOL: MarketSymbol = "BTCUSDT";
const DEFAULT_INTERVAL: MarketInterval = "1m";

type DeskMode = "auto" | "market" | "derivatives" | "news";
type ChatMode = "claude-style" | "balanced" | "deep-analysis" | "fast-brief";
type AgentId = "trading-chat" | "deep-research" | "market-analyst" | "derivatives-analyst" | "news-analyst";
type CodexEventWriter = (
  event: { eventName: CodexEventName } & Record<string, unknown>,
) => void;

const AGENT_LABELS: Record<AgentId, string> = {
  "trading-chat": "Trading Desk Supervisor",
  "deep-research": "Deep Research Trading Analyst",
  "market-analyst": "Market Structure Analyst",
  "derivatives-analyst": "Derivatives Analyst",
  "news-analyst": "News Analyst",
};

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
    const stream = createUIMessageStream({
      originalMessages: messages as never,
      onError: getErrorText,
      execute: async ({ writer }) => {
        const writeCodexEvent = (
          event: { eventName: CodexEventName } & Record<string, unknown>,
        ) => {
          writer.write(
            createCodexEventChunk({
              type: "stream.event",
              ...event,
            }) as never,
          );
        };
        const specialistIds = pickSpecialistAgentIds(desk, preferResearch, messages);
        const specialistResults = await Promise.all(
          specialistIds.map((agentId) =>
            streamSpecialistAgent({
              agentId,
              messages,
              marketContextMessage,
              signal: request.signal,
              writeCodexEvent,
            }),
          ),
        );

        const synthesisPrompt = buildSupervisorPrompt({
          symbol,
          interval,
          desk,
          preferResearch,
          userRequest: getLatestUserText(messages),
          specialistResults,
        });

        const supervisorAgentId: AgentId = preferResearch ? "deep-research" : "trading-chat";
        await streamSupervisorAgent({
          agentId: supervisorAgentId,
          prompt: synthesisPrompt,
          signal: request.signal,
          writeCodexEvent,
          writer,
          system: `${marketContextMessage}

你现在拿到的是多个子席位已经完成的研究结果。
- 不要再次委派给其他 agent
- 不要重复子席位原文
- 直接综合并给出最终判断`,
        });
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

function pickSpecialistAgentIds(
  desk: DeskMode,
  preferResearch: boolean,
  messages: UIMessage[],
): AgentId[] {
  if (preferResearch) {
    return ["market-analyst", "derivatives-analyst", "news-analyst"];
  }

  if (desk === "market") return ["market-analyst"];
  if (desk === "derivatives") return ["derivatives-analyst"];
  if (desk === "news") return ["news-analyst"];

  const latestUserText = getLatestUserText(messages).toLowerCase();
  const result = new Set<AgentId>(["market-analyst"]);

  if (/(funding|oi|open interest|持仓|多空比|清算|挤压|仓位)/i.test(latestUserText)) {
    result.add("derivatives-analyst");
  }

  if (/(news|headline|macro|etf|监管|宏观|消息|新闻)/i.test(latestUserText)) {
    result.add("news-analyst");
  }

  if (result.size === 1) {
    result.add("derivatives-analyst");
  }

  return [...result];
}

function getLatestUserText(messages: UIMessage[]) {
  const latestUserMessage = [...messages].reverse().find((message) => message.role === "user");
  if (!latestUserMessage) return "";

  return latestUserMessage.parts
    .map((part) => {
      if (part.type === "text") return part.text;
      return "";
    })
    .join("")
    .trim();
}

async function streamSpecialistAgent({
  agentId,
  messages,
  marketContextMessage,
  signal,
  writeCodexEvent,
}: {
  agentId: AgentId;
  messages: UIMessage[];
  marketContextMessage: string;
  signal: AbortSignal;
  writeCodexEvent: CodexEventWriter;
}) {
  const agent = mastra.getAgentById(agentId) as Agent;
  const startedToolCalls = new Set<string>();
  const finishedToolCalls = new Set<string>();
  let text = "";

  writeCodexEvent({
    eventName: "agent.handoff.started",
    targetId: agentId,
    targetName: AGENT_LABELS[agentId],
    targetType: "agent",
    agentId,
    depth: 1,
  });

  const result = await agent.stream(messages as never, {
    system: marketContextMessage,
    abortSignal: signal,
    maxSteps: agentId === "news-analyst" ? 2 : 3,
  });

  const reader = result.fullStream.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunkType = getMastraChunkType(value);
      const payload = getMastraChunkPayload(value);

      if (chunkType === "text-delta") {
        const delta = getString(payload, "text") ?? "";
        text += delta;
        writeCodexEvent({
          eventName: "agent.stream.delta",
          agentId,
          targetId: agentId,
          targetName: AGENT_LABELS[agentId],
          targetType: "agent",
          text: delta,
          streamType: "text",
          depth: 1,
        });
      }

      if (chunkType === "reasoning-delta") {
        writeCodexEvent({
          eventName: "agent.stream.delta",
          agentId,
          targetId: agentId,
          targetName: AGENT_LABELS[agentId],
          targetType: "agent",
          text: getString(payload, "text") ?? "",
          streamType: "reasoning",
          depth: 1,
        });
      }

      if (chunkType === "tool-call") {
        const toolCallId = getString(payload, "toolCallId");
        if (toolCallId && !startedToolCalls.has(toolCallId)) {
          startedToolCalls.add(toolCallId);
          writeCodexEvent({
            eventName: "tool.call.started",
            toolCallId,
            toolName: getString(payload, "toolName"),
            args: payload?.args,
            agentId,
            depth: 1,
          });
        }
      }

      if (chunkType === "tool-result") {
        const toolCallId = getString(payload, "toolCallId");
        const resultPayload = payload?.result;
        const errorText =
          getToolFailureText(resultPayload) ||
          (payload?.isError === true ? "Tool failed" : undefined);

        if (toolCallId && !finishedToolCalls.has(toolCallId)) {
          finishedToolCalls.add(toolCallId);
          writeCodexEvent({
            eventName: errorText ? "tool.call.failed" : "tool.call.completed",
            toolCallId,
            toolName: getString(payload, "toolName"),
            args: payload?.args,
            result: resultPayload,
            error: errorText,
            previewUrl: getToolResultPreviewUrl(resultPayload),
            agentId,
            depth: 1,
          });
        }
      }

      if (chunkType === "tool-error") {
        const toolCallId = getString(payload, "toolCallId");
        if (toolCallId && !finishedToolCalls.has(toolCallId)) {
          finishedToolCalls.add(toolCallId);
          writeCodexEvent({
            eventName: "tool.call.failed",
            toolCallId,
            toolName: getString(payload, "toolName"),
            args: payload?.args,
            error: payload?.error,
            agentId,
            depth: 1,
          });
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  writeCodexEvent({
    eventName: "agent.handoff.completed",
    targetId: agentId,
    targetName: AGENT_LABELS[agentId],
    targetType: "agent",
    agentId,
    depth: 1,
  });

  return {
    agentId,
    name: AGENT_LABELS[agentId],
    text: text.trim(),
  };
}

async function streamSupervisorAgent({
  agentId,
  prompt,
  signal,
  writeCodexEvent,
  writer,
  system,
}: {
  agentId: AgentId;
  prompt: string;
  signal: AbortSignal;
  writeCodexEvent: CodexEventWriter;
  writer: UIMessageStreamWriter<UIMessage>;
  system: string;
}) {
  const agent = mastra.getAgentById(agentId) as Agent;
  const startedToolCalls = new Set<string>();
  const finishedToolCalls = new Set<string>();
  const result = await agent.stream(prompt, {
    system,
    abortSignal: signal,
    maxSteps: 4,
  });
  const reader = result.fullStream.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const part = convertMastraChunkToAISDKv5({
        chunk: value,
        mode: "stream",
      });
      const chunkType = getMastraChunkType(value);
      const payload = getMastraChunkPayload(value);

      if (chunkType === "text-delta") {
        writeCodexEvent({
          eventName: "assistant.delta",
          text: getString(payload, "text") ?? "",
        });
      }

      if (chunkType === "reasoning-delta") {
        writeCodexEvent({
          eventName: "assistant.reasoning.delta",
          text: getString(payload, "text") ?? "",
          streamType: "reasoning",
        });
      }

      if (chunkType === "tool-call") {
        const toolCallId = getString(payload, "toolCallId");
        if (toolCallId && !startedToolCalls.has(toolCallId)) {
          startedToolCalls.add(toolCallId);
          writeCodexEvent({
            eventName: "tool.call.started",
            toolCallId,
            toolName: getString(payload, "toolName"),
            args: payload?.args,
          });
        }
      }

      if (chunkType === "tool-result") {
        const toolCallId = getString(payload, "toolCallId");
        const resultPayload = payload?.result;
        const errorText =
          getToolFailureText(resultPayload) ||
          (payload?.isError === true ? "Tool failed" : undefined);

        if (toolCallId && !finishedToolCalls.has(toolCallId)) {
          finishedToolCalls.add(toolCallId);
          writeCodexEvent({
            eventName: errorText ? "tool.call.failed" : "tool.call.completed",
            toolCallId,
            toolName: getString(payload, "toolName"),
            args: payload?.args,
            result: resultPayload,
            error: errorText,
            previewUrl: getToolResultPreviewUrl(resultPayload),
          });
        }
      }

      if (chunkType === "tool-error") {
        const toolCallId = getString(payload, "toolCallId");
        if (toolCallId && !finishedToolCalls.has(toolCallId)) {
          finishedToolCalls.add(toolCallId);
          writeCodexEvent({
            eventName: "tool.call.failed",
            toolCallId,
            toolName: getString(payload, "toolName"),
            args: payload?.args,
            error: payload?.error,
          });
        }
      }

      if (chunkType === "step-finish" || chunkType === "finish") {
        const usage = getUsageFromMastraChunk(value);
        if (usage) {
          writeCodexEvent({
            eventName: "usage.updated",
            usage,
          });
        }
      }

      if (chunkType === "finish") {
        writeCodexEvent({
          eventName: "session.ended",
          reason: getStepFinishReason(value) ?? "stop",
          status: "done",
        });
      }

      if (!part) continue;

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
}

function buildSupervisorPrompt({
  symbol,
  interval,
  desk,
  preferResearch,
  userRequest,
  specialistResults,
}: {
  symbol: MarketSymbol;
  interval: MarketInterval;
  desk: DeskMode;
  preferResearch: boolean;
  userRequest: string;
  specialistResults: Array<{ agentId: AgentId; name: string; text: string }>;
}) {
  return `
用户问题：
${userRequest || "请基于当前市场上下文给出交易结论。"}

任务上下文：
- Symbol: ${symbol}
- Interval: ${interval}
- Desk: ${desk}
- Research mode: ${preferResearch ? "deep-analysis" : "standard"}

下面是子分析席位的实时研究结果，请你像 Codex 风格的 supervisor 一样做最终综合：
- 明确引用各席位的结论，但不要逐字复述
- 如果席位之间冲突，先指出冲突，再给条件化判断
- 先给结论，再给触发条件、风险点、失效位
- 如果没有边际优势，直接给 wait / no-trade
- 不要再次委派

子席位结果：
${specialistResults
  .map(
    (result) => `### ${result.name} (${result.agentId})
${result.text || "该席位没有产出有效文本。"}
`,
  )
  .join("\n")}
`;
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

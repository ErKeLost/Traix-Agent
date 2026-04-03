import { NextRequest } from "next/server";

import {
  isMarketInterval,
  normalizeMarketSymbol,
  type MarketInterval,
  type MarketSymbol,
} from "@/lib/market";
import { mastra } from "@/src/mastra";

const DEFAULT_SYMBOL: MarketSymbol = "BTCUSDT";
const DEFAULT_INTERVAL: MarketInterval = "1m";
const CHAT_TIMEOUT_MS = 5000;

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      symbol?: string;
      interval?: string;
      message?: string;
      history?: Array<{
        role: "user" | "assistant";
        content: string;
      }>;
    };

    const rawSymbol = body.symbol ?? "";
    const rawInterval = body.interval ?? "";
    const symbol = normalizeMarketSymbol(rawSymbol) ?? DEFAULT_SYMBOL;
    const interval = isMarketInterval(rawInterval) ? rawInterval : DEFAULT_INTERVAL;
    const message = body.message?.trim();
    const history = Array.isArray(body.history) ? body.history.slice(-8) : [];

    if (!message) {
      return Response.json({ error: "Message is required." }, { status: 400 });
    }

    const fallbackAnswer = buildFallbackChatAnswer({ symbol, interval, message });

    if (!process.env.OPENROUTER_API_KEY) {
      return Response.json({ answer: fallbackAnswer });
    }

    try {
      const agent = mastra.getAgentById("trading-chat");
      const prompt = buildTradingChatPrompt({ symbol, interval, message, history });
      const result = await Promise.race([
        agent.generate(prompt),
        timeoutAfter(CHAT_TIMEOUT_MS, "Trading chat timed out."),
      ]);

      return Response.json({
        answer: result.text.trim() || fallbackAnswer,
      });
    } catch {
      return Response.json({ answer: fallbackAnswer });
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

function timeoutAfter(ms: number, message: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(message));
    }, ms);
  });
}

function buildTradingChatPrompt({
  symbol,
  interval,
  message,
  history,
}: {
  symbol: MarketSymbol;
  interval: MarketInterval;
  message: string;
  history: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
}) {
  const historyText = history
    .map((item) => `${item.role === "user" ? "用户" : "分析师"}: ${item.content}`)
    .join("\n");

  return `当前聊天上下文如下。

市场:
- Symbol: ${symbol}
- Interval: ${interval}

最近对话:
${historyText || "- 无"}

用户当前问题:
${message}

要求:
- 只围绕当前选中的币种和周期回答
- 如果用户问方向或入场，给条件式判断，不要装成确定预言
- 如果缺少实时价格或消息，不要编造，直接说明信息边界
- 用简洁中文回答，最多 6 句，不要复述全部上下文。`;
}

function buildFallbackChatAnswer({
  symbol,
  interval,
  message,
}: {
  symbol: MarketSymbol;
  interval: MarketInterval;
  message: string;
}) {
  return `当前聊天绑定的是 ${symbol} ${interval}。你问的是“${message}”。在没有额外实时分析数据时，先看趋势方向、关键支撑阻力、量能配合和失效位，再决定是追单、等回踩还是先观望。`;
}

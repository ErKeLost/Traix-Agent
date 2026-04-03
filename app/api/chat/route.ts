import { createUIMessageStream, createUIMessageStreamResponse, type UIMessage } from "ai";
import { NextRequest } from "next/server";
import { convertFullStreamChunkToUIMessageStream, convertMastraChunkToAISDKv5 } from "@mastra/core/stream";

import {
  isMarketInterval,
  normalizeMarketSymbol,
  type MarketInterval,
  type MarketSymbol,
} from "@/lib/market";
import { mastra } from "@/src/mastra";

const DEFAULT_SYMBOL: MarketSymbol = "BTCUSDT";
const DEFAULT_INTERVAL: MarketInterval = "1m";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      messages?: UIMessage[];
      symbol?: string;
      interval?: string;
    };

    const rawSymbol = body.symbol ?? "";
    const rawInterval = body.interval ?? "";
    const symbol = normalizeMarketSymbol(rawSymbol) ?? DEFAULT_SYMBOL;
    const interval = isMarketInterval(rawInterval) ? rawInterval : DEFAULT_INTERVAL;
    const messages = Array.isArray(body.messages) ? body.messages : [];

    if (messages.length === 0) {
      return Response.json({ error: "Messages are required." }, { status: 400 });
    }

    try {
      const agent = mastra.getAgentById("trading-chat");
      const contextualMessages: UIMessage[] = [
        buildMarketContextMessage(symbol, interval),
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

function buildMarketContextMessage(symbol: MarketSymbol, interval: MarketInterval): UIMessage {
  return {
    id: `market-context-${symbol}-${interval}`,
    role: "system",
    parts: [
      {
        type: "text",
        text: `当前聊天上下文如下。\n\n市场:\n- Symbol: ${symbol}\n- Interval: ${interval}\n\n要求:\n- 只围绕当前选中的币种和周期回答\n- 如果用户问方向或入场，给条件式判断，不要装成确定预言\n- 如果缺少实时价格或消息，不要编造，直接说明信息边界\n- 用简洁中文回答，优先短句，不要复述全部上下文。`,
      },
    ],
  }
}

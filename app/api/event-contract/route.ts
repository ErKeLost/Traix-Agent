import { generateText } from "ai";
import { NextRequest } from "next/server";
import { z } from "zod";

import { buildRulesOnlyMarketAnalysis } from "@/lib/analysis-runtime";
import {
  isMarketInterval,
  normalizeMarketSymbol,
  type MarketAnalysisPayload,
  type MarketInterval,
  type MarketSymbol,
} from "@/lib/market";
import { hasTradingModelAccess, resolveTradingModel } from "@/src/mastra/agents/model";

const DEFAULT_SYMBOL: MarketSymbol = "BTCUSDT";
const DEFAULT_INTERVAL: MarketInterval = "1m";

const eventContractSchema = z.object({
  stance: z.enum(["long", "short", "wait"]),
  label: z.enum(["看多", "看空", "观望"]),
  confidence: z.number().min(0).max(100),
  contractQuestion: z.string().min(1),
  timeHorizon: z.string().min(1),
  thesis: z.string().min(1),
  drivers: z.array(z.string()).min(2).max(4),
  risks: z.array(z.string()).min(1).max(3),
});

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  let symbol: MarketSymbol = DEFAULT_SYMBOL;
  let interval: MarketInterval = DEFAULT_INTERVAL;

  try {
    if (!hasTradingModelAccess()) {
      console.error("[event-contract] trading model is not configured");
      return Response.json({ error: "Trading model is not configured." }, { status: 503 });
    }

    const body = (await request.json()) as {
      symbol?: string;
      interval?: string;
    };

    const rawInterval = body.interval ?? "";
    symbol = normalizeMarketSymbol(body.symbol ?? "") ?? DEFAULT_SYMBOL;
    interval = isMarketInterval(rawInterval) ? rawInterval : DEFAULT_INTERVAL;

    console.log("[event-contract] request", {
      symbol,
      interval,
      startedAt: new Date(startedAt).toISOString(),
    });

    const analysis = await buildRulesOnlyMarketAnalysis(symbol, interval);
    const timeHorizon = getEventContractHorizon(interval);

    console.log("[event-contract] analysis ready", {
      symbol,
      interval,
      bias: analysis.bias,
      confidence: analysis.confidence,
      noTrade: analysis.noTrade,
      riskLevel: analysis.riskLevel,
      elapsedMs: Date.now() - startedAt,
    });

    const result = await generateText({
      model: resolveTradingModel(),
      system: `你是加密事件合约分析员。你的任务不是写长文，而是给出能直接下判断的事件合约结论。

规则：
- 只能输出 看多 / 看空 / 观望 三种结论
- 如果证据不足或边际优势不够，必须选 观望
- 不要编造新闻、链上、订单流
- 置信度必须保守，只有在多条主线共振时才允许高于 72
- contractQuestion 必须是一个明确的二元事件问题
- thesis 用 2 到 3 句中文
- drivers 聚焦最关键依据
- risks 聚焦会推翻结论的因素

你必须只返回一个 JSON 对象，不要输出 markdown，不要输出代码块，不要输出额外解释。
JSON 结构必须是：
{
  "stance": "long" | "short" | "wait",
  "label": "看多" | "看空" | "观望",
  "confidence": 0-100 的数字,
  "contractQuestion": "字符串",
  "timeHorizon": "字符串",
  "thesis": "字符串",
  "drivers": ["字符串", "..."],
  "risks": ["字符串", "..."]
}`,
      prompt: `请基于以下实时规则分析，为 ${symbol} 生成一个事件合约判断。

当前图表周期：${interval}
建议观察窗口：${timeHorizon}

规则分析：
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

请直接输出 JSON。`,
    });

    console.log("[event-contract] model response received", {
      symbol,
      interval,
      textLength: result.text.length,
      preview: result.text.slice(0, 400),
      elapsedMs: Date.now() - startedAt,
    });

    const parsedJson = result.text.trim().length > 0 ? safeParseJsonObject(result.text) : null;
    const validated = parsedJson ? eventContractSchema.safeParse(parsedJson) : null;

    const finalResult = validated?.success
      ? validated.data
      : buildFallbackEventContract({
          symbol,
          interval,
          timeHorizon,
          analysis,
        });

    if (!validated) {
      console.warn("[event-contract] model returned empty text, using fallback", {
        symbol,
        interval,
        elapsedMs: Date.now() - startedAt,
      });
    } else if (!validated.success) {
      console.warn("[event-contract] schema validation failed, using fallback", {
        symbol,
        interval,
        issues: validated.error.issues,
        parsedJson,
        elapsedMs: Date.now() - startedAt,
      });
    } else {
      console.log("[event-contract] schema validation passed", {
        symbol,
        interval,
        stance: validated.data.stance,
        confidence: validated.data.confidence,
        elapsedMs: Date.now() - startedAt,
      });
    }

    return Response.json({
      symbol,
      interval,
      analysisTimestamp: Date.now(),
      result: finalResult,
      fallbackUsed: !validated?.success,
      marketContext: {
        bias: analysis.bias,
        confidence: analysis.confidence,
        riskLevel: analysis.riskLevel,
        summary: analysis.summary,
        marketRegime: analysis.marketRegime,
        setupType: analysis.setupType,
        noTrade: analysis.noTrade,
        noTradeReason: analysis.noTradeReason,
        supportLevel: analysis.supportLevel,
        resistanceLevel: analysis.resistanceLevel,
        invalidation: analysis.invalidation,
        fundingRate: analysis.derivatives.fundingRate,
        openInterestChangePercent: analysis.derivatives.openInterestChangePercent,
        takerBuySellRatio: analysis.derivatives.takerBuySellRatio,
        multiTimeframe: analysis.multiTimeframe,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Event contract analysis failed.";
    console.error("[event-contract] request failed", {
      symbol,
      interval,
      message,
      stack: error instanceof Error ? error.stack : undefined,
      elapsedMs: Date.now() - startedAt,
    });
    return Response.json({ error: message }, { status: 500 });
  }
}

function getEventContractHorizon(interval: MarketInterval) {
  if (interval === "1s") return "未来5分钟";
  if (interval === "1m") return "未来10分钟";
  if (interval === "5m") return "未来30分钟";
  if (interval === "15m") return "未来1小时";
  if (interval === "1h") return "未来4小时";
  if (interval === "4h") return "未来1天";
  return "未来3天";
}

function safeParseJsonObject(text: string) {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("Model did not return JSON.");
    }

    return JSON.parse(match[0]);
  }
}

function buildFallbackEventContract({
  symbol,
  interval,
  timeHorizon,
  analysis,
}: {
  symbol: MarketSymbol;
  interval: MarketInterval;
  timeHorizon: string;
  analysis: MarketAnalysisPayload;
}) {
  const stance =
    analysis.noTrade || analysis.bias === "neutral"
      ? "wait"
      : analysis.bias === "bullish"
        ? "long"
        : "short";
  const label = stance === "long" ? "看多" : stance === "short" ? "看空" : "观望";
  const confidence = Math.min(
    stance === "wait" ? Math.max(38, analysis.confidence - 12) : analysis.confidence,
    78,
  );
  const directionText =
    stance === "long" ? "继续走高" : stance === "short" ? "继续走低" : "走出明确方向";
  const contractQuestion = `${symbol} 在${timeHorizon}内是否会${directionText}？`;
  const multiTimeframeAligned =
    analysis.multiTimeframe.filter((item) => item.bias === analysis.bias).length >= 2;

  return {
    stance,
    label,
    confidence,
    contractQuestion,
    timeHorizon,
    thesis:
      stance === "wait"
        ? `当前 ${interval} 周期下边际优势不足，规则分析更接近观望而不是强做方向。${analysis.noTradeReason ?? analysis.summary}`
        : `当前 ${interval} 周期的规则分析偏向${label}，核心依据来自 ${analysis.marketRegime} 与 ${analysis.setupType}。${analysis.summary}${multiTimeframeAligned ? " 多周期方向大体一致。" : " 多周期并未完全共振。"} `,
    drivers: [
      `当前分析直接基于 ${symbol} 的实时 Binance K 线、盘口快照、衍生品数据与新闻上下文。`,
      ...analysis.drivers,
    ].slice(0, 3),
    risks: (analysis.noTradeReason ? [analysis.noTradeReason, ...analysis.risks] : analysis.risks).slice(0, 3),
  };
}

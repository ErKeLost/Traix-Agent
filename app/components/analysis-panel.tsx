"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

import type { MarketAnalysisPayload } from "@/lib/market";
import { formatCompact, formatPrice, formatSignedPercent } from "./shared/format";

type AnalysisPanelProps = {
  analysis: MarketAnalysisPayload | null;
  error: string | null;
};

export function AnalysisPanel({ analysis, error }: AnalysisPanelProps) {
  if (error) {
    return (
      <Card className="panel-surface rounded-lg border py-0 shadow-none">
        <CardHeader className="flex-col items-start gap-0 px-3 pt-3 pb-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            AI Analysis
          </p>
          <CardTitle className="text-sm font-semibold text-white">
            规则分析引擎
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3">
          <p className="mt-2 text-xs text-amber-300">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!analysis) {
    return (
      <Card className="panel-surface rounded-lg border py-0 shadow-none">
        <CardHeader className="flex-col items-start gap-0 px-3 pt-3 pb-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            AI Analysis
          </p>
          <CardTitle className="text-sm font-semibold text-white">
            规则分析引擎
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 px-3 pb-3">
          <Skeleton className="h-20 rounded bg-white/5" />
          <Skeleton className="h-28 rounded bg-white/5" />
          <Skeleton className="h-20 rounded bg-white/5" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="panel-surface rounded-lg border py-0 shadow-none">
      <CardHeader className="flex-col items-start gap-0 px-3 pt-3 pb-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          AI Analysis
        </p>
        <CardTitle className="text-sm font-semibold text-white">
          规则分析引擎
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <ScrollArea className="mt-2 max-h-[800px] px-3 pb-3">
          <div className="space-y-2 pr-3">
            <div className="rounded-md border border-white/5 bg-white/[0.02] px-3 py-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[0.15em] text-slate-500">Bias</span>
                <span className={`text-xs font-semibold ${biasTone(analysis.bias)}`}>
                  {analysis.bias.toUpperCase()}
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-5 text-slate-200">{analysis.summary}</p>
              <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                <span>Confidence {analysis.confidence}%</span>
                <span>Risk {analysis.riskLevel}</span>
              </div>
            </div>

            <div className="rounded-md border border-white/5 bg-white/[0.02] px-3 py-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[0.15em] text-slate-500">
                  Signal
                </span>
                <Badge
                  variant="outline"
                  className={`h-5 border-0 text-[10px] font-semibold ${
                    analysis.noTrade
                      ? "bg-amber-500/15 text-amber-300"
                      : "bg-emerald-500/15 text-emerald-300"
                  }`}
                >
                  {analysis.noTrade ? "NO TRADE" : "TRADEABLE"}
                </Badge>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <MiniRow label="Setup" value={analysis.setupType} />
                <MiniRow label="Support" value={formatPrice(analysis.supportLevel)} />
                <MiniRow label="Resistance" value={formatPrice(analysis.resistanceLevel)} />
                <MiniRow label="Invalidation" value={analysis.invalidation} />
              </div>
              {analysis.noTradeReason && (
                <p className="mt-2 text-xs leading-5 text-amber-200/80">
                  {analysis.noTradeReason}
                </p>
              )}
            </div>

            {analysis.aiNarrative && (
              <div className="rounded-md border border-cyan-400/15 bg-cyan-400/5 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-[0.15em] text-cyan-300/60">
                  Mastra Analyst
                </p>
                <p className="mt-1.5 text-xs leading-5 text-cyan-100/90">
                  {analysis.aiNarrative}
                </p>
              </div>
            )}

            {analysis.agentNarratives.news && (
              <AgentCard title="News Agent" text={analysis.agentNarratives.news} />
            )}
            {analysis.agentNarratives.derivatives && (
              <AgentCard title="Derivatives Agent" text={analysis.agentNarratives.derivatives} />
            )}

            <Accordion type="single" collapsible>
              <AccordionItem value="desk-panels" className="border-b-0">
                <AccordionTrigger className="px-3 py-2 text-xs font-semibold text-white hover:no-underline">
                  Desk Panels
                </AccordionTrigger>
                <AccordionContent className="space-y-3 px-0 pb-2">
                  {analysis.aiChecklist.length > 0 && (
                    <div>
                      <p className="mb-2 text-[10px] uppercase tracking-[0.15em] text-slate-500">
                        Checklist
                      </p>
                      <div className="space-y-1">
                        {analysis.aiChecklist.map((item) => (
                          <div
                            key={item}
                            className="rounded-md border border-cyan-400/10 bg-cyan-400/5 px-3 py-1.5 text-xs leading-5 text-cyan-100/80"
                          >
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="mb-2 text-[10px] uppercase tracking-[0.15em] text-slate-500">
                      Derivatives
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      <MiniRow label="Funding" value={formatSignedPercent(analysis.derivatives.fundingRate * 100)} />
                      <MiniRow label="OI" value={formatCompact(analysis.derivatives.openInterest)} />
                      <MiniRow label="OI Change" value={formatSignedPercent(analysis.derivatives.openInterestChangePercent)} />
                      <MiniRow label="Top L/S" value={analysis.derivatives.longShortRatio.toFixed(2)} />
                      <MiniRow label="Global L/S" value={analysis.derivatives.globalLongShortRatio.toFixed(2)} />
                      <MiniRow label="Top Pos L/S" value={analysis.derivatives.topPositionLongShortRatio.toFixed(2)} />
                      <MiniRow label="Taker B/S" value={analysis.derivatives.takerBuySellRatio.toFixed(2)} />
                    </div>
                  </div>

                  {analysis.headlines.length > 0 && (
                    <div>
                      <p className="mb-2 text-[10px] uppercase tracking-[0.15em] text-slate-500">
                        News
                      </p>
                      <div className="space-y-1">
                        {analysis.headlines.slice(0, 5).map((h) => (
                          <a
                            key={`${h.link}-${h.publishedAt}`}
                            href={h.link}
                            target="_blank"
                            rel="noreferrer"
                            className="block rounded-md border border-white/5 bg-white/[0.02] px-3 py-2 text-xs leading-5 text-slate-300 transition hover:border-cyan-400/20 hover:bg-cyan-400/5"
                          >
                            <span className="text-[10px] uppercase tracking-[0.15em] text-slate-500">
                              {h.source}
                            </span>
                            <p className="mt-1">{h.title}</p>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {analysis.multiTimeframe.length > 0 && (
                    <div>
                      <p className="mb-2 text-[10px] uppercase tracking-[0.15em] text-slate-500">
                        Multi Timeframe
                      </p>
                      <div className="space-y-1">
                        {analysis.multiTimeframe.map((item) => (
                          <div
                            key={item.interval}
                            className="flex items-center justify-between rounded-md border border-white/5 bg-white/[0.02] px-3 py-1.5"
                          >
                            <span className="text-xs font-semibold text-white">{item.interval}</span>
                            <Badge variant="outline" className={`text-[10px] font-semibold ${biasTone(item.bias)}`}>
                              {item.bias.toUpperCase()}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {analysis.headlineImpacts.length > 0 && (
                    <div>
                      <p className="mb-2 text-[10px] uppercase tracking-[0.15em] text-slate-500">
                        News Impact
                      </p>
                      <div className="space-y-1">
                        {analysis.headlineImpacts.map((item) => (
                          <div
                            key={`${item.source}-${item.title}`}
                            className="rounded-md border border-white/5 bg-white/[0.02] px-3 py-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] uppercase tracking-[0.15em] text-slate-500">
                                {item.source}
                              </span>
                              <Badge variant="outline" className={`text-[10px] font-semibold ${biasTone(item.impact)}`}>
                                {item.impact.toUpperCase()}
                              </Badge>
                            </div>
                            <p className="mt-1 text-xs text-white">{item.title}</p>
                            <p className="mt-1 text-[10px] leading-4 text-slate-500">{item.reason}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(["drivers", "risks", "scenarios"] as const).map((key) => {
                    const items = analysis[key];
                    if (!items.length) return null;
                    const tone = key === "risks" ? "risk" : key === "scenarios" ? "scenario" : "neutral";
                    return (
                      <div key={key}>
                        <p className="mb-2 text-[10px] uppercase tracking-[0.15em] text-slate-500 capitalize">
                          {key}
                        </p>
                        <div className="space-y-1">
                          {items.map((item) => (
                            <div
                              key={item}
                              className={`rounded-md border px-3 py-1.5 text-xs leading-5 ${
                                tone === "risk"
                                  ? "border-amber-500/15 bg-amber-500/5 text-amber-100/80"
                                  : tone === "scenario"
                                    ? "border-cyan-400/15 bg-cyan-400/5 text-cyan-100/80"
                                    : "border-white/5 bg-white/[0.02] text-slate-200"
                              }`}
                            >
                              {item}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function MiniRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/5 bg-white/[0.02] px-2.5 py-1.5">
      <p className="text-[10px] text-slate-500">{label}</p>
      <p className="text-xs font-semibold text-white">{value}</p>
    </div>
  );
}

function AgentCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-md border border-white/5 bg-white/[0.02] px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500">{title}</p>
      <p className="mt-1.5 text-xs leading-5 text-slate-200">{text}</p>
    </div>
  );
}

function biasTone(bias: MarketAnalysisPayload["bias"]) {
  if (bias === "bullish") return "text-emerald-400";
  if (bias === "bearish") return "text-rose-400";
  return "text-slate-200";
}

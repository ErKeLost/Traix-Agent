"use client";

import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { MarketInterval, MarketSymbol } from "@/lib/market";

type ChatPanelProps = {
  symbol: MarketSymbol;
  interval: MarketInterval;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const SUGGESTIONS = [
  "现在这个位置是突破还是假突破？",
  "把 1m/5m/15m 结构一起讲一下。",
  "结合新闻和衍生品，说说当前风险。",
  "如果我要等更稳的入场，应该观察什么？",
] as const;

export function ChatPanel({ symbol, interval }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<"ready" | "loading" | "error">("ready");
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  async function submit(text: string) {
    const content = text.trim();

    if (!content || status === "loading") {
      return;
    }

    const nextUserMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      content,
    };

    setInput("");
    setError(null);
    setStatus("loading");
    setMessages((current) => [...current, nextUserMessage]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          interval,
          message: content,
          history: messages.slice(-6).map((item) => ({
            role: item.role,
            content: item.content,
          })),
        }),
      });

      const payload = (await response.json()) as {
        answer?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "Chat request failed.");
      }

      setMessages((current) => [
        ...current,
        {
          id: `${Date.now()}-assistant`,
          role: "assistant",
          content: payload.answer ?? "没有拿到有效回复。",
        },
      ]);
      setStatus("ready");
    } catch (requestError) {
      setStatus("error");
      setError(
        requestError instanceof Error ? requestError.message : "Chat request failed.",
      );
    }
  }

  return (
    <div className="fixed bottom-6 right-5 z-30 flex flex-col items-end gap-3">
      {isOpen && (
        <Card className="w-[34rem] max-w-[calc(100vw-1.5rem)] border border-[#2f3a47] bg-[#121922] py-0 shadow-[0_32px_90px_rgba(0,0,0,0.55)]">
          <CardHeader className="items-start justify-between gap-3 border-b border-white/8 px-5 py-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Analyst console
              </p>
              <h2 className="mt-1 text-base font-medium tracking-[-0.03em] text-[#f3eee5]">
                {symbol} · {interval}
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                用当前市场上下文做条件式分析，不给伪确定性结论。
              </p>
            </div>
            <Badge
              variant="outline"
              className={`border px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] ${
                status === "loading"
                  ? "border-[#536982] bg-[#1c2835] text-[#a9bdd3]"
                  : status === "error"
                    ? "border-amber-500/20 bg-amber-500/10 text-amber-200"
                    : "border-white/8 bg-white/5 text-slate-400"
              }`}
            >
              {status === "loading" ? "Thinking" : status === "error" ? "Error" : "Ready"}
            </Badge>
          </CardHeader>

          <CardContent className="space-y-4 px-5 py-4">
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <Button
                  key={suggestion}
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={status === "loading"}
                  className="h-8 rounded-full border border-white/8 bg-white/4 px-3 text-xs text-slate-300 hover:bg-white/8"
                  onClick={() => {
                    void submit(suggestion);
                  }}
                >
                  {suggestion}
                </Button>
              ))}
            </div>

            <div ref={scrollRef} className="h-[320px] space-y-3 overflow-y-auto rounded-2xl border border-white/8 bg-[#0d141b] p-4">
              {messages.length === 0 ? (
                <div className="space-y-2 pt-1">
                  <p className="text-sm text-slate-400">切到哪个币种，聊天上下文就跟到哪个币种。</p>
                  <ul className="space-y-1.5 text-sm text-slate-500">
                    <li>· 问走势会给条件式分析，不会装成确定预言</li>
                    <li>· 问入场会给确认位和失效位</li>
                    <li>· 多时间周期结构会综合对比</li>
                  </ul>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`rounded-2xl border px-3 py-3 ${
                      message.role === "user"
                        ? "ml-10 border-[#4f647d]/35 bg-[#17222d]"
                        : "mr-10 border-white/8 bg-white/4"
                    }`}
                  >
                    <p className="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-slate-500">
                      {message.role === "user" ? "You" : "Analyst"}
                    </p>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-slate-100">
                      {message.content}
                    </p>
                  </div>
                ))
              )}
            </div>

            {error ? (
              <p className="rounded-xl border border-amber-500/20 bg-amber-500/8 px-3 py-2 text-sm text-amber-300">
                {error}
              </p>
            ) : null}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submit(input);
              }}
              className="space-y-2"
            >
              <Textarea
                value={input}
                onChange={(e) => setInput(e.currentTarget.value)}
                placeholder={`问 ${symbol} ${interval} 的走势…`}
                rows={3}
                className="w-full resize-y rounded-2xl border-[#354252] bg-[#0d141b] px-3 py-3 text-sm text-slate-100 placeholder:text-slate-500"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void submit(input);
                  }
                }}
              />
              <div className="flex justify-end">
                <Button
                  type="submit"
                  className="rounded-full bg-[#c9a05e] px-5 text-[#11161d] hover:bg-[#d3ab6d]"
                  disabled={!input.trim() || status === "loading"}
                >
                  发送
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Button
        type="button"
        size="default"
        variant="secondary"
        aria-label={isOpen ? "关闭聊天" : "打开聊天"}
        className="h-12 rounded-full border border-white/10 bg-[#121922]/92 px-3 text-[#ece7de] shadow-[0_18px_60px_rgba(0,0,0,0.34)] backdrop-blur-xl hover:bg-[#18202a]"
        onClick={() => setIsOpen((value) => !value)}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1e2935] text-slate-300">
          {isOpen ? (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z" />
            </svg>
          )}
        </span>
        <span className="ml-2 flex flex-col items-start leading-none">
          <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">AI desk</span>
          <span className="mt-1 text-sm font-medium text-[#f3eee5]">{isOpen ? "Close analyst" : "Open analyst"}</span>
        </span>
      </Button>
    </div>
  );
}

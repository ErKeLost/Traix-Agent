"use client";

import { Button, Card, Chip, TextArea } from "@heroui/react";
import { useEffect, useRef, useState } from "react";

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
      {/* 聊天面板 */}
      {isOpen && (
        <Card className="w-[600px] max-w-[calc(100vw-1.5rem)] border border-[#1a314d] bg-[#081526] shadow-[0_24px_60px_rgba(0,0,0,0.55)]">
          <Card.Header className="items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  AI 分析
                </p>
                <h2 className="text-sm font-semibold text-white">
                  {symbol} · {interval}
                </h2>
              </div>
              <Chip
                size="sm"
                variant="flat"
                className={`border-0 ${
                  status === "loading"
                    ? "bg-cyan-500/12 text-cyan-300"
                    : status === "error"
                      ? "bg-amber-500/12 text-amber-300"
                      : "bg-white/6 text-slate-400"
                }`}
              >
                {status === "loading" ? "Thinking" : status === "error" ? "Error" : "Ready"}
              </Chip>
            </Card.Header>

            <Card.Content className="space-y-3 px-4 py-3">
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((suggestion) => (
                  <Button
                    key={suggestion}
                    size="sm"
                    variant="ghost"
                    isDisabled={status === "loading"}
                    className="h-7 rounded-full bg-white/5 px-3 text-xs text-slate-300"
                    onClick={() => {
                      void submit(suggestion);
                    }}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>

              <div ref={scrollRef} className="h-[320px] space-y-3 overflow-y-auto rounded-xl border border-white/10 bg-[#061224] p-3">
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
                      className={`rounded-xl border px-3 py-2.5 ${
                        message.role === "user"
                          ? "ml-10 border-cyan-400/20 bg-cyan-400/8"
                          : "mr-10 border-white/8 bg-white/4"
                      }`}
                    >
                      <p className="mb-1 text-[10px] uppercase tracking-widest text-slate-500">
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
                <TextArea
                  value={input}
                  onChange={(e) => setInput(e.currentTarget.value)}
                  placeholder={`问 ${symbol} ${interval} 的走势…`}
                  rows={3}
                  className="w-full resize-y rounded-xl border border-[#244565] bg-[#0b1c31] px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-500"
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
                    color="primary"
                    className="rounded-full px-5"
                    isDisabled={!input.trim() || status === "loading"}
                  >
                    发送
                  </Button>
                </div>
              </form>
            </Card.Content>
          </Card>
        )}

      {/* 触发按钮 */}
      <Button onPress={() => console.log("Button pressed")}>Click me</Button>
      <Button
        isIconOnly
        aria-label={isOpen ? "关闭聊天" : "打开聊天"}
        className="h-12 w-12 shrink-0 rounded-full bg-[#fba] text-white ring-1 ring-white/10 hover:bg-[#122540]"
        onClick={() => setIsOpen((v) => !v)}
      >
        {isOpen ? (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z" />
          </svg>
        )}
      </Button>
    </div>
  );
}

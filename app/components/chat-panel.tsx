"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  ActivityIcon,
  BotIcon,
  CopyIcon,
  GlobeIcon,
  SparklesIcon,
} from "lucide-react";

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputButton,
  PromptInputBody,
  PromptInputFooter,
  PromptInputProvider,
  PromptInputStop,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MarketInterval, MarketSymbol } from "@/lib/market";

type ChatPanelProps = {
  symbol: MarketSymbol;
  interval: MarketInterval;
};

type DeskMode = "auto" | "market" | "derivatives" | "news";

const DESK_MODES: Array<{
  value: DeskMode;
  label: string;
  eyebrow: string;
  detail: string;
}> = [
  {
    value: "auto",
    label: "自动路由",
    eyebrow: "Supervisor",
    detail: "总控席位按问题调度结构、衍生品、宏观分析。",
  },
  {
    value: "market",
    label: "结构席位",
    eyebrow: "Market",
    detail: "聚焦支撑阻力、走势节奏、触发与失效位。",
  },
  {
    value: "derivatives",
    label: "衍生品席位",
    eyebrow: "Derivatives",
    detail: "聚焦资金费率、持仓量、仓位拥挤和挤压风险。",
  },
  {
    value: "news",
    label: "宏观新闻席位",
    eyebrow: "Macro",
    detail: "聚焦宏观、监管、突发事件对风险偏好的影响。",
  },
];

const QUICK_PROMPTS = [
  "给我一版当前结构判断和失效位",
  "这个位置如果要做，触发条件是什么？",
  "衍生品仓位现在是支持趋势还是过热？",
  "新闻和宏观面对这个币偏利多还是偏压制？",
];

export function ChatPanel({ symbol, interval }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [desk, setDesk] = useState<DeskMode>("auto");
  const chatId = `trading-chat-${symbol}-${interval}`;
  const { clearError, error, messages, sendMessage, status, stop } = useChat({
    id: chatId,
    transport: new DefaultChatTransport({
      api: "/api/chat",
    }),
  });

  async function submit(text: string) {
    const content = text.trim();

    if (!content || status === "submitted" || status === "streaming") {
      return;
    }

    setInput("");
    clearError();
    await sendMessage(
      { text: content },
      {
        body: {
          symbol,
          interval,
          desk,
        },
      },
    );
  }

  const isStreaming = status === "submitted" || status === "streaming";
  const activeDesk = DESK_MODES.find((item) => item.value === desk) ?? DESK_MODES[0];

  function submitQuickPrompt(prompt: string) {
    void submit(prompt);
  }

  return (
    <div className="fixed bottom-6 right-5 z-30 flex flex-col items-end gap-3">
      {isOpen ? (
        <div
          className="relative flex min-h-0 overflow-hidden rounded-[30px] border border-white/10 bg-[#0c1218] shadow-[0_36px_120px_rgba(0,0,0,0.56)]"
          style={{
            width: "min(960px, calc(100vw - 20px))",
            height: "min(820px, calc(100vh - 20px))",
          }}
        >
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-[-14%] top-[-18%] h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(201,160,94,0.14),transparent_60%)] blur-3xl" />
            <div className="absolute right-[-16%] top-[8%] h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(73,96,122,0.2),transparent_62%)] blur-3xl" />
            <div className="absolute inset-y-0 left-[250px] w-px bg-gradient-to-b from-transparent via-white/8 to-transparent max-md:hidden" />
          </div>

          <aside className="relative hidden w-[250px] shrink-0 border-r border-white/8 bg-[linear-gradient(180deg,rgba(15,21,29,0.96)_0%,rgba(11,16,22,0.98)_100%)] md:flex md:flex-col">
            <div className="border-b border-white/8 px-5 py-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#8b7143]">
                Next-generation desk
              </p>
              <h2 className="mt-2 text-[1.3rem] font-medium tracking-[-0.05em] text-[#f3eee5]">
                Multi-agent analyst
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                不是单一聊天窗，而是一个会路由、会综合、会按交易席位分工的分析控制台。
              </p>
            </div>

            <div className="space-y-2 px-3 py-4">
              {DESK_MODES.map((item) => {
                const isActive = desk === item.value;

                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setDesk(item.value)}
                    className={`w-full rounded-[20px] border px-4 py-3 text-left transition-colors ${
                      isActive
                        ? "border-[#8b7143]/38 bg-[linear-gradient(180deg,#18212c_0%,#121923_100%)] shadow-[0_14px_28px_rgba(0,0,0,0.18)]"
                        : "border-white/8 bg-white/[0.02] hover:border-white/12 hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className={`text-[10px] uppercase tracking-[0.22em] ${isActive ? "text-[#c9a05e]" : "text-slate-500"}`}>
                          {item.eyebrow}
                        </p>
                        <p className="mt-1 text-sm font-medium text-[#eef2f7]">{item.label}</p>
                      </div>
                      <span className={`h-2 w-2 rounded-full ${isActive ? "bg-[#c9a05e]" : "bg-slate-600"}`} />
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-500">{item.detail}</p>
                  </button>
                );
              })}
            </div>

            <div className="mt-auto border-t border-white/8 px-5 py-4">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-slate-500">
                <ActivityIcon className="size-3.5 text-[#8b7143]" />
                Session state
              </div>
              <div className="mt-3 space-y-2 text-sm text-slate-300">
                <div className="flex items-center justify-between rounded-full border border-white/8 bg-white/[0.03] px-3 py-2">
                  <span>Symbol</span>
                  <span className="font-medium text-[#f3eee5]">{symbol}</span>
                </div>
                <div className="flex items-center justify-between rounded-full border border-white/8 bg-white/[0.03] px-3 py-2">
                  <span>Interval</span>
                  <span className="font-medium text-[#f3eee5]">{interval}</span>
                </div>
              </div>
            </div>
          </aside>

          <div className="relative flex min-h-0 flex-1 flex-col">
            <div className="border-b border-white/8 px-4 py-4 md:px-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-slate-500">
                    Analyst control room
                  </p>
                  <div className="mt-2 flex flex-wrap items-end gap-3">
                    <h3 className="text-[1.15rem] font-medium tracking-[-0.04em] text-[#f3eee5]">
                      {symbol} · {interval}
                    </h3>
                    <span className="pb-0.5 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                      {activeDesk.label}
                    </span>
                  </div>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                    {activeDesk.value === "auto"
                      ? "总控席位会根据问题自动调度市场结构、衍生品和宏观分析，再统一输出交易判断。"
                      : activeDesk.detail}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <Badge
                    variant="outline"
                    className={`border px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] ${
                      isStreaming
                        ? "border-[#536982] bg-[#1c2835] text-[#a9bdd3]"
                        : error
                          ? "border-amber-500/20 bg-amber-500/10 text-amber-200"
                          : "border-white/8 bg-white/5 text-slate-400"
                    }`}
                  >
                    {isStreaming ? "Streaming" : error ? "Error" : "Live Desk"}
                  </Badge>
                  <div className="hidden items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-[11px] text-slate-400 md:flex">
                    <BotIcon className="size-3.5 text-[#8b7143]" />
                    {desk === "auto" ? "3 analysts armed" : `${activeDesk.eyebrow} pinned`}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex gap-2 overflow-x-auto pb-1 md:hidden">
                {DESK_MODES.map((item) => {
                  const isActive = desk === item.value;

                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setDesk(item.value)}
                      className={`shrink-0 rounded-full border px-3 py-2 text-sm transition-colors ${
                        isActive
                          ? "border-[#8b7143]/38 bg-[#18212c] text-[#f3eee5]"
                          : "border-white/10 bg-white/[0.03] text-slate-400"
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col px-3 py-3 md:px-4 md:py-4">
              <div className="relative min-h-0 flex-1 overflow-hidden rounded-[26px] border border-white/8 bg-[#0b1117]/92">
                <PromptInputProvider>
                  <Conversation className="size-full">
                    <ConversationContent>
                      {messages.length === 0 ? (
                        <ConversationEmptyState
                          icon={<SparklesIcon className="size-6" />}
                          title={`${symbol} ${interval} multi-agent stream`}
                          description="问方向、结构、仓位拥挤、宏观冲击或完整交易计划。你也可以固定到某一个席位，只听那一位分析。"
                        >
                          <div className="mt-6 flex max-w-2xl flex-wrap justify-center gap-2">
                            {QUICK_PROMPTS.map((prompt) => (
                              <button
                                key={prompt}
                                type="button"
                                onClick={() => submitQuickPrompt(prompt)}
                                className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-300 transition-colors hover:border-[#8b7143]/32 hover:bg-[#151d27] hover:text-[#f3eee5]"
                              >
                                {prompt}
                              </button>
                            ))}
                          </div>
                        </ConversationEmptyState>
                      ) : (
                        messages.map((message, index) => (
                          <ChatMessageItem
                            key={message.id}
                            isLastMessage={index === messages.length - 1}
                            isStreaming={isStreaming}
                            message={message}
                          />
                        ))
                      )}
                    </ConversationContent>
                    <ConversationScrollButton />
                  </Conversation>
                </PromptInputProvider>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#0b1117] to-transparent" />
              </div>

              {error ? (
                <p className="mt-3 rounded-[18px] border border-amber-500/20 bg-amber-500/8 px-3 py-2 text-sm text-amber-300">
                  {error.message}
                </p>
              ) : null}

              <div className="mt-3 rounded-[26px] border border-white/8 bg-[linear-gradient(180deg,rgba(14,20,27,0.98)_0%,rgba(11,16,22,0.98)_100%)] p-1.5">
                <PromptInput
                  className="border-0 bg-transparent shadow-none"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void submit(input);
                  }}
                >
                  <PromptInputBody>
                    <PromptInputTextarea
                      value={input}
                      onChange={(e) => setInput(e.currentTarget.value)}
                      placeholder={`问 ${symbol} ${interval} 的走势、风险、仓位或交易计划…`}
                      className="pr-4"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void submit(input);
                        }
                      }}
                    />
                  </PromptInputBody>
                  <PromptInputFooter>
                    <PromptInputTools>
                      <PromptInputButton className="text-slate-200">
                        <BotIcon className="size-4" />
                        <span>{activeDesk.label}</span>
                      </PromptInputButton>
                      <PromptInputButton className="hidden text-slate-300 md:inline-flex">
                        <GlobeIcon className="size-4" />
                        <span>流式分析</span>
                      </PromptInputButton>
                    </PromptInputTools>
                    <div className="flex items-center gap-2 self-end">
                      {isStreaming ? <PromptInputStop onClick={() => stop()} aria-label="停止输出" /> : null}
                      <PromptInputSubmit status={status} disabled={!input.trim() || isStreaming} />
                    </div>
                  </PromptInputFooter>
                </PromptInput>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <Button
        type="button"
        size="default"
        variant="secondary"
        aria-label={isOpen ? "关闭聊天" : "打开聊天"}
        className="h-auto rounded-[22px] border border-white/10 bg-[#121922]/94 px-3 py-2 text-[#ece7de] shadow-[0_18px_60px_rgba(0,0,0,0.34)] backdrop-blur-xl hover:bg-[#18202a]"
        onClick={() => setIsOpen((value) => !value)}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-[16px] bg-[#1a2430] text-slate-300">
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
        <span className="ml-3 flex flex-col items-start leading-none">
          <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">AI desk</span>
          <span className="mt-1 text-sm font-medium text-[#f3eee5]">{isOpen ? "Close control room" : "Open control room"}</span>
        </span>
        <span className="ml-4 hidden items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-slate-500 md:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-[#c9a05e]" />
          Multi-agent
        </span>
      </Button>
    </div>
  );
}

function ChatMessageItem({
  message,
  isLastMessage,
  isStreaming,
}: {
  message: UIMessage;
  isLastMessage: boolean;
  isStreaming: boolean;
}) {
  const reasoningText = message.parts
    .filter((part) => part.type === "reasoning")
    .map((part) => part.text)
    .join("\n\n");
  const textParts = message.parts.filter((part) => part.type === "text");
  const showReasoning = message.role === "assistant" && reasoningText.length > 0;
  const isReasoningStreaming =
    showReasoning &&
    isLastMessage &&
    isStreaming &&
    message.parts.at(-1)?.type === "reasoning";
  const assistantText = textParts.map((part) => part.text).join("\n\n");

  return (
    <Message from={message.role}>
      <MessageContent>
        <p className="mb-1.5 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-slate-500">
          <span className={`h-1.5 w-1.5 rounded-full ${message.role === "user" ? "bg-slate-500" : "bg-[#8b7143]"}`} />
          {message.role === "user" ? "You" : message.role === "assistant" ? "Desk output" : "System"}
        </p>
        {showReasoning ? (
          <Reasoning className="mb-3" isStreaming={isReasoningStreaming}>
            <ReasoningTrigger />
            <ReasoningContent>{reasoningText}</ReasoningContent>
          </Reasoning>
        ) : null}
        {textParts.map((part, index) => (
          <MessageResponse key={`${message.id}-${index}`}>{part.text}</MessageResponse>
        ))}
      </MessageContent>
      {message.role === "assistant" && assistantText ? (
        <MessageActions>
          <MessageAction
            aria-label="复制回复"
            onClick={() => {
              void navigator.clipboard.writeText(assistantText);
            }}
          >
            <CopyIcon className="size-3.5" />
          </MessageAction>
        </MessageActions>
      ) : null}
    </Message>
  );
}

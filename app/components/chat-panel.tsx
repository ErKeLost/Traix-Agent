"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { CopyIcon, GlobeIcon, MessageSquareIcon, SparklesIcon } from "lucide-react";

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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { MarketInterval, MarketSymbol } from "@/lib/market";

type ChatPanelProps = {
  symbol: MarketSymbol;
  interval: MarketInterval;
};

const QUICK_PROMPTS = [
  "这个位置先追还是等回踩？",
  "给我看一下短线支撑阻力",
  "现在的失效位在哪里？",
  "量能和结构配合怎么样？",
];

export function ChatPanel({ symbol, interval }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [useSearch, setUseSearch] = useState(false);
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
        },
      },
    );
  }

  const isStreaming = status === "submitted" || status === "streaming";

  function submitQuickPrompt(prompt: string) {
    void submit(prompt);
  }

  return (
    <div className="fixed bottom-6 right-5 z-30 flex flex-col items-end gap-3">
      {isOpen && (
        <div
          className="flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,#131a24_0%,#101720_100%)] shadow-[0_36px_100px_rgba(0,0,0,0.5)]"
          style={{
            width: "min(760px, calc(100vw - 24px))",
            maxHeight: "calc(100vh - 24px)",
          }}
        >
          <div className="flex items-center justify-between gap-3 border-b border-white/8 px-5 py-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Analyst console
              </p>
              <h2 className="mt-1 text-base font-medium tracking-[-0.03em] text-[#f3eee5]">
                {symbol} · {interval}
              </h2>
            </div>
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
              {isStreaming ? "Streaming" : error ? "Error" : "Ready"}
            </Badge>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 py-4">
            <div className="min-h-0 flex-1" style={{ maxHeight: "calc(100vh - 180px)" }}>
              <PromptInputProvider>
                <Conversation className="size-full">
                  <ConversationContent>
                    {messages.length === 0 ? (
                      <ConversationEmptyState
                        icon={<MessageSquareIcon className="size-6" />}
                        title={`${symbol} ${interval} analyst stream`}
                        description="问方向、结构、失效位或交易计划，回复会按流式逐段出来。"
                      />
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
            </div>

            {error ? (
              <p className="rounded-xl border border-amber-500/20 bg-amber-500/8 px-3 py-2 text-sm text-amber-300">
                {error.message}
              </p>
            ) : null}

            {messages.length === 0 ? (
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => submitQuickPrompt(prompt)}
                    className="shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-300 transition-colors hover:border-[#8b7143]/40 hover:bg-[#1a2230] hover:text-[#f3eee5]"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            ) : null}

            <PromptInput
              onSubmit={(e) => {
                e.preventDefault();
                void submit(input);
              }}
            >
              <PromptInputBody>
                <PromptInputTextarea
                  value={input}
                  onChange={(e) => setInput(e.currentTarget.value)}
                  placeholder={`问 ${symbol} ${interval} 的走势…`}
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
                  <PromptInputButton
                    className={useSearch ? "border-white/10 bg-white/[0.06] text-slate-100" : undefined}
                    onClick={() => setUseSearch((value) => !value)}
                  >
                    <GlobeIcon className="size-4" />
                    <span>Search</span>
                  </PromptInputButton>
                  <PromptInputButton className="text-slate-300">
                    <SparklesIcon className="size-4" />
                    <span>Trading Analyst</span>
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
        <p className="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-slate-500">
          {message.role === "user" ? "You" : message.role === "assistant" ? "Analyst" : "System"}
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
              void navigator.clipboard.writeText(assistantText)
            }}
          >
            <CopyIcon className="size-3.5" />
          </MessageAction>
        </MessageActions>
      ) : null}
    </Message>
  );
}

"use client";

import { useState } from "react";
import {
  DefaultChatTransport,
  type DynamicToolUIPart,
  type ToolUIPart,
  type UIMessage,
} from "ai";
import { useChat } from "@ai-sdk/react";
import {
  ArrowUpIcon,
  CameraIcon,
  CopyIcon,
  FileIcon,
  ImageIcon,
  PlusIcon,
  PanelRightOpenIcon,
  ScreenShareIcon,
  Settings2Icon,
  XIcon,
} from "lucide-react";

import {
  Conversation,
  ConversationContent,
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
  PromptInputBody,
  PromptInputButton,
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
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@/components/ai-elements/sources";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { MarketInterval, MarketSymbol } from "@/lib/market";

type ChatPanelProps = {
  symbol: MarketSymbol;
  interval: MarketInterval;
};

type DeskMode = "auto" | "market" | "derivatives" | "news";
type MessagePart = UIMessage["parts"][number];
type TextPart = Extract<MessagePart, { type: "text" }>;
type ReasoningPart = Extract<MessagePart, { type: "reasoning" }>;
type SourceUrlPart = Extract<MessagePart, { type: "source-url" }>;
type RenderableToolPart = ToolUIPart | DynamicToolUIPart;

export function ChatPanel({ symbol, interval }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);
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
          desk: "auto" satisfies DeskMode,
          preferResearch: true,
          mode: "deep-analysis",
        },
      },
    );
  }

  function handleAttachmentAction() {}

  const isStreaming = status === "submitted" || status === "streaming";

  return (
    <div className="fixed inset-x-3 bottom-3 z-30 flex flex-col items-end gap-3 md:inset-x-auto md:bottom-5 md:right-5">
      {isOpen ? (
        <div
          className="relative flex w-full min-h-0 overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(12,16,22,0.96)_0%,rgba(9,13,18,0.98)_100%)] shadow-[0_24px_80px_rgba(0,0,0,0.42)] backdrop-blur-xl animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-200"
          style={{
            maxWidth: "min(1080px, calc(100vw - 1.5rem))",
            width: "min(1080px, calc(100vw - 1.5rem))",
            height: "min(720px, calc(100dvh - 6rem))",
            maxHeight: "calc(100dvh - 6rem)",
          }}
        >
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-[-10%] top-[-12%] h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(201,100,66,0.12),transparent_68%)] blur-3xl" />
            <div className="absolute right-[-10%] top-[10%] h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(70,84,104,0.2),transparent_70%)] blur-3xl" />
          </div>

          <div className="relative flex min-h-0 flex-1 flex-col">
            <div className="px-4 pb-2 pt-4 md:px-6 md:pt-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Badge className="rounded-full border border-[#9a6148]/20 bg-[#241d19] px-2.5 text-[10px] uppercase tracking-[0.18em] text-[#d4a588] shadow-none">
                    Claude Style
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label="关闭分析台"
                    className="rounded-full border border-white/10 bg-white/5 text-[#8d97a5] hover:bg-white/10 hover:text-[#f2f4f8]"
                    onClick={() => setIsOpen(false)}
                  >
                    <XIcon className="size-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-4 px-3 pb-3 md:px-4 md:pb-4">
              <div className="relative min-h-0 flex-1 overflow-hidden rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,#0a1016_0%,#0b1117_70%,#0c1319_100%)]">
                <PromptInputProvider>
                  <Conversation className="size-full">
                    <ConversationContent className="bg-transparent px-4 py-5 md:px-6 md:py-6">
                      {messages.length > 0 ? (
                        messages.map((message, index) => (
                          <ChatMessageItem
                            key={message.id}
                            isLastMessage={index === messages.length - 1}
                            isStreaming={isStreaming}
                            message={message}
                          />
                        ))
                      ) : null}
                    </ConversationContent>
                    <ConversationScrollButton />
                  </Conversation>
                </PromptInputProvider>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#0c1319] via-[#0c1319]/78 to-transparent" />
              </div>

              {error ? (
                <p className="rounded-[18px] border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                  {error.message}
                </p>
              ) : null}

              <div className="space-y-2">
                <PromptInput
                  className="rounded-2xl border border-white/8 bg-[linear-gradient(180deg,#121920_0%,#0f151c_100%)] shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_16px_36px_rgba(0,0,0,0.28)] transition-colors hover:border-white/12"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submit(input);
                  }}
                >
                  <PromptInputBody>
                    <PromptInputTextarea
                      value={input}
                      onChange={(event) => setInput(event.currentTarget.value)}
                      placeholder="Reply to Trading Chat..."
                      className="min-h-[108px] bg-transparent px-4 py-4 text-[15px] leading-7 text-[#eef2f6] placeholder:text-[#6d7886]"
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          void submit(input);
                        }
                      }}
                    />
                  </PromptInputBody>

                  <PromptInputFooter className="flex-wrap items-center gap-3 border-t border-black/5 p-3">
                    <PromptInputTools className="gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <PromptInputButton
                            variant="outline"
                            className="rounded-lg border-white/10 bg-white/5 px-2.5 text-[#96a0ad] hover:bg-white/10 hover:text-[#f2f4f8]"
                          >
                            <PlusIcon className="size-4" />
                            <span className="sr-only">添加附件</span>
                          </PromptInputButton>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="start"
                          className="w-52 min-w-52 rounded-2xl border-white/10 bg-[#121920] p-1 text-[#e6ebf2] shadow-[0_18px_40px_rgba(0,0,0,0.35)]"
                        >
                          <DropdownMenuItem onClick={() => handleAttachmentAction()}>
                            <FileIcon className="mr-2 size-4" />
                            上传文件
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleAttachmentAction()}>
                            <ImageIcon className="mr-2 size-4" />
                            上传图片
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleAttachmentAction()}>
                            <ScreenShareIcon className="mr-2 size-4" />
                            截图
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleAttachmentAction()}>
                            <CameraIcon className="mr-2 size-4" />
                            拍照
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      <PromptInputButton
                        variant="outline"
                        className="rounded-lg border-white/10 bg-white/5 px-2.5 text-[#96a0ad] hover:bg-white/10 hover:text-[#f2f4f8]"
                      >
                        <Settings2Icon className="size-4" />
                        <span className="sr-only">设置</span>
                      </PromptInputButton>
                    </PromptInputTools>

                    <div className="ml-auto flex items-center gap-2">
                      {isStreaming ? (
                        <PromptInputStop
                          onClick={() => stop()}
                          aria-label="停止输出"
                          className="rounded-lg border-white/10 bg-white/5 px-2.5 text-[#96a0ad] hover:bg-white/10 hover:text-[#f2f4f8]"
                        />
                      ) : null}

                      <PromptInputSubmit
                        status={status}
                        disabled={!input.trim() || isStreaming}
                        className="rounded-lg bg-[#c96442] text-white shadow-none hover:bg-[#bd5937]"
                      >
                        <ArrowUpIcon className="-translate-y-px size-4" />
                      </PromptInputSubmit>
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
        className="h-auto rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,21,29,0.94)_0%,rgba(11,16,22,0.98)_100%)] px-3 py-2.5 text-[#eef2f6] shadow-[0_12px_36px_rgba(0,0,0,0.35)] backdrop-blur-xl hover:bg-[#141b23]"
        onClick={() => setIsOpen((value) => !value)}
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-white/6 text-[#96a0ad]">
          {isOpen ? <XIcon className="size-4" /> : <PanelRightOpenIcon className="size-4" />}
        </span>
        <span className="ml-3 flex flex-col items-start text-left">
          <span className="text-[10px] uppercase tracking-[0.22em] text-[#7d8795]">
            Trading Chat 
          </span>
          <span className="text-sm font-medium text-[#eef2f6]">
            {isOpen ? "收起聊天窗" : "打开聊天窗"}
          </span>
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
  const sourceParts = message.parts.filter(
    (part): part is SourceUrlPart => part.type === "source-url",
  );
  const reasoningParts = message.parts.filter(
    (part): part is ReasoningPart => part.type === "reasoning",
  );
  const textParts = message.parts.filter(
    (part): part is TextPart => part.type === "text",
  );
  const toolParts = message.parts.filter(isToolPart);

  const reasoningText = reasoningParts.map((part) => part.text).join("\n\n").trim();
  const assistantText = textParts.map((part) => part.text).join("\n\n").trim();
  const showReasoning = message.role === "assistant" && reasoningText.length > 0;
  const isReasoningStreaming =
    showReasoning &&
    isLastMessage &&
    isStreaming &&
    reasoningParts.some((part) => part.state === "streaming");
  const showTypingState =
    message.role === "assistant" &&
    assistantText.length === 0 &&
    isLastMessage &&
    isStreaming &&
    !showReasoning;

  return (
    <Message from={message.role} className="gap-2">
      <MessageContent
        className={cn(
          "border-0 bg-transparent p-0 shadow-none",
          message.role === "user" &&
            "max-w-[88%] rounded-2xl bg-[#141b23] px-3 py-3 text-[#eef2f6] shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_8px_20px_rgba(0,0,0,0.18)]",
        )}
      >
        {sourceParts.length > 0 ? (
          <Sources className="mb-4">
            <SourcesTrigger
              count={sourceParts.length}
              className="border-white/10 bg-white/6 text-[#8f98a5]"
            />
            <SourcesContent className="mt-2">
              {sourceParts.map((part) => (
                <Source
                  key={`${message.id}-${part.sourceId}-${part.url}`}
                  href={part.url}
                  title={part.title ?? part.url}
                  className="border-white/10 bg-white/6 text-[#dce3eb] hover:bg-white/10"
                />
              ))}
            </SourcesContent>
          </Sources>
        ) : null}

        {showReasoning ? (
          <Reasoning
            className="mb-4 border-l border-white/8 pl-3"
            isStreaming={isReasoningStreaming}
          >
            <ReasoningTrigger className="text-[#7f8996]" />
            <ReasoningContent className="rounded-2xl bg-[#111820] px-3 py-2.5 text-[#8b95a3]">
              {reasoningText}
            </ReasoningContent>
          </Reasoning>
        ) : null}

        <div className={cn("space-y-3", message.role === "user" && "flex gap-2 space-y-0")}>
          {message.role === "user" ? (
            <Avatar className="mt-0.5 size-7 outline outline-1 outline-black/8">
              <AvatarImage
                alt="User"
                src="https://github.com/haydenbleasel.png"
              />
              <AvatarFallback>U</AvatarFallback>
            </Avatar>
          ) : null}
          <div className="min-w-0 flex-1 space-y-3">
          {textParts.map((part, index) => (
            <MessageResponse
              key={`${message.id}-${index}`}
              className={cn(
                "text-[15px] leading-7",
                message.role === "user" ? "text-[#eef2f6]" : "text-[#e8edf3]",
              )}
            >
              {part.text}
            </MessageResponse>
          ))}

          {showTypingState ? (
            <div className="flex items-center gap-2 text-sm text-[#7f8996]">
              <span className="h-2 w-2 rounded-full bg-[#c96442] animate-pulse" />
              正在生成分析…
            </div>
          ) : null}
          </div>
        </div>

        {toolParts.length > 0 ? (
          <div className="mt-4 space-y-2">
            {toolParts.map((part) => (
              <ToolPartCard
                key={`${message.id}-${part.toolCallId}-${part.state}`}
                part={part}
              />
            ))}
          </div>
        ) : null}
      </MessageContent>

      {message.role === "assistant" && assistantText ? (
        <MessageActions className="pl-1">
          <MessageAction
            aria-label="复制回复"
            className="text-[#7f8996] hover:bg-white/6 hover:text-[#eef2f6]"
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

function ToolPartCard({ part }: { part: RenderableToolPart }) {
  const toolName = getToolName(part);
  const stateLabel = formatToolState(part.state);
  const stateTone = getToolStateTone(part.state);
  const inputText = formatUnknown(part.input);
  const outputText = "output" in part ? formatUnknown(part.output) : null;
  const errorText = "errorText" in part ? part.errorText : null;

  return (
    <div className="rounded-[20px] border border-white/8 bg-[#10171e] px-3 py-3 shadow-[0_0_0_1px_rgba(255,255,255,0.03)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-[#7f8996]">
            Tool
          </p>
          <p className="mt-1 text-sm font-medium text-[#eef2f6]">
            {toolName}
          </p>
        </div>
        <Badge
          variant="outline"
          className={cn("rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em]", stateTone)}
        >
          {stateLabel}
        </Badge>
      </div>

      <pre className="mt-3 overflow-x-auto rounded-2xl border border-white/8 bg-[#0b1117] px-3 py-2 text-[11px] leading-5 text-[#8b95a3]">
        {inputText}
      </pre>

      {outputText ? (
        <pre className="mt-2 overflow-x-auto rounded-2xl border border-white/8 bg-[#121921] px-3 py-2 text-[11px] leading-5 text-[#dbe3ec]">
          {outputText}
        </pre>
      ) : null}

      {part.state === "approval-requested" ? (
        <p className="mt-2 text-xs text-amber-300/80">
          这个工具调用正在等待批准。
        </p>
      ) : null}

      {part.state === "approval-responded" ? (
        <p className="mt-2 text-xs text-[#7f7770]">
          工具批准状态已返回。
        </p>
      ) : null}

      {errorText ? (
        <p className="mt-2 text-xs text-rose-300">
          {errorText}
        </p>
      ) : null}
    </div>
  );
}

function isToolPart(part: MessagePart): part is RenderableToolPart {
  return part.type === "dynamic-tool" || part.type.startsWith("tool-");
}

function getToolName(part: RenderableToolPart) {
  const rawName = part.type === "dynamic-tool" ? part.toolName : part.type.replace(/^tool-/, "");
  return rawName.replace(/[-_]+/g, " ");
}

function formatToolState(state: RenderableToolPart["state"]) {
  if (state === "input-streaming") {
    return "收集中";
  }

  if (state === "input-available") {
    return "已准备";
  }

  if (state === "approval-requested") {
    return "待批准";
  }

  if (state === "approval-responded") {
    return "已批准";
  }

  if (state === "output-available") {
    return "已返回";
  }

  if (state === "output-error") {
    return "报错";
  }

  return "已拒绝";
}

function getToolStateTone(state: RenderableToolPart["state"]) {
  if (state === "output-available") {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-200";
  }

  if (state === "output-error" || state === "output-denied") {
    return "border-rose-500/20 bg-rose-500/10 text-rose-200";
  }

  if (state === "approval-requested") {
    return "border-amber-500/20 bg-amber-500/10 text-amber-200";
  }

  return "border-white/8 bg-white/[0.04] text-slate-300";
}

function formatUnknown(value: unknown) {
  if (value == null) {
    return "No payload";
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    const serialized = JSON.stringify(value, null, 2);
    return serialized.length > 1200 ? `${serialized.slice(0, 1200)}\n…` : serialized;
  } catch {
    return String(value);
  }
}

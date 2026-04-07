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
type StreamEventPayload = {
  type: "stream.event";
  eventName:
    | "assistant.delta"
    | "assistant.reasoning.delta"
    | "tool.call.started"
    | "tool.call.completed"
    | "tool.call.failed"
    | "usage.updated"
    | "session.ended"
    | "agent.handoff.started"
    | "agent.handoff.completed"
    | "agent.stream.delta";
  agentId?: string;
  targetId?: string;
  targetName?: string;
  targetType?: "agent" | "workflow" | "tool";
  text?: string;
  streamType?: "text" | "reasoning";
  toolCallId?: string;
  toolName?: string;
  error?: string;
  depth?: number;
};
type ChatMessage = UIMessage<{ stream_event: StreamEventPayload }>;
type MessagePart = ChatMessage["parts"][number];
type TextPart = Extract<MessagePart, { type: "text" }>;
type ReasoningPart = Extract<MessagePart, { type: "reasoning" }>;
type SourceUrlPart = Extract<MessagePart, { type: "source-url" }>;
type RenderableToolPart = ToolUIPart | DynamicToolUIPart;
type StreamEventPart = {
  type: "data-stream_event";
  id?: string;
  data: StreamEventPayload;
};
type AgentActivity = {
  id: string;
  name: string;
  status: "pending" | "done" | "error";
  text: string;
  thinking: string;
  toolEvents: string[];
};

export function ChatPanel({ symbol, interval }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const chatId = `trading-chat-${symbol}-${interval}`;
  const { clearError, error, messages, sendMessage, status, stop } = useChat<ChatMessage>({
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
  const hasMessages = messages.length > 0;

  return (
    <div className="fixed inset-x-3 bottom-3 z-30 flex flex-col items-end gap-3 md:inset-x-auto md:bottom-5 md:right-5">
      {isOpen ? (
        <div
          className="relative flex w-full min-h-0 overflow-hidden rounded-[30px] border border-white/7 bg-[linear-gradient(180deg,rgba(13,18,24,0.88)_0%,rgba(10,14,19,0.95)_100%)] shadow-[0_28px_90px_rgba(0,0,0,0.46)] backdrop-blur-2xl animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-200"
          style={{
            maxWidth: "min(760px, calc(100vw - 1.5rem))",
            width: "min(760px, calc(100vw - 1.5rem))",
            height: "min(760px, calc(100dvh - 5rem))",
            maxHeight: "calc(100dvh - 5rem)",
          }}
        >
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-[-14%] top-[-10%] h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(201,100,66,0.13),transparent_68%)] blur-3xl" />
            <div className="absolute right-[-12%] top-[8%] h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(81,104,132,0.18),transparent_72%)] blur-3xl" />
            <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-white/[0.03] to-transparent" />
          </div>

          <div className="relative flex min-h-0 flex-1 flex-col">
            <div className="px-5 pb-3 pt-5 md:px-6 md:pb-4 md:pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-[#1f1814] px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-[#ca9a81]">
                      Trading Chat
                    </span>
                    <span className="text-[10px] uppercase tracking-[0.18em] text-[#5d6876]">
                      {symbol} · {interval}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-lg font-medium tracking-[-0.03em] text-[#f3eee5]">
                      交易研究对话
                    </p>
                    <p className="text-sm text-[#7f8a98]">
                      直接问方向、触发条件、失效位，系统会按当前图表周期分析。
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label="关闭分析台"
                  className="rounded-full bg-white/5 text-[#8d97a5] hover:bg-white/10 hover:text-[#f2f4f8]"
                  onClick={() => setIsOpen(false)}
                >
                  <XIcon className="size-4" />
                </Button>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-3 px-3 pb-3 md:px-4 md:pb-4">
              <div className="relative min-h-0 flex-1 overflow-hidden rounded-[28px] bg-[linear-gradient(180deg,rgba(14,19,25,0.82)_0%,rgba(10,14,19,0.7)_100%)]">
                <PromptInputProvider>
                  <Conversation className="size-full">
                    <ConversationContent className="bg-transparent px-5 py-5 md:px-6 md:py-6">
                      {hasMessages ? (
                        messages.map((message, index) => (
                          <ChatMessageItem
                            key={message.id}
                            isLastMessage={index === messages.length - 1}
                            isStreaming={isStreaming}
                            message={message}
                          />
                        ))
                      ) : (
                        <ChatEmptyState symbol={symbol} interval={interval} />
                      )}
                    </ConversationContent>
                    <ConversationScrollButton />
                  </Conversation>
                </PromptInputProvider>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[rgba(9,13,18,0.72)] via-[rgba(9,13,18,0.18)] to-transparent" />
              </div>

              {error ? (
                <p className="rounded-[18px] bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                  {error.message}
                </p>
              ) : null}

              <div className="rounded-[24px] bg-[linear-gradient(180deg,rgba(20,27,35,0.9)_0%,rgba(16,22,29,0.92)_100%)] shadow-[0_12px_40px_rgba(0,0,0,0.22)]">
                <PromptInput
                  className="rounded-[24px] bg-transparent shadow-none transition-colors"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submit(input);
                  }}
                >
                  <PromptInputBody>
                    <PromptInputTextarea
                      value={input}
                      onChange={(event) => setInput(event.currentTarget.value)}
                      placeholder="问我：现在更适合看多、看空，还是观望？"
                      className="min-h-[124px] bg-transparent px-5 py-4 text-[15px] leading-7 text-[#eef2f6] placeholder:text-[#667281]"
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          void submit(input);
                        }
                      }}
                    />
                  </PromptInputBody>

                  <PromptInputFooter className="flex-wrap items-center gap-3 border-t border-white/6 px-4 py-3">
                    <PromptInputTools className="gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <PromptInputButton
                            variant="outline"
                            className="rounded-full bg-white/5 px-2.5 text-[#96a0ad] hover:bg-white/10 hover:text-[#f2f4f8]"
                          >
                            <PlusIcon className="size-4" />
                            <span className="sr-only">添加附件</span>
                          </PromptInputButton>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="start"
                          className="w-52 min-w-52 rounded-2xl bg-[#121920] p-1 text-[#e6ebf2] shadow-[0_18px_40px_rgba(0,0,0,0.35)]"
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
                        className="rounded-full bg-white/5 px-2.5 text-[#96a0ad] hover:bg-white/10 hover:text-[#f2f4f8]"
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
                          className="rounded-full bg-white/5 px-2.5 text-[#96a0ad] hover:bg-white/10 hover:text-[#f2f4f8]"
                        />
                      ) : null}

                      <PromptInputSubmit
                        status={status}
                        disabled={!input.trim() || isStreaming}
                        className="rounded-full bg-[#c96442] px-3 text-white shadow-none hover:bg-[#bd5937]"
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
        className="h-auto rounded-[22px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,21,29,0.94)_0%,rgba(11,16,22,0.98)_100%)] px-3 py-2.5 text-[#eef2f6] shadow-[0_12px_36px_rgba(0,0,0,0.35)] backdrop-blur-xl hover:bg-[#141b23]"
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

function ChatEmptyState({
  symbol,
  interval,
}: {
  symbol: MarketSymbol;
  interval: MarketInterval;
}) {
  return (
    <div className="flex min-h-[420px] flex-col justify-between">
      <div className="space-y-5">
        <div className="max-w-[26rem] space-y-2">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[#8b6f61]">
            Research Ready
          </p>
          <p className="text-2xl font-medium tracking-[-0.04em] text-[#f3eee5]">
            用当前 {symbol} · {interval} 图表直接问交易问题
          </p>
          <p className="text-sm leading-7 text-[#7d8896]">
            我会结合当前周期、多周期结构、衍生品和新闻上下文，给你更接近交易台口径的判断。
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {[
            "现在更适合看多、看空还是观望？",
            "如果我要做 10 分钟事件合约，方向应该怎么选？",
            "这个位置追多有没有胜率优势？",
            "告诉我触发条件、失效位和风险点。",
          ].map((item) => (
            <div
              key={item}
              className="rounded-[20px] bg-white/[0.03] px-4 py-3 text-sm leading-6 text-[#cfd7e2]"
            >
              {item}
            </div>
          ))}
        </div>
      </div>

      <div className="pt-8 text-xs uppercase tracking-[0.16em] text-[#586372]">
        Live market context is attached automatically
      </div>
    </div>
  );
}

function ChatMessageItem({
  message,
  isLastMessage,
  isStreaming,
}: {
  message: ChatMessage;
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
  const streamEventParts = message.parts.filter(isStreamEventPart);
  const agentActivities = buildAgentActivities(streamEventParts);

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
  const showAgentActivity =
    message.role === "assistant" && isLastMessage && agentActivities.length > 0;
  const hasVisibleContent =
    sourceParts.length > 0 ||
    showReasoning ||
    showAgentActivity ||
    textParts.some((part) => part.text.trim().length > 0) ||
    showTypingState ||
    toolParts.length > 0;

  if (!hasVisibleContent) {
    return null;
  }

  return (
    <Message from={message.role} className="gap-3">
      <MessageContent
        className={cn(
          "border-0 bg-transparent p-0 shadow-none",
          message.role === "assistant" && "max-w-[92%]",
        )}
      >
        {sourceParts.length > 0 ? (
          <Sources className="mb-4">
            <SourcesTrigger
              count={sourceParts.length}
              className="rounded-full bg-white/6 text-[#8f98a5]"
            />
            <SourcesContent className="mt-2">
              {sourceParts.map((part) => (
                <Source
                  key={`${message.id}-${part.sourceId}-${part.url}`}
                  href={part.url}
                  title={part.title ?? part.url}
                  className="bg-white/6 text-[#dce3eb] hover:bg-white/10"
                />
              ))}
            </SourcesContent>
          </Sources>
        ) : null}

        {showReasoning ? (
          <Reasoning
            className="mb-5"
            isStreaming={isReasoningStreaming}
          >
            <ReasoningTrigger className="text-[#7f8996]" />
            <ReasoningContent className="rounded-[22px] bg-white/[0.035] px-4 py-3 text-[#8b95a3]">
              {reasoningText}
            </ReasoningContent>
          </Reasoning>
        ) : null}

        {showAgentActivity ? (
          <div className="mb-5">
            <AgentActivitySummary agents={agentActivities} />
          </div>
        ) : null}

        <div className="min-w-0 space-y-4">
          {textParts.map((part, index) => (
            <MessageResponse
              key={`${message.id}-${index}`}
              className={cn(
                "text-[15px] leading-8",
                message.role === "user" ? "text-[#cfd7e2]" : "text-[#e8edf3]",
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

        {toolParts.length > 0 ? (
          <div className="mt-5 space-y-2.5">
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
    <div className="rounded-[22px] bg-white/[0.035] px-4 py-3.5">
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
          className={cn("rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.16em]", stateTone)}
        >
          {stateLabel}
        </Badge>
      </div>

      <pre className="mt-3 overflow-x-auto rounded-[18px] bg-black/20 px-3 py-2.5 text-[11px] leading-5 text-[#8b95a3]">
        {inputText}
      </pre>

      {outputText ? (
        <pre className="mt-2 overflow-x-auto rounded-[18px] bg-white/[0.04] px-3 py-2.5 text-[11px] leading-5 text-[#dbe3ec]">
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

function isStreamEventPart(part: MessagePart): part is StreamEventPart {
  return part.type === "data-stream_event";
}

function AgentActivitySummary({ agents }: { agents: AgentActivity[] }) {
  const completed = agents.filter((agent) => agent.status === "done").length;
  const failed = agents.filter((agent) => agent.status === "error").length;
  const active = agents.filter((agent) => agent.status === "pending").length;
  const labels = agents.map((agent) => agent.name).join(" / ");
  const latestUpdate = agents
    .flatMap((agent) => agent.toolEvents.map((item) => `${agent.name}: ${item}`))
    .at(-1);

  return (
    <div className="space-y-2 rounded-[20px] bg-white/[0.025] px-4 py-3">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-[#8b6f61]">
        <span>Research Agents</span>
        <span className="text-[#5f6976]">{labels}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-[#98a3b1]">
        <span>{agents.length} 个研究席位</span>
        <span>{completed} 已完成</span>
        {active > 0 ? <span>{active} 进行中</span> : null}
        {failed > 0 ? <span className="text-rose-300">{failed} 异常</span> : null}
      </div>
      {latestUpdate ? <p className="text-xs text-[#7f8996]">{latestUpdate}</p> : null}
    </div>
  );
}

function getToolName(part: RenderableToolPart) {
  const rawName = part.type === "dynamic-tool" ? part.toolName : part.type.replace(/^tool-/, "");
  return rawName.replace(/[-_]+/g, " ");
}

function buildAgentActivities(parts: StreamEventPart[]): AgentActivity[] {
  const agents = new Map<string, AgentActivity>();

  for (const part of parts) {
    const event = part.data;
    const agentId = event.targetId ?? event.agentId;
    if (!agentId) continue;

    const current =
      agents.get(agentId) ??
      {
        id: agentId,
        name: event.targetName ?? event.agentId ?? agentId,
        status: "pending" as const,
        text: "",
        thinking: "",
        toolEvents: [],
      };

    current.name = event.targetName ?? current.name;

    if (event.eventName === "agent.handoff.started") {
      current.status = "pending";
    }

    if (event.eventName === "agent.handoff.completed") {
      current.status = current.status === "error" ? "error" : "done";
    }

    if (event.eventName === "agent.stream.delta" && event.text) {
      if (event.streamType === "reasoning") {
        current.thinking += event.text;
      } else {
        current.text += event.text;
      }
    }

    if (event.eventName === "tool.call.started") {
      current.toolEvents.push(`工具 ${event.toolName ?? "unknown"} 运行中`);
    }

    if (event.eventName === "tool.call.completed") {
      current.toolEvents.push(`工具 ${event.toolName ?? "unknown"} 已完成`);
    }

    if (event.eventName === "tool.call.failed") {
      current.status = "error";
      current.toolEvents.push(
        `工具 ${event.toolName ?? "unknown"} 失败${event.error ? `: ${event.error}` : ""}`,
      );
    }

    agents.set(agentId, current);
  }

  return [...agents.values()];
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
    return "bg-emerald-500/10 text-emerald-200";
  }

  if (state === "output-error" || state === "output-denied") {
    return "bg-rose-500/10 text-rose-200";
  }

  if (state === "approval-requested") {
    return "bg-amber-500/10 text-amber-200";
  }

  return "bg-white/[0.05] text-slate-300";
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

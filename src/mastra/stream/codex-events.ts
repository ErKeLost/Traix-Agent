export type CodexEventName =
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

export type CodexStreamEvent = {
  type: "stream.event";
  eventName: CodexEventName;
  [key: string]: unknown;
};

type MaybeRecord = Record<string, unknown> | null | undefined;

const asRecord = (value: unknown): Record<string, unknown> | undefined => {
  if (!value || typeof value !== "object") return undefined;
  return value as Record<string, unknown>;
};

export const createCodexEventChunk = (event: CodexStreamEvent) =>
  ({
    type: "data-stream_event",
    data: event,
  }) as const;

export const getTextFromDelegationResult = (result: unknown) => {
  if (typeof result === "string") return result;

  const record = asRecord(result);
  if (!record) return "";

  const directText = record.text;
  if (typeof directText === "string") return directText;

  const output = asRecord(record.output);
  if (typeof output?.text === "string") return output.text;

  const response = asRecord(record.response);
  if (typeof response?.text === "string") return response.text;

  return "";
};

export const getUsageFromMastraChunk = (chunk: unknown) => {
  const record = asRecord(chunk);
  const payload = asRecord(record?.payload);
  const output = asRecord(payload?.output);
  const usage = asRecord(output?.usage);

  if (!usage) return undefined;

  return {
    inputTokens: typeof usage.inputTokens === "number" ? usage.inputTokens : 0,
    outputTokens: typeof usage.outputTokens === "number" ? usage.outputTokens : 0,
    totalTokens: typeof usage.totalTokens === "number" ? usage.totalTokens : 0,
    reasoningTokens:
      typeof usage.reasoningTokens === "number" ? usage.reasoningTokens : undefined,
    cachedInputTokens:
      typeof usage.cachedInputTokens === "number" ? usage.cachedInputTokens : undefined,
  };
};

export const getStepFinishReason = (chunk: unknown) => {
  const record = asRecord(chunk);
  const payload = asRecord(record?.payload);
  const stepResult = asRecord(payload?.stepResult);
  return typeof stepResult?.reason === "string" ? stepResult.reason : undefined;
};

export const getToolFailureText = (result: unknown) => {
  const record = asRecord(result);
  if (!record) return undefined;

  if (typeof record.error === "string" && record.error.trim()) {
    return record.error.trim();
  }

  if (typeof record.message === "string" && record.message.trim()) {
    return record.message.trim();
  }

  return undefined;
};

export const getToolResultPreviewUrl = (result: unknown) => {
  const record = asRecord(result);
  if (!record) return undefined;

  const previewUrl = record.previewUrl;
  const deploymentUrl = record.deploymentUrl;
  const url = record.url;

  if (typeof previewUrl === "string" && previewUrl) return previewUrl;
  if (typeof deploymentUrl === "string" && deploymentUrl) return deploymentUrl;
  if (typeof url === "string" && url) return url;
  return undefined;
};

export const getMastraChunkType = (chunk: unknown) => {
  const record = asRecord(chunk);
  return typeof record?.type === "string" ? record.type : undefined;
};

export const getMastraChunkPayload = (chunk: unknown) => {
  const record = asRecord(chunk);
  return asRecord(record?.payload);
};

export const getString = (record: MaybeRecord, key: string) => {
  const value = record?.[key];
  return typeof value === "string" ? value : undefined;
};

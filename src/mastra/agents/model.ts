import { createOpenAI } from "@ai-sdk/openai";

export const TRADING_MODEL_ID = process.env.TRADING_MODEL_ID ?? "gpt-5.4";
export const TRADING_OPENAI_BASE_URL = process.env.TRADING_OPENAI_BASE_URL;
export const TRADING_OPENAI_API_KEY = process.env.TRADING_OPENAI_API_KEY;

const tradingProvider = createOpenAI({
  name: "codex",
  ...(TRADING_OPENAI_BASE_URL ? { baseURL: TRADING_OPENAI_BASE_URL } : {}),
  ...(TRADING_OPENAI_API_KEY ? { apiKey: TRADING_OPENAI_API_KEY } : {}),
});

export function resolveTradingModel() {
  return tradingProvider.responses(TRADING_MODEL_ID);
}

export function hasTradingModelAccess() {
  return Boolean(TRADING_OPENAI_API_KEY);
}

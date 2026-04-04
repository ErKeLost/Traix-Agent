import { createOpenAI } from "@ai-sdk/openai";

export const TRADING_MODEL_ID = "gpt-5.4";
export const TRADING_OPENAI_BASE_URL = "https://codex.fusrx.cn/v1";
export const TRADING_OPENAI_API_KEY =
  "sk-20df29540a8623c157a045140115475f0106551a531b126213c1809eadc48daa";

const tradingProvider = createOpenAI({
  name: "codex",
  baseURL: TRADING_OPENAI_BASE_URL,
  apiKey: TRADING_OPENAI_API_KEY,
});

export function resolveTradingModel() {
  return tradingProvider.responses(TRADING_MODEL_ID);
}

export function hasTradingModelAccess() {
  return Boolean(TRADING_OPENAI_API_KEY);
}

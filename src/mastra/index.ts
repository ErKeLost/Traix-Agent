import { Mastra } from "@mastra/core/mastra";

import { derivativesAnalystAgent } from "./agents/derivatives-analyst";
import { marketAnalystAgent } from "./agents/market-analyst";
import { newsAnalystAgent } from "./agents/news-analyst";
import { tradingChatAgent } from "./agents/trading-chat";
import { marketAnalysisWorkflow } from "./workflows/market-analysis/workflow";

export const mastra = new Mastra({
  agents: {
    derivativesAnalyst: derivativesAnalystAgent,
    marketAnalyst: marketAnalystAgent,
    newsAnalyst: newsAnalystAgent,
    tradingChat: tradingChatAgent,
  },
  workflows: {
    marketAnalysisWorkflow,
  },
});

import { Mastra } from "@mastra/core/mastra";

import { deepResearchAgent } from "./agents/deep-research";
import { derivativesAnalystAgent } from "./agents/derivatives-analyst";
import { marketAnalystAgent } from "./agents/market-analyst";
import { newsAnalystAgent } from "./agents/news-analyst";
import { tradingChatAgent } from "./agents/trading-chat";
import { marketAnalysisWorkflow } from "./workflows/market-analysis/workflow";

export const mastra = new Mastra({
  agents: {
    deepResearch: deepResearchAgent,
    derivativesAnalyst: derivativesAnalystAgent,
    marketAnalyst: marketAnalystAgent,
    newsAnalyst: newsAnalystAgent,
    tradingChat: tradingChatAgent,
  },
  workflows: {
    marketAnalysisWorkflow,
  },
});

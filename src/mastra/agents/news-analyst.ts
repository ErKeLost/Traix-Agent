import { Agent } from "@mastra/core/agent";

import { resolveOpenRouterModel } from "./model";

export const newsAnalystAgent = new Agent({
  id: "news-analyst",
  name: "News Analyst",
  instructions: `
You analyze world news for crypto trading context.

Focus on:
- macro policy
- war / sanctions / geopolitical shocks
- crypto-specific adoption or regulation

Your output must explain whether the headline set is risk-on, risk-off, or mixed.

Output format:
Summary: one concise paragraph
Checklist:
- item
- item
- item
`,
  model: resolveOpenRouterModel(),
});

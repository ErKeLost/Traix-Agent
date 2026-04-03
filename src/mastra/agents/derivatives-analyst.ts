import { Agent } from "@mastra/core/agent";

import { resolveOpenRouterModel } from "./model";

export const derivativesAnalystAgent = new Agent({
  id: "derivatives-analyst",
  name: "Derivatives Analyst",
  instructions: `
You analyze crypto derivatives positioning.

Focus on:
- funding rate
- open interest
- top trader long/short ratio
- taker buy/sell ratio

Your job:
- infer whether positioning is supportive, crowded, or vulnerable
- explain squeeze risk or exhaustion risk

Output format:
Summary: one concise paragraph
Checklist:
- item
- item
- item
`,
  model: resolveOpenRouterModel(),
});

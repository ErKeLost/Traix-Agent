import { createWorkflow } from "@mastra/core/workflows";

import {
  buildRuleAnalysisStep,
  enrichDerivativesNarrativeStep,
  enrichNewsNarrativeStep,
  enrichSupervisorNarrativeStep,
  fetchMarketContextStep,
} from "./steps";
import {
  marketAnalysisInputSchema,
  marketAnalysisWorkflowOutputSchema,
} from "./types";

export const marketAnalysisWorkflow = createWorkflow({
  id: "market-analysis-workflow",
  description: "Fetch market data, compute rules-based analysis, then enrich with Mastra agent commentary.",
  inputSchema: marketAnalysisInputSchema,
  outputSchema: marketAnalysisWorkflowOutputSchema,
})
  .then(fetchMarketContextStep)
  .then(buildRuleAnalysisStep)
  .then(enrichNewsNarrativeStep)
  .then(enrichDerivativesNarrativeStep)
  .then(enrichSupervisorNarrativeStep)
  .commit();

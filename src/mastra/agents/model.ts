export function resolveOpenRouterModel() {
  const openRouterApiKey = process.env.OPENROUTER_API_KEY;

  if (openRouterApiKey) {
    return {
      id: "z-ai/glm-5v-turbo",
      url: "https://openrouter.ai/api/v1",
      apiKey: openRouterApiKey,
    } as const;
  }

  return "openai/gpt-5.2" as const;
}

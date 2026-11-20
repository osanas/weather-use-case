/** Server-only AI configuration. Never sent to the browser and never logged. */
export type AgentConfig = {
  apiKey: string;
  model: string;
};

type Env = Readonly<Record<string, string | undefined>>;

/**
 * The agent runs only when `AI_ENABLED` is exactly `true` and both the Groq key and model
 * are set. Anything else disables it, so the app uses the rule-based planner (AG-04).
 */
export function readAgentConfig(env: Env): AgentConfig | null {
  if (env.AI_ENABLED?.trim() !== 'true') return null;
  const apiKey = env.GROQ_API_KEY?.trim();
  const model = env.GROQ_MODEL?.trim();
  if (!apiKey || !model) return null;
  return { apiKey, model };
}

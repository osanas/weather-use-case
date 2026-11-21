/** Server-only AI configuration. Never sent to the browser and never logged. */
export type AgentProvider = 'groq' | 'gemini';

export type AgentConfig = {
  provider: AgentProvider;
  apiKey: string;
  model: string;
};

type Env = Readonly<Record<string, string | undefined>>;

function providerConfig(env: Env, provider: AgentProvider): AgentConfig | null {
  const prefix = provider === 'gemini' ? 'GEMINI' : 'GROQ';
  const apiKey = env[`${prefix}_API_KEY`]?.trim();
  const model = env[`${prefix}_MODEL`]?.trim();
  if (!apiKey || !model) return null;
  return { provider, apiKey, model };
}

/**
 * The agent runs only when `AI_ENABLED` is exactly `true` and the selected provider has
 * both a key and a model. `AI_PROVIDER` selects `gemini` or `groq`; when it is unset,
 * Gemini is used if it is fully configured, otherwise Groq. Only one provider is ever
 * called. Anything else, including an unknown `AI_PROVIDER`, disables the agent, so the
 * app uses the rule-based planner (AG-04).
 */
export function readAgentConfig(env: Env): AgentConfig | null {
  if (env.AI_ENABLED?.trim() !== 'true') return null;
  const selected = env.AI_PROVIDER?.trim();
  if (selected === 'gemini' || selected === 'groq') return providerConfig(env, selected);
  if (selected) return null;
  return providerConfig(env, 'gemini') ?? providerConfig(env, 'groq');
}

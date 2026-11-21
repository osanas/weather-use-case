import type { AgentConfig } from './config';
import { createOpenAiCompatibleModel, toWire, type ChatMessage, type ChatModel, type ToolDefinition } from './groq';

/** Fixed provider endpoint (Gemini OpenAI-compatible API). Never built from client input. */
export const GEMINI_CHAT_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
/**
 * Output budget. Gemini thinking tokens count against it, so it is larger than the
 * low-effort thinking budget (1,024) plus the short tool request or confirmation.
 */
const MAX_TOKENS = 2048;

/** Builds the exact request body sent to Gemini. Exported for outbound-payload tests. */
export function buildGeminiBody(model: string, messages: readonly ChatMessage[], tools: readonly ToolDefinition[]) {
  return {
    model,
    messages: messages.map(toWire),
    // Tools take no arguments: the server scopes them to the validated request. Gemini
    // rejects an object schema with no properties, so `parameters` is omitted.
    tools: tools.map(t => ({ type: 'function', function: { name: t.name, description: t.description } })),
    tool_choice: 'auto',
    temperature: 0,
    reasoning_effort: 'low',
    max_tokens: MAX_TOKENS,
  };
}

/** Gemini chat client. Same safety rules and error outcomes as the Groq client. */
export function createGeminiModel(config: AgentConfig, fetchImpl: typeof fetch = fetch): ChatModel {
  return createOpenAiCompatibleModel(
    GEMINI_CHAT_URL, config.apiKey, (messages, tools) => buildGeminiBody(config.model, messages, tools), fetchImpl,
  );
}

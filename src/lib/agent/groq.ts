import { z } from 'zod';
import type { AgentConfig } from './config';

/** Fixed provider endpoint. Never built from client input. */
export const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';
/** Small output budget: the model only requests tools and confirms; its text is never shown. */
const MAX_COMPLETION_TOKENS = 300;

export type ToolCall = { id: string; name: string; arguments: string };

export type ChatMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; toolCalls?: ToolCall[] }
  | { role: 'tool'; toolCallId: string; content: string };

export type ToolDefinition = { name: string; description: string };

export type AssistantTurn = { content: string | null; toolCalls: ToolCall[] };

/** A chat model that can request local tools. Injected so tests use a fake model. */
export type ChatModel = {
  complete(messages: readonly ChatMessage[], tools: readonly ToolDefinition[], signal: AbortSignal): Promise<AssistantTurn>;
};

export type ModelOutcome = 'timeout' | 'quota' | 'http_error' | 'invalid_response' | 'network';

export class ModelError extends Error {
  constructor(readonly outcome: ModelOutcome) {
    super(`Model request failed: ${outcome}`);
    this.name = 'ModelError';
  }
}

const responseSchema = z.object({
  choices: z.array(z.object({
    message: z.object({
      content: z.string().nullable().optional(),
      tool_calls: z.array(z.object({
        id: z.string().min(1).max(200),
        type: z.literal('function'),
        function: z.object({ name: z.string().max(100), arguments: z.string().max(2000) }),
      })).max(10).optional(),
    }),
  })).min(1),
});

/** OpenAI-compatible wire format used by Groq. */
function toWire(message: ChatMessage) {
  switch (message.role) {
    case 'assistant':
      return {
        role: 'assistant',
        content: message.content,
        ...(message.toolCalls?.length ? {
          tool_calls: message.toolCalls.map(c => ({
            id: c.id, type: 'function', function: { name: c.name, arguments: c.arguments },
          })),
        } : {}),
      };
    case 'tool':
      return { role: 'tool', tool_call_id: message.toolCallId, content: message.content };
    default:
      return { role: message.role, content: message.content };
  }
}

/** Builds the exact request body sent to Groq. Exported for outbound-payload tests. */
export function buildGroqBody(model: string, messages: readonly ChatMessage[], tools: readonly ToolDefinition[]) {
  return {
    model,
    messages: messages.map(toWire),
    tools: tools.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        // Tools take no arguments: the server scopes them to the validated request.
        parameters: { type: 'object', properties: {}, additionalProperties: false },
      },
    })),
    tool_choice: 'auto',
    parallel_tool_calls: false,
    temperature: 0,
    max_completion_tokens: MAX_COMPLETION_TOKENS,
  };
}

/**
 * Groq chat client. Sends only the model id, the server-built messages and the tool list,
 * with no visitor headers, IPs or identifiers. Errors are mapped to safe outcomes.
 */
export function createGroqModel(config: AgentConfig, fetchImpl: typeof fetch = fetch): ChatModel {
  return {
    async complete(messages, tools, signal) {
      let response: Response;
      try {
        response = await fetchImpl(GROQ_CHAT_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(buildGroqBody(config.model, messages, tools)),
          cache: 'no-store',
          signal,
        });
      } catch (error) {
        const name = error instanceof Error ? error.name : '';
        throw new ModelError(name === 'TimeoutError' || name === 'AbortError' || signal.aborted ? 'timeout' : 'network');
      }
      if (response.status === 429) throw new ModelError('quota');
      if (!response.ok) throw new ModelError('http_error');

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new ModelError(signal.aborted ? 'timeout' : 'invalid_response');
      }
      const parsed = responseSchema.safeParse(body);
      if (!parsed.success) throw new ModelError('invalid_response');
      const { message } = parsed.data.choices[0]!;
      return {
        content: message.content ?? null,
        toolCalls: (message.tool_calls ?? []).map(c => ({ id: c.id, name: c.function.name, arguments: c.function.arguments })),
      };
    },
  };
}

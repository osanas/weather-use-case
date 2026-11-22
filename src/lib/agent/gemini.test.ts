import { describe, expect, it, vi } from 'vitest';
import { buildGeminiBody, createGeminiModel, GEMINI_CHAT_URL } from './gemini';
import { ModelError } from './groq';
import { AGENT_TOOLS } from './tools';

// Placeholder credentials only.
const config = { provider: 'gemini', apiKey: 'test-placeholder-gemini-key', model: 'test-gemini-model' } as const;
const messages = [{ role: 'system', content: 'sys' }, { role: 'user', content: '{"city":"Laval, Québec"}' }] as const;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json' },
});
const signal = () => new AbortController().signal;

async function outcomeOf(promise: Promise<unknown>) {
  const error = await promise.then(() => null, (e: unknown) => e);
  expect(error).toBeInstanceOf(ModelError);
  return (error as ModelError).outcome;
}

describe('createGeminiModel', () => {
  it('posts to the fixed Gemini endpoint with only the model, messages, tools and limits', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json({ choices: [{ message: { content: 'ok' } }] }));
    await createGeminiModel(config, fetchImpl).complete(messages, AGENT_TOOLS, signal());
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(GEMINI_CHAT_URL);
    expect(new URL(String(url)).host).toBe('generativelanguage.googleapis.com');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({
      Authorization: 'Bearer test-placeholder-gemini-key', 'Content-Type': 'application/json', Accept: 'application/json',
    });
    const body = JSON.parse(init?.body as string);
    expect(Object.keys(body).sort()).toEqual([
      'max_tokens', 'messages', 'model', 'reasoning_effort', 'temperature', 'tool_choice', 'tools',
    ]);
    expect(body).toMatchObject({ model: 'test-gemini-model', temperature: 0, tool_choice: 'auto', reasoning_effort: 'low' });
    expect(body.max_tokens).toBeGreaterThan(1024);
    expect(body.messages).toEqual([{ role: 'system', content: 'sys' }, { role: 'user', content: '{"city":"Laval, Québec"}' }]);
    expect(body.tools.map((t: { function: { name: string } }) => t.function.name)).toEqual(['get_day_forecast', 'rank_windows']);
    for (const tool of body.tools) expect(Object.keys(tool.function).sort()).toEqual(['description', 'name']);
  });

  it('parses tool calls, assigns a missing id and keeps the provider signature opaque', async () => {
    const signature = { google: { thought_signature: 'c3ludGhldGlj' } };
    const fetchImpl = async () => json({ choices: [{ message: {
      content: null,
      tool_calls: [{ type: 'function', function: { name: 'get_day_forecast', arguments: '{}' }, extra_content: signature }],
    } }] });
    expect(await createGeminiModel(config, fetchImpl).complete(messages, AGENT_TOOLS, signal())).toEqual({
      content: null,
      toolCalls: [{ id: 'call_0_0', name: 'get_day_forecast', arguments: '{}', extraContent: signature }],
    });
  });

  it('rejects oversized provider data on a tool call', async () => {
    const fetchImpl = async () => json({ choices: [{ message: { tool_calls: [{
      id: 'c1', type: 'function', function: { name: 'get_day_forecast', arguments: '{}' },
      extra_content: { google: { thought_signature: 'x'.repeat(5000) } },
    }] } }] });
    expect(await outcomeOf(createGeminiModel(config, fetchImpl).complete(messages, AGENT_TOOLS, signal())))
      .toBe('invalid_response');
  });

  it('maps HTTP 429 to quota, other errors to http_error and network failures to network', async () => {
    expect(await outcomeOf(createGeminiModel(config, async () => json({}, 429)).complete(messages, AGENT_TOOLS, signal()))).toBe('quota');
    expect(await outcomeOf(createGeminiModel(config, async () => json({}, 400)).complete(messages, AGENT_TOOLS, signal()))).toBe('http_error');
    expect(await outcomeOf(createGeminiModel(config, async () => { throw new TypeError('fetch failed'); })
      .complete(messages, AGENT_TOOLS, signal()))).toBe('network');
  });

  it('never includes the API key in error messages', async () => {
    const error = await createGeminiModel(config, async () => json({}, 500)).complete(messages, AGENT_TOOLS, signal())
      .catch((e: unknown) => e);
    expect(String(error)).not.toContain('test-placeholder-gemini-key');
  });
});

describe('buildGeminiBody', () => {
  it('echoes the tool call signature back with the assistant turn', () => {
    const signature = { google: { thought_signature: 'c3ludGhldGlj' } };
    const body = buildGeminiBody('m', [
      { role: 'assistant', content: null, toolCalls: [{ id: 'c1', name: 'get_day_forecast', arguments: '{}', extraContent: signature }] },
      { role: 'tool', toolCallId: 'c1', content: '{"hours":[]}' },
    ], []);
    expect(body.messages).toEqual([
      { role: 'assistant', content: null, tool_calls: [{
        id: 'c1', type: 'function', function: { name: 'get_day_forecast', arguments: '{}' }, extra_content: signature,
      }] },
      { role: 'tool', tool_call_id: 'c1', content: '{"hours":[]}' },
    ]);
  });
});

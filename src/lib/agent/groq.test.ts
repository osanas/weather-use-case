import { describe, expect, it, vi } from 'vitest';
import { buildGroqBody, createGroqModel, GROQ_CHAT_URL, ModelError } from './groq';
import { AGENT_TOOLS } from './tools';

// Placeholder credentials only.
const config = { apiKey: 'test-placeholder-key', model: 'test-model' };
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

describe('createGroqModel', () => {
  it('posts to the fixed Groq endpoint with only the model, messages and tools', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => json({ choices: [{ message: { content: 'ok' } }] }));
    await createGroqModel(config, fetchImpl).complete(messages, AGENT_TOOLS, signal());
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe(GROQ_CHAT_URL);
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({
      Authorization: 'Bearer test-placeholder-key', 'Content-Type': 'application/json', Accept: 'application/json',
    });
    const body = JSON.parse(init?.body as string);
    expect(Object.keys(body).sort()).toEqual([
      'max_completion_tokens', 'messages', 'model', 'parallel_tool_calls', 'temperature', 'tool_choice', 'tools',
    ]);
    expect(body).toMatchObject({ model: 'test-model', parallel_tool_calls: false, temperature: 0 });
    expect(body.tools.map((t: { function: { name: string } }) => t.function.name)).toEqual(['get_day_forecast', 'rank_windows']);
    for (const tool of body.tools) {
      expect(tool.function.parameters).toEqual({ type: 'object', properties: {}, additionalProperties: false });
    }
  });

  it('parses tool calls', async () => {
    const fetchImpl = async () => json({ choices: [{ message: {
      content: null,
      tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'get_day_forecast', arguments: '{}' } }],
    } }] });
    expect(await createGroqModel(config, fetchImpl).complete(messages, AGENT_TOOLS, signal())).toEqual({
      content: null, toolCalls: [{ id: 'call_1', name: 'get_day_forecast', arguments: '{}' }],
    });
  });

  it('maps HTTP 429 to quota and other errors to http_error', async () => {
    expect(await outcomeOf(createGroqModel(config, async () => json({}, 429)).complete(messages, AGENT_TOOLS, signal()))).toBe('quota');
    expect(await outcomeOf(createGroqModel(config, async () => json({}, 500)).complete(messages, AGENT_TOOLS, signal()))).toBe('http_error');
    expect(await outcomeOf(createGroqModel(config, async () => json({}, 401)).complete(messages, AGENT_TOOLS, signal()))).toBe('http_error');
  });

  it('maps malformed bodies to invalid_response', async () => {
    for (const body of [{}, { choices: [] }, { choices: [{ message: { tool_calls: [{ id: 'x', type: 'other' }] } }] }]) {
      expect(await outcomeOf(createGroqModel(config, async () => json(body)).complete(messages, AGENT_TOOLS, signal())))
        .toBe('invalid_response');
    }
    expect(await outcomeOf(createGroqModel(config, async () => new Response('<html>')).complete(messages, AGENT_TOOLS, signal())))
      .toBe('invalid_response');
  });

  it('maps an aborted request to timeout and a network failure to network', async () => {
    const controller = new AbortController();
    const hanging = (_url: URL | RequestInfo, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    });
    const pending = createGroqModel(config, hanging).complete(messages, AGENT_TOOLS, controller.signal);
    controller.abort();
    expect(await outcomeOf(pending)).toBe('timeout');
    expect(await outcomeOf(createGroqModel(config, async () => { throw new TypeError('fetch failed'); })
      .complete(messages, AGENT_TOOLS, signal()))).toBe('network');
  });

  it('never includes the API key in error messages', async () => {
    const error = await createGroqModel(config, async () => json({}, 500)).complete(messages, AGENT_TOOLS, signal())
      .catch((e: unknown) => e);
    expect(String(error)).not.toContain('test-placeholder-key');
  });
});

describe('buildGroqBody', () => {
  it('serializes assistant tool calls and tool results in the OpenAI-compatible format', () => {
    const body = buildGroqBody('m', [
      { role: 'assistant', content: null, toolCalls: [{ id: 'c1', name: 'get_day_forecast', arguments: '{}' }] },
      { role: 'tool', toolCallId: 'c1', content: '{"hours":[]}' },
    ], []);
    expect(body.messages).toEqual([
      { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'get_day_forecast', arguments: '{}' } }] },
      { role: 'tool', tool_call_id: 'c1', content: '{"hours":[]}' },
    ]);
  });
});

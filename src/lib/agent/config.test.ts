import { describe, expect, it } from 'vitest';
import { readAgentConfig } from './config';

// Placeholder values only. No real credentials in tests.
const KEY = 'test-placeholder-key';

describe('readAgentConfig', () => {
  it('enables the agent only with AI_ENABLED=true, a key and a model', () => {
    expect(readAgentConfig({ AI_ENABLED: 'true', GROQ_API_KEY: KEY, GROQ_MODEL: 'test-model' }))
      .toEqual({ apiKey: KEY, model: 'test-model' });
  });

  it.each([
    ['AI disabled', { AI_ENABLED: 'false', GROQ_API_KEY: KEY, GROQ_MODEL: 'test-model' }],
    ['AI flag missing', { GROQ_API_KEY: KEY, GROQ_MODEL: 'test-model' }],
    ['flag not exactly true', { AI_ENABLED: 'yes', GROQ_API_KEY: KEY, GROQ_MODEL: 'test-model' }],
    ['missing key', { AI_ENABLED: 'true', GROQ_MODEL: 'test-model' }],
    ['blank key', { AI_ENABLED: 'true', GROQ_API_KEY: '  ', GROQ_MODEL: 'test-model' }],
    ['missing model', { AI_ENABLED: 'true', GROQ_API_KEY: KEY }],
    ['empty environment', {}],
  ])('stays rule-based with %s', (_name, env) => {
    expect(readAgentConfig(env)).toBeNull();
  });
});

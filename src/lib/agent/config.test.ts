import { describe, expect, it } from 'vitest';
import { readAgentConfig } from './config';

// Placeholder values only. No real credentials in tests.
const KEY = 'test-placeholder-key';
const GEMINI_KEY = 'test-placeholder-gemini-key';
const GROQ = { GROQ_API_KEY: KEY, GROQ_MODEL: 'test-model' };
const GEMINI = { GEMINI_API_KEY: GEMINI_KEY, GEMINI_MODEL: 'test-gemini-model' };

describe('readAgentConfig', () => {
  it('enables the agent only with AI_ENABLED=true, a key and a model', () => {
    expect(readAgentConfig({ AI_ENABLED: 'true', ...GROQ }))
      .toEqual({ provider: 'groq', apiKey: KEY, model: 'test-model' });
  });

  it.each([
    ['AI disabled', { AI_ENABLED: 'false', ...GROQ, ...GEMINI }],
    ['AI flag missing', { ...GROQ, ...GEMINI }],
    ['flag not exactly true', { AI_ENABLED: 'yes', ...GROQ }],
    ['missing key', { AI_ENABLED: 'true', GROQ_MODEL: 'test-model' }],
    ['blank key', { AI_ENABLED: 'true', GROQ_API_KEY: '  ', GROQ_MODEL: 'test-model' }],
    ['missing model', { AI_ENABLED: 'true', GROQ_API_KEY: KEY }],
    ['Gemini key without model', { AI_ENABLED: 'true', GEMINI_API_KEY: GEMINI_KEY }],
    ['Gemini selected but not configured', { AI_ENABLED: 'true', AI_PROVIDER: 'gemini', ...GROQ }],
    ['Groq selected but not configured', { AI_ENABLED: 'true', AI_PROVIDER: 'groq', ...GEMINI }],
    ['unknown provider', { AI_ENABLED: 'true', AI_PROVIDER: 'openai', ...GROQ, ...GEMINI }],
    ['empty environment', {}],
  ])('stays rule-based with %s', (_name, env) => {
    expect(readAgentConfig(env)).toBeNull();
  });

  it('prefers Gemini when AI_PROVIDER is unset and both providers are configured', () => {
    expect(readAgentConfig({ AI_ENABLED: 'true', ...GROQ, ...GEMINI }))
      .toEqual({ provider: 'gemini', apiKey: GEMINI_KEY, model: 'test-gemini-model' });
  });

  it('falls back to Groq configuration when Gemini is incomplete and AI_PROVIDER is unset', () => {
    expect(readAgentConfig({ AI_ENABLED: 'true', GEMINI_API_KEY: GEMINI_KEY, ...GROQ }))
      .toEqual({ provider: 'groq', apiKey: KEY, model: 'test-model' });
  });

  it('honours an explicit AI_PROVIDER', () => {
    expect(readAgentConfig({ AI_ENABLED: 'true', AI_PROVIDER: ' groq ', ...GROQ, ...GEMINI })?.provider).toBe('groq');
    expect(readAgentConfig({ AI_ENABLED: 'true', AI_PROVIDER: 'gemini', ...GROQ, ...GEMINI })?.provider).toBe('gemini');
  });
});

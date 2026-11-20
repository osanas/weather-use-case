// Release checks shared by the scripts in scripts/. Dependency-free so Node can run the
// scripts directly. Results contain file paths and rule names only, never matched values.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export type Finding = { file: string; rule: string };

/** Strings that must never reach the browser bundle. */
export const CLIENT_BUNDLE_RULES: readonly { rule: string; pattern: RegExp }[] = [
  { rule: 'groq-key-variable', pattern: /GROQ_API_KEY/ },
  { rule: 'groq-model-variable', pattern: /GROQ_MODEL/ },
  { rule: 'groq-api-host', pattern: /api\.groq\.com/ },
  { rule: 'groq-key-format', pattern: /gsk_[A-Za-z0-9]{20,}/ },
  { rule: 'ai-flag', pattern: /AI_ENABLED/ },
];

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else yield path;
  }
}

const TEXT_FILE = /\.(js|mjs|cjs|css|html|json|txt|map)$/;

/**
 * Scans a built client directory (normally `.next/static`). `extraSecrets` lets the caller
 * add the real key from the environment without the key appearing in source or output.
 */
export function scanClientBundle(dir: string, extraSecrets: readonly string[] = []): Finding[] {
  const findings: Finding[] = [];
  const secrets = extraSecrets.filter(s => s.length >= 8);
  for (const path of walk(dir)) {
    if (!TEXT_FILE.test(path)) continue;
    const text = readFileSync(path, 'utf8');
    const file = relative(dir, path).replaceAll('\\', '/');
    for (const { rule, pattern } of CLIENT_BUNDLE_RULES) {
      if (pattern.test(text)) findings.push({ file, rule });
    }
    if (secrets.some(secret => text.includes(secret))) findings.push({ file, rule: 'configured-secret-value' });
  }
  return findings;
}

/** Release documents that must be filled before a production release. */
export const RELEASE_PLACEHOLDERS: readonly { file: string; marker: string }[] = [
  { file: 'src/lib/privacy-settings.ts', marker: '[TO COMPLETE' },
  { file: 'README.md', marker: '_Fill in' },
];

/** Lists release documents that still contain a placeholder marker. */
export function findReleasePlaceholders(root: string): Finding[] {
  return RELEASE_PLACEHOLDERS
    .filter(({ file, marker }) => readFileSync(join(root, file), 'utf8').includes(marker))
    .map(({ file }) => ({ file, rule: 'placeholder' }));
}

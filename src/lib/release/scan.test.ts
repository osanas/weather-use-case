import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { findReleasePlaceholders, scanClientBundle } from './scan';

// Synthetic values only: the fake key below is not a real credential.
const FAKE_KEY = `gsk_${'A1b2C3d4'.repeat(4)}`;
const dirs: string[] = [];
const tempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), 'ww-scan-'));
  dirs.push(dir);
  return dir;
};
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe('scanClientBundle', () => {
  it('passes a clean bundle', () => {
    const dir = tempDir();
    mkdirSync(join(dir, 'chunks'));
    writeFileSync(join(dir, 'chunks', 'app.js'), 'fetch("/api/plan",{method:"POST"})');
    expect(scanClientBundle(dir)).toEqual([]);
  });

  it('reports configuration names, the Groq host and key-shaped values by file and rule only', () => {
    const dir = tempDir();
    mkdirSync(join(dir, 'chunks'));
    writeFileSync(join(dir, 'chunks', 'leak.js'), `const k="${FAKE_KEY}";fetch("https://api.groq.com/x");process.env.GROQ_API_KEY`);
    const findings = scanClientBundle(dir);
    expect(findings).toEqual(expect.arrayContaining([
      { file: 'chunks/leak.js', rule: 'groq-key-variable' },
      { file: 'chunks/leak.js', rule: 'groq-api-host' },
      { file: 'chunks/leak.js', rule: 'groq-key-format' },
    ]));
    expect(JSON.stringify(findings)).not.toContain(FAKE_KEY);
  });

  it('detects the configured key value without printing it', () => {
    const dir = tempDir();
    writeFileSync(join(dir, 'a.js'), 'const x="placeholder-secret-value";');
    const findings = scanClientBundle(dir, ['placeholder-secret-value', '']);
    expect(findings).toEqual([{ file: 'a.js', rule: 'configured-secret-value' }]);
  });

  it('ignores binary assets', () => {
    const dir = tempDir();
    writeFileSync(join(dir, 'font.woff2'), 'GROQ_API_KEY');
    expect(scanClientBundle(dir)).toEqual([]);
  });
});

describe('findReleasePlaceholders', () => {
  it('reports documents that still contain placeholders', () => {
    const root = tempDir();
    mkdirSync(join(root, 'src/lib'), { recursive: true });
    writeFileSync(join(root, 'src/lib/privacy-settings.ts'), "operator: '[TO COMPLETE: operator name]'");
    writeFileSync(join(root, 'README.md'), '| Public app | https://example.test |');
    expect(findReleasePlaceholders(root)).toEqual([{ file: 'src/lib/privacy-settings.ts', rule: 'placeholder' }]);
  });

  it('passes when everything is filled in', () => {
    const root = tempDir();
    mkdirSync(join(root, 'src/lib'), { recursive: true });
    writeFileSync(join(root, 'src/lib/privacy-settings.ts'), "operator: 'Example Operator'");
    writeFileSync(join(root, 'README.md'), '| Public app | https://example.test |');
    expect(findReleasePlaceholders(root)).toEqual([]);
  });
});

// Fails when the browser bundle contains AI configuration names, a provider host or a key.
// Run after `npm run build`. Prints file paths and rule names only, never values.
import { existsSync } from 'node:fs';
import { scanClientBundle } from '../src/lib/release/scan.ts';

const dir = process.argv[2] ?? '.next/static';
if (!existsSync(dir)) {
  console.error(`Client bundle not found at ${dir}. Run npm run build first.`);
  process.exit(1);
}
const configured = [process.env.GROQ_API_KEY ?? '', process.env.GEMINI_API_KEY ?? ''];
const findings = scanClientBundle(dir, configured);
if (findings.length > 0) {
  console.error('Server-only configuration found in the client bundle:');
  for (const { file, rule } of findings) console.error(`  ${file}: ${rule}`);
  process.exit(1);
}
console.log(`Client bundle check passed (${dir}).`);

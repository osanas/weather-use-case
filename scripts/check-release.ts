// Fails while release documents still contain placeholders (privacy notice facts, README
// release table). Not part of CI Verify: run it before tagging a production release.
import { findReleasePlaceholders } from '../src/lib/release/scan.ts';

const findings = findReleasePlaceholders(process.cwd());
if (findings.length > 0) {
  console.error('Release information is incomplete:');
  for (const { file } of findings) console.error(`  ${file} still contains placeholders`);
  process.exit(1);
}
console.log('Release information is complete.');

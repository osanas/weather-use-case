// Builds public/data/cities-na.v1.json from a GeoNames cities5000.txt dump (WEA-23).
// Usage: node scripts/build-cities.ts <path/to/cities5000.txt>
// The dump is downloaded once by the maintainer from https://download.geonames.org/export/dump/
// (CC BY 4.0). The generated file is committed, so CI never calls the network.
import { readFileSync, writeFileSync } from 'node:fs';
import { buildCatalogue, parseGeoRow, type GeoRow } from '../src/lib/catalogue-build.ts';
import { CITIES } from '../src/lib/cities.ts';

const input = process.argv[2];
if (!input) {
  console.error('Usage: node scripts/build-cities.ts <cities5000.txt>');
  process.exit(1);
}

const rows: GeoRow[] = [];
for (const line of readFileSync(input, 'utf8').split('\n')) {
  const row = parseGeoRow(line);
  if (row) rows.push(row);
}

// GeoNames names that differ from the curated labels.
const aliases = { 'quebec-qc': 'Québec' };
const catalogue = buildCatalogue(rows, CITIES, aliases);
const out = 'public/data/cities-na.v1.json';
writeFileSync(out, JSON.stringify(catalogue));
console.log(`Wrote ${catalogue.cities.length} cities and ${catalogue.zones.length} time zones to ${out}.`);

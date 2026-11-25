/**
 * The full Canada and United States city catalogue on the server (WEA-23). Incoming city IDs
 * are resolved here; anything not in the catalogue is rejected. Server code only: the browser
 * loads the same file on demand through `catalogue-client.ts`, never in the initial bundle.
 */
import file from '../../public/data/cities-na.v1.json';
import { decodeCatalogue, type CatalogueFile } from './catalogue-build';
import { isCityIdFormat, type City } from './cities';

export const CATALOGUE: readonly City[] = decodeCatalogue(file as CatalogueFile);
const BY_ID = new Map(CATALOGUE.map(city => [city.id, city]));

/** The catalogue city for an untrusted ID, or `undefined`. */
export function findCity(id: unknown): City | undefined {
  return isCityIdFormat(id) ? BY_ID.get(id) : undefined;
}

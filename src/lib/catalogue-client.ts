'use client';

import { decodeCatalogue, type CatalogueFile } from './catalogue-build';
import type { City } from './cities';

/** Same-origin static file; only the catalogue is downloaded, nothing typed is sent. */
export const CATALOGUE_URL = '/data/cities-na.v1.json';

let pending: Promise<City[]> | null = null;

/**
 * Loads the full Canada and United States catalogue once, on demand (first focus of a city
 * search). A failed load is forgotten so the next focus tries again.
 */
export function loadCatalogue(): Promise<City[]> {
  pending ??= fetch(CATALOGUE_URL, { credentials: 'omit' })
    .then(response => {
      if (!response.ok) throw new Error(`catalogue ${response.status}`);
      return response.json() as Promise<CatalogueFile>;
    })
    .then(decodeCatalogue)
    .catch(error => {
      pending = null;
      throw error;
    });
  return pending;
}

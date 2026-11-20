export type City = {
  /** Public catalogue identifier used in every API request. */
  id: string;
  label: string;
  province: string;
  /** Public city-centre coordinates. */
  latitude: number;
  longitude: number;
  /** IANA time zone used to display all times for this city. */
  timeZone: string;
};

/**
 * Public city catalogue, bundled for local search in the browser.
 * Coordinates are approximate public city centres.
 */
export const CITIES: readonly City[] = [
  { id: 'laval-qc', label: 'Laval', province: 'QC', latitude: 45.5833, longitude: -73.75, timeZone: 'America/Toronto' },
  { id: 'montreal-qc', label: 'Montréal', province: 'QC', latitude: 45.5017, longitude: -73.5673, timeZone: 'America/Toronto' },
  { id: 'quebec-qc', label: 'Québec City', province: 'QC', latitude: 46.8139, longitude: -71.208, timeZone: 'America/Toronto' },
  { id: 'gatineau-qc', label: 'Gatineau', province: 'QC', latitude: 45.4765, longitude: -75.7013, timeZone: 'America/Toronto' },
  { id: 'ottawa-on', label: 'Ottawa', province: 'ON', latitude: 45.4215, longitude: -75.6972, timeZone: 'America/Toronto' },
  { id: 'toronto-on', label: 'Toronto', province: 'ON', latitude: 43.6532, longitude: -79.3832, timeZone: 'America/Toronto' },
  { id: 'halifax-ns', label: 'Halifax', province: 'NS', latitude: 44.6488, longitude: -63.5752, timeZone: 'America/Halifax' },
  { id: 'st-johns-nl', label: "St. John's", province: 'NL', latitude: 47.5615, longitude: -52.7126, timeZone: 'America/St_Johns' },
  { id: 'winnipeg-mb', label: 'Winnipeg', province: 'MB', latitude: 49.8951, longitude: -97.1384, timeZone: 'America/Winnipeg' },
  { id: 'regina-sk', label: 'Regina', province: 'SK', latitude: 50.4452, longitude: -104.6189, timeZone: 'America/Regina' },
  { id: 'calgary-ab', label: 'Calgary', province: 'AB', latitude: 51.0447, longitude: -114.0719, timeZone: 'America/Edmonton' },
  { id: 'vancouver-bc', label: 'Vancouver', province: 'BC', latitude: 49.2827, longitude: -123.1207, timeZone: 'America/Vancouver' },
];

export const PROVINCE_NAMES: Readonly<Record<string, string>> = {
  AB: 'Alberta',
  BC: 'British Columbia',
  MB: 'Manitoba',
  NL: 'Newfoundland and Labrador',
  NS: 'Nova Scotia',
  ON: 'Ontario',
  QC: 'Québec',
  SK: 'Saskatchewan',
};

export function getCityById(id: unknown): City | undefined {
  if (typeof id !== 'string') return undefined;
  return CITIES.find(city => city.id === id);
}

export function provinceName(city: City): string {
  return PROVINCE_NAMES[city.province] ?? city.province;
}

export function cityDisplayName(city: City): string {
  return `${city.label}, ${provinceName(city)}`;
}

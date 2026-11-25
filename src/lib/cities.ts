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
  /** Present for catalogue cities (WEA-23); the curated list below omits it. */
  country?: 'CA' | 'US';
  /** GeoNames population, used only to rank search results. */
  population?: number;
};

/**
 * Featured cities, bundled with the page: the default city, the chat's quick choices and the
 * search suggestions before the full catalogue loads. The full Canada and United States
 * catalogue (WEA-23) keeps these IDs; see `catalogue.ts` and `public/data/cities-na.v1.json`.
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
  NB: 'New Brunswick',
  NT: 'Northwest Territories',
  NU: 'Nunavut',
  PE: 'Prince Edward Island',
  QC: 'Québec',
  SK: 'Saskatchewan',
  YT: 'Yukon',
  // United States (WEA-23)
  AK: 'Alaska', AL: 'Alabama', AR: 'Arkansas', AZ: 'Arizona', CA: 'California', CO: 'Colorado',
  CT: 'Connecticut', DC: 'District of Columbia', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', IA: 'Iowa', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', KS: 'Kansas', KY: 'Kentucky',
  LA: 'Louisiana', MA: 'Massachusetts', MD: 'Maryland', ME: 'Maine', MI: 'Michigan', MN: 'Minnesota',
  MO: 'Missouri', MS: 'Mississippi', MT: 'Montana', NC: 'North Carolina', ND: 'North Dakota',
  NE: 'Nebraska', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NV: 'Nevada', NY: 'New York',
  OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VA: 'Virginia', VT: 'Vermont',
  WA: 'Washington', WI: 'Wisconsin', WV: 'West Virginia', WY: 'Wyoming',
};

const CURATED_ID = /^[a-z][a-z-]{1,30}-[a-z]{2}$/;
const GEONAMES_ID = /^gn-\d{1,10}$/;

/** Shape check for a catalogue city ID (curated slug or `gn-<geonameid>`); not a lookup. */
export function isCityIdFormat(id: unknown): id is string {
  return typeof id === 'string' && (CURATED_ID.test(id) || GEONAMES_ID.test(id));
}

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

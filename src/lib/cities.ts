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
 * Public city catalogue. WEA-5 ships Laval only; city search (WX-01) extends it.
 */
export const CITIES: readonly City[] = [
  {
    id: 'laval-qc',
    label: 'Laval',
    province: 'QC',
    latitude: 45.5833,
    longitude: -73.75,
    timeZone: 'America/Toronto',
  },
];

const PROVINCE_NAMES: Record<string, string> = { QC: 'Québec' };

export function getCityById(id: unknown): City | undefined {
  if (typeof id !== 'string') return undefined;
  return CITIES.find(city => city.id === id);
}

export function cityDisplayName(city: City): string {
  return `${city.label}, ${PROVINCE_NAMES[city.province] ?? city.province}`;
}

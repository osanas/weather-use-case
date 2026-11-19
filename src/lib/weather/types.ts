/** Current conditions. A `null` value means the provider did not supply the reading. */
export type CurrentConditions = {
  /** Observation instant as an ISO 8601 UTC string. */
  time: string | null;
  temperatureC: number | null;
  windKmh: number | null;
  weatherCode: number | null;
};

/** One hourly forecast point. Readings are `null` when missing. */
export type HourlyPoint = {
  /** Start of the hour as an ISO 8601 UTC instant. */
  time: string;
  temperatureC: number | null;
  /** Probability of precipitation, 0–100 %. */
  precipitationProbability: number | null;
  windKmh: number | null;
  weatherCode: number | null;
};

/** One day of the daily summary, aggregated over the city's local day. */
export type DailySummary = {
  /** Local calendar date in the city's time zone, YYYY-MM-DD. */
  date: string;
  minC: number | null;
  maxC: number | null;
  /** Maximum hourly probability of precipitation for the day, 0–100 %. */
  precipitationProbability: number | null;
  weatherCode: number | null;
};

/** Response body of `GET /api/weather?cityId=<id>`. */
export type WeatherResponse = {
  cityId: string;
  /** IANA time zone from the catalogue. */
  timezone: string;
  /** Instant the server fetched the forecast from Open-Meteo, ISO 8601 UTC. */
  fetchedAt: string;
  current: CurrentConditions;
  hourly: HourlyPoint[];
  daily: DailySummary[];
};

export type WeatherErrorBody = {
  error: 'invalid_city' | 'weather_unavailable';
  message: string;
};

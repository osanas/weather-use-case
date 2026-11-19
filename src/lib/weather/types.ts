/** Current conditions. A `null` value means the provider did not supply the reading. */
export type CurrentConditions = {
  /** Observation instant as an ISO 8601 UTC string. */
  time: string | null;
  temperatureC: number | null;
  windKmh: number | null;
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
};

export type WeatherErrorBody = {
  error: 'invalid_city' | 'weather_unavailable';
  message: string;
};

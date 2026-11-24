import { describe, expect, it, vi } from 'vitest';
import { getCityById, type City } from '@/lib/cities';
import {
  buildForecastUrl, fetchForecast, localDateFromMidnight, localDaysFromMidnights, ProviderError,
} from './open-meteo';

const laval = getCityById('laval-qc')!;
const vancouver = getCityById('vancouver-bc')!;
const stJohns = getCityById('st-johns-nl')!;
const FIXED_NOW = Date.parse('2027-06-14T12:03:00Z');
const now = () => FIXED_NOW;
const epoch = (iso: string) => Date.parse(iso) / 1000;

/** Synthetic Open-Meteo payload (timeformat=unixtime). `dayStarts` are local-midnight instants. */
function providerBody(
  dayStarts: string[] = ['2027-06-14T04:00:00Z', '2027-06-15T04:00:00Z'],
  utcOffsetSeconds = -4 * 3600,
) {
  return {
    utc_offset_seconds: utcOffsetSeconds,
    current: {
      time: epoch('2027-06-14T12:00:00Z'),
      interval: 900,
      temperature_2m: 18.2,
      wind_speed_10m: 14.8,
      weather_code: 1,
      is_day: 1,
    },
    hourly: {
      time: [epoch('2027-06-14T12:00:00Z'), epoch('2027-06-14T13:00:00Z')],
      temperature_2m: [18.2, null],
      precipitation_probability: [10, 20],
      wind_speed_10m: [14.8, 30],
      weather_code: [1, null],
    },
    daily: {
      time: dayStarts.map(epoch),
      weather_code: dayStarts.map(() => 3),
      temperature_2m_max: dayStarts.map(() => 22),
      temperature_2m_min: dayStarts.map((_, i) => (i === 0 ? null : 11)),
      precipitation_probability_max: dayStarts.map(() => 40),
    },
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function expectOutcome(promise: Promise<unknown>, outcome: string) {
  const error = await promise.then(() => null, (e: unknown) => e);
  expect(error).toBeInstanceOf(ProviderError);
  expect((error as ProviderError).outcome).toBe(outcome);
}

const run = (body: unknown, city: City = laval) =>
  fetchForecast(city, { fetchImpl: async () => jsonResponse(body), now });

describe('buildForecastUrl', () => {
  it('targets the fixed Open-Meteo host with catalogue coordinates, zone and metric units only', () => {
    const url = buildForecastUrl(laval);
    expect(url.origin).toBe('https://api.open-meteo.com');
    expect(url.pathname).toBe('/v1/forecast');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      latitude: '45.5833',
      longitude: '-73.7500',
      current: 'temperature_2m,wind_speed_10m,weather_code,is_day',
      hourly: 'temperature_2m,precipitation_probability,wind_speed_10m,weather_code',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
      // One extra day: its local midnight closes the seventh public day.
      forecast_days: '8',
      temperature_unit: 'celsius',
      wind_speed_unit: 'kmh',
      timeformat: 'unixtime',
      timezone: 'America/Toronto',
    });
  });

  it("uses each city's own IANA zone", () => {
    expect(buildForecastUrl(vancouver).searchParams.get('timezone')).toBe('America/Vancouver');
    expect(buildForecastUrl(stJohns).searchParams.get('timezone')).toBe('America/St_Johns');
  });
});

describe('localDateFromMidnight', () => {
  it('follows the provider offset, not the server time-zone data', () => {
    // Vancouver local midnight on 2027-01-15 under UTC-8 (PST) and under UTC-7
    // (British Columbia's permanent daylight time in newer tzdata) gives the same date.
    expect(localDateFromMidnight(epoch('2027-01-15T08:00:00Z'), -8 * 3600)).toBe('2027-01-15');
    expect(localDateFromMidnight(epoch('2027-01-15T07:00:00Z'), -7 * 3600)).toBe('2027-01-15');
  });

  it('keeps the right date after a DST change inside the horizon', () => {
    // Request made on 2027-11-06 in Toronto (EDT, UTC-4). After the 2027-11-07 fall-back,
    // local midnight is 05:00Z (EST), one hour off the request-time offset.
    expect(localDateFromMidnight(epoch('2027-11-08T05:00:00Z'), -4 * 3600)).toBe('2027-11-08');
    // Spring forward: request in EST (UTC-5), midnight after the change at 04:00Z (EDT).
    expect(localDateFromMidnight(epoch('2027-03-15T04:00:00Z'), -5 * 3600)).toBe('2027-03-15');
  });

  it("handles St. John's half-hour offset and zero-pads the date", () => {
    expect(localDateFromMidnight(epoch('2027-03-05T03:30:00Z'), -3.5 * 3600)).toBe('2027-03-05');
  });
});

/** Full synthetic payload: hourly points cover every hour between the first and last midnight. */
function fullProviderBody(midnightsIso: string[], utcOffsetSeconds: number) {
  const midnights = midnightsIso.map(epoch);
  const first = midnights[0]!;
  const last = midnights[midnights.length - 1]!;
  const time = Array.from({ length: (last - first) / 3600 }, (_, i) => first + i * 3600);
  const fill = time.map(() => 5);
  return {
    ...providerBody(midnightsIso, utcOffsetSeconds),
    hourly: { time, temperature_2m: fill, precipitation_probability: fill, wind_speed_10m: fill, weather_code: fill },
  };
}

/** `count` consecutive local midnights `stepHours` apart (no DST change in between). */
const midnightsEvery = (firstIso: string, count: number, stepHours = 24) =>
  Array.from({ length: count }, (_, i) => new Date(Date.parse(firstIso) + i * stepHours * 3_600_000).toISOString());

describe('localDaysFromMidnights', () => {
  it('uses consecutive provider midnights as day bounds, so DST days last 23 or 25 hours', () => {
    // America/Toronto: spring forward on 2027-03-14, fall back on 2027-11-07.
    const spring = localDaysFromMidnights(
      ['2027-03-14T05:00:00Z', '2027-03-15T04:00:00Z'].map(epoch), -5 * 3600);
    expect(spring).toEqual([
      { date: '2027-03-14', startsAt: '2027-03-14T05:00:00.000Z', endsAt: '2027-03-15T04:00:00.000Z' },
    ]);
    const fall = localDaysFromMidnights(
      ['2027-11-07T04:00:00Z', '2027-11-08T05:00:00Z'].map(epoch), -4 * 3600);
    expect(fall).toEqual([
      { date: '2027-11-07', startsAt: '2027-11-07T04:00:00.000Z', endsAt: '2027-11-08T05:00:00.000Z' },
    ]);
  });

  it('lists no day whose end is unknown', () => {
    expect(localDaysFromMidnights([epoch('2027-06-14T04:00:00Z')], -4 * 3600)).toEqual([]);
  });
});

describe('fetchForecast', () => {
  it('keeps the public seven-day horizon and closes day seven with the extra midnight', async () => {
    const body = fullProviderBody(midnightsEvery('2027-06-14T04:00:00Z', 9), -4 * 3600);
    // Eight days of hourly data are returned; one more midnight is beyond them.
    const result = await run(body);
    expect(result.daily).toHaveLength(7);
    expect(result.hourly).toHaveLength(168);
    expect(result.hourly.at(-1)?.time).toBe('2027-06-21T03:00:00.000Z');
    expect(result.localDays).toHaveLength(7);
    expect(result.localDays.at(-1)).toEqual({
      date: '2027-06-20', startsAt: '2027-06-20T04:00:00.000Z', endsAt: '2027-06-21T04:00:00.000Z',
    });
  });

  it('follows provider local midnights in Vancouver after BC moved to UTC-7 year-round', async () => {
    // Synthetic November 2026 payload: the provider applies UTC-7, while Node 24.12's
    // tz 2025b would still apply PST (UTC-8) and place 07:00Z on the previous date.
    const body = fullProviderBody(midnightsEvery('2026-11-19T07:00:00Z', 8), -7 * 3600);
    const result = await fetchForecast(vancouver, {
      fetchImpl: async () => jsonResponse(body), now: () => Date.parse('2026-11-19T18:00:00Z'),
    });
    expect(result.localDays.find(d => d.date === '2026-11-20')).toEqual({
      date: '2026-11-20', startsAt: '2026-11-20T07:00:00.000Z', endsAt: '2026-11-21T07:00:00.000Z',
    });
    expect(result.daily.map(d => d.date)[1]).toBe('2026-11-20');
  });

  it('works for a zone outside the catalogue without zone-specific code', async () => {
    // Synthetic city; the catalogue is unchanged. Australia/Sydney falls back on
    // 2027-04-04 (AEDT UTC+11 to AEST UTC+10), a southern-hemisphere 25-hour day.
    const sydney: City = {
      id: 'synthetic-sydney', label: 'Synthetic Sydney', province: 'NSW',
      latitude: -33.8688, longitude: 151.2093, timeZone: 'Australia/Sydney',
    };
    const body = fullProviderBody(
      ['2027-04-02T13:00:00Z', '2027-04-03T13:00:00Z', '2027-04-04T14:00:00Z'], 11 * 3600);
    const result = await fetchForecast(sydney, { fetchImpl: async () => jsonResponse(body), now });
    expect(buildForecastUrl(sydney).searchParams.get('timezone')).toBe('Australia/Sydney');
    expect(result.localDays).toEqual([
      { date: '2027-04-03', startsAt: '2027-04-02T13:00:00.000Z', endsAt: '2027-04-03T13:00:00.000Z' },
      { date: '2027-04-04', startsAt: '2027-04-03T13:00:00.000Z', endsAt: '2027-04-04T14:00:00.000Z' },
    ]);
  });

  it('normalizes current, hourly and daily data to UTC instants and local dates', async () => {
    expect(await run(providerBody())).toEqual({
      cityId: 'laval-qc',
      timezone: 'America/Toronto',
      fetchedAt: '2027-06-14T12:03:00.000Z',
      current: { time: '2027-06-14T12:00:00.000Z', temperatureC: 18.2, windKmh: 14.8, weatherCode: 1, isDay: true },
      hourly: [
        { time: '2027-06-14T12:00:00.000Z', temperatureC: 18.2, precipitationProbability: 10, windKmh: 14.8, weatherCode: 1 },
        { time: '2027-06-14T13:00:00.000Z', temperatureC: null, precipitationProbability: 20, windKmh: 30, weatherCode: null },
      ],
      daily: [
        { date: '2027-06-14', minC: null, maxC: 22, precipitationProbability: 40, weatherCode: 3 },
        { date: '2027-06-15', minC: 11, maxC: 22, precipitationProbability: 40, weatherCode: 3 },
      ],
      // Only the first day has a known end (the next local midnight).
      localDays: [
        { date: '2027-06-14', startsAt: '2027-06-14T04:00:00.000Z', endsAt: '2027-06-15T04:00:00.000Z' },
      ],
    });
  });

  it('maps local-midnight day starts to the local date in Vancouver and St. John\'s', async () => {
    // Local midnight in Vancouver (PDT, UTC-7) and St. John's (NDT, UTC-2:30).
    const van = await run(providerBody(['2027-06-14T07:00:00Z', '2027-06-15T07:00:00Z'], -7 * 3600), vancouver);
    expect(van.daily.map(d => d.date)).toEqual(['2027-06-14', '2027-06-15']);
    expect(van.timezone).toBe('America/Vancouver');
    const nl = await run(
      providerBody(['2027-06-14T02:30:00Z', '2027-06-15T02:30:00Z'], -2.5 * 3600), stJohns);
    expect(nl.daily.map(d => d.date)).toEqual(['2027-06-14', '2027-06-15']);
  });

  it('rejects a payload without a valid UTC offset', async () => {
    const { utc_offset_seconds: _omit, ...withoutOffset } = providerBody();
    void _omit;
    await expectOutcome(run(withoutOffset), 'invalid_response');
    await expectOutcome(run({ ...providerBody(), utc_offset_seconds: 'EST' }), 'invalid_response');
  });

  it('takes the time zone from the catalogue, not the provider echo', async () => {
    const result = await run({ ...providerBody(), timezone: 'Etc/UTC' });
    expect(result.timezone).toBe('America/Toronto');
  });

  it('sends no client-derived headers', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse(providerBody()));
    await fetchForecast(laval, { fetchImpl, now });
    expect(fetchImpl.mock.calls[0]![1]!.headers).toEqual({ Accept: 'application/json' });
  });

  it('maps missing current readings to null', async () => {
    const body = { ...providerBody(), current: { time: epoch('2027-06-14T12:00:00Z'), temperature_2m: null } };
    expect((await run(body)).current).toEqual({
      time: '2027-06-14T12:00:00.000Z', temperatureC: null, windKmh: null, weatherCode: null, isDay: null,
    });
  });

  it('maps is_day to a boolean and treats unexpected values as unknown', async () => {
    const withIsDay = async (isDay: unknown) =>
      (await run({ ...providerBody(), current: { ...providerBody().current, is_day: isDay } })).current.isDay;
    expect(await withIsDay(1)).toBe(true);
    expect(await withIsDay(0)).toBe(false);
    expect(await withIsDay(null)).toBeNull();
    expect(await withIsDay(2)).toBeNull();
  });

  describe('rejects incomplete or inconsistent payloads as invalid_response', () => {
    const base = providerBody();
    const cases: Record<string, unknown> = {
      'hourly array length mismatch': { ...base, hourly: { ...base.hourly, wind_speed_10m: [1] } },
      'daily array length mismatch': { ...base, daily: { ...base.daily, temperature_2m_max: [] } },
      'missing hourly block': { current: base.current, daily: base.daily },
      'missing daily block': { current: base.current, hourly: base.hourly },
      'non-increasing hourly times': {
        ...base, hourly: { ...base.hourly, time: [base.hourly.time[1], base.hourly.time[0]] },
      },
      'empty hourly series': {
        ...base,
        hourly: { time: [], temperature_2m: [], precipitation_probability: [], wind_speed_10m: [], weather_code: [] },
      },
      'more than 200 hourly points': (() => {
        const n = 201;
        const time = Array.from({ length: n }, (_, i) => base.hourly.time[0]! + i * 3600);
        const fill = Array.from({ length: n }, () => 1);
        return {
          ...base,
          hourly: { time, temperature_2m: fill, precipitation_probability: fill, wind_speed_10m: fill, weather_code: fill },
        };
      })(),
      'non-numeric reading': { ...base, hourly: { ...base.hourly, temperature_2m: ['warm', 1] } },
      'non-numeric current time': { ...base, current: { time: 'soon' } },
    };
    for (const [name, body] of Object.entries(cases)) {
      it(name, async () => {
        await expectOutcome(run(body), 'invalid_response');
      });
    }
  });

  it('reports a non-2xx status as http_error', async () => {
    await expectOutcome(
      fetchForecast(laval, { fetchImpl: async () => jsonResponse({ reason: 'x' }, 502), now }),
      'http_error',
    );
  });

  it('reports a non-JSON body as invalid_response', async () => {
    await expectOutcome(
      fetchForecast(laval, { fetchImpl: async () => new Response('<html>'), now }),
      'invalid_response',
    );
  });

  it('reports a network failure', async () => {
    await expectOutcome(
      fetchForecast(laval, { fetchImpl: async () => { throw new TypeError('fetch failed'); }, now }),
      'network',
    );
  });

  it('reports a timeout', async () => {
    const fetchImpl = (_url: URL | RequestInfo, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal!.reason));
      });
    await expectOutcome(fetchForecast(laval, { fetchImpl, now, timeoutMs: 5 }), 'timeout');
  });
});

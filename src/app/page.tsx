import { headers } from 'next/headers';
import Link from 'next/link';
import { WeatherApp } from '@/components/WeatherApp';
import { LiveWeatherLabel } from '@/components/world/LiveWeatherLabel';
import { Scenery } from '@/components/world/Scenery';
import { World } from '@/components/world/World';
import { CITIES, getCityById } from '@/lib/cities';
import { locateDefaultCity } from '@/lib/geo/headers';

const DEFAULT_CITY_ID = 'laval-qc';

export default async function HomePage() {
  const fallback = getCityById(DEFAULT_CITY_ID);
  if (!fallback) throw new Error('Default city missing from catalogue');
  // Uses the host's approximate position on the server only; no browser permission is requested.
  const { city, located } = locateDefaultCity(await headers(), fallback, CITIES);

  return (
    <World scenery={<Scenery />}>
      <main>
        <header className="site-header">
          <h1 className="wordmark">Weather Window</h1>
          <p className="tagline">Current conditions, hourly and five-day forecasts for Canadian cities, and the best time for an outdoor activity.</p>
          <LiveWeatherLabel />
        </header>
        <WeatherApp cities={CITIES} defaultCityId={city.id} locatedCityId={located ? city.id : null} />
        <footer>
          <p>
            Weather data by{' '}
            <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">
              Open-Meteo.com
            </a>
            {' · '}
            <Link href="/privacy">Privacy notice</Link>
          </p>
        </footer>
      </main>
    </World>
  );
}

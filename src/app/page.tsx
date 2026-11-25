import { headers } from 'next/headers';
import Link from 'next/link';
import { UnitsProvider, UnitsToggle } from '@/components/Units';
import { WeatherApp } from '@/components/WeatherApp';
import { LiveWeatherLabel } from '@/components/world/LiveWeatherLabel';
import { Scenery } from '@/components/world/Scenery';
import { World } from '@/components/world/World';
import { CATALOGUE } from '@/lib/catalogue';
import { CITIES, getCityById } from '@/lib/cities';
import { locateDefaultCity } from '@/lib/geo/headers';

const DEFAULT_CITY_ID = 'laval-qc';

export default async function HomePage() {
  const fallback = getCityById(DEFAULT_CITY_ID);
  if (!fallback) throw new Error('Default city missing from catalogue');
  // Uses the host's approximate position on the server only; no browser permission is requested.
  const { city } = locateDefaultCity(await headers(), fallback, CATALOGUE);

  return (
    <World scenery={<Scenery />}>
      <UnitsProvider>
      <main>
        <header className="site-header">
          <h1 className="wordmark">Weather Window</h1>
          <LiveWeatherLabel />
          <UnitsToggle />
        </header>
        <WeatherApp cities={CITIES} defaultCity={city} />
        <footer>
          <p>
            Weather data by{' '}
            <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">
              Open-Meteo.com
            </a>
            {' · Cities from '}
            <a href="https://www.geonames.org/" target="_blank" rel="noopener noreferrer">GeoNames</a>
            {' ('}
            <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>
            {')'}
            {' · '}
            <Link href="/privacy">Privacy notice</Link>
          </p>
        </footer>
      </main>
      </UnitsProvider>
    </World>
  );
}

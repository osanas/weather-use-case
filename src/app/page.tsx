import { headers } from 'next/headers';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { UnitsProvider } from '@/components/Units';
import { WeatherApp } from '@/components/WeatherApp';
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
        <SiteHeader />
        <WeatherApp cities={CITIES} defaultCity={city} />
        <SiteFooter />
      </main>
      </UnitsProvider>
    </World>
  );
}

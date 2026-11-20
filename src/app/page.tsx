import { WeatherApp } from '@/components/WeatherApp';
import { CITIES, getCityById } from '@/lib/cities';

const DEFAULT_CITY_ID = 'laval-qc';

export default function HomePage() {
  if (!getCityById(DEFAULT_CITY_ID)) throw new Error('Default city missing from catalogue');

  return (
    <main>
      <header>
        <h1>Weather Window</h1>
        <p>Current conditions, hourly and five-day forecasts for Canadian cities, and the best time for an outdoor activity.</p>
      </header>
      <WeatherApp cities={CITIES} defaultCityId={DEFAULT_CITY_ID} />
      <footer>
        <p>
          Weather data by{' '}
          <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">
            Open-Meteo.com
          </a>
        </p>
      </footer>
    </main>
  );
}

import { CurrentWeather } from '@/components/CurrentWeather';
import { cityDisplayName, getCityById } from '@/lib/cities';

const DEFAULT_CITY_ID = 'laval-qc';

export default function HomePage() {
  const city = getCityById(DEFAULT_CITY_ID);
  if (!city) throw new Error('Default city missing from catalogue');
  const cityName = cityDisplayName(city);

  return (
    <main>
      <header>
        <h1>Weather Window</h1>
        <p>{cityName}</p>
      </header>
      <CurrentWeather cityId={city.id} cityName={cityName} />
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

'use client';

import { useState } from 'react';
import { cityDisplayName, type City } from '@/lib/cities';
import { isExpired } from '@/lib/forecast';
import { useForecast } from '@/lib/weather/useForecast';
import { PlanningChat } from './chat/PlanningChat';
import { CitySelector } from './CitySelector';
import { CurrentPanel, ForecastPanels } from './ForecastView';

export function WeatherApp({ cities, defaultCityId }: { cities: readonly City[]; defaultCityId: string }) {
  const [selectedId, setSelectedId] = useState(defaultCityId);
  const city = cities.find(c => c.id === selectedId) ?? cities[0];
  // Loaded once for the selected city and shared by the chat and the forecast panels.
  const forecast = useForecast(city?.id ?? defaultCityId);
  if (!city) return null;
  const cityName = cityDisplayName(city);
  const fresh = forecast.state.status === 'ready' && !isExpired(forecast.state.data.fetchedAt, forecast.now)
    ? forecast.state.data
    : null;

  return (
    <>
      {/* Keyed so a city chosen in the chat also shows here. */}
      <CitySelector key={city.id} cities={cities} selectedId={city.id} onSelect={setSelectedId} />
      <div className="top-grid">
        <PlanningChat city={city} cities={cities} onSelectCity={setSelectedId} days={fresh?.daily ?? null} />
        <CurrentPanel state={forecast.state} now={forecast.now} cityName={cityName} onReload={forecast.reload} />
      </div>
      <ForecastPanels state={forecast.state} now={forecast.now} />
    </>
  );
}

'use client';

import { useState } from 'react';
import { cityDisplayName, type City } from '@/lib/cities';
import { CitySelector } from './CitySelector';
import { ForecastView } from './ForecastView';
import { PlanningForm } from './PlanningForm';

export function WeatherApp({ cities, defaultCityId }: { cities: readonly City[]; defaultCityId: string }) {
  const [selectedId, setSelectedId] = useState(defaultCityId);
  const city = cities.find(c => c.id === selectedId) ?? cities[0];
  if (!city) return null;
  const cityName = cityDisplayName(city);

  return (
    <>
      <CitySelector cities={cities} selectedId={city.id} onSelect={setSelectedId} />
      {/* Keyed by city so a slower response for a previous city can never render here. */}
      <ForecastView key={city.id} cityId={city.id} cityName={cityName} />
      <PlanningForm city={city} cityName={cityName} />
    </>
  );
}

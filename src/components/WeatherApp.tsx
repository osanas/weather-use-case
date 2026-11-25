'use client';

import { useCallback, useMemo, useReducer, useState } from 'react';
import { cityDisplayName, type City } from '@/lib/cities';
import { isExpired } from '@/lib/forecast';
import { applyChatPlan, boardId, stopChecking, type BoardPlan } from '@/lib/planner/board';
import { useDateBounds } from '@/lib/planner/usePlanner';
import { useForecast } from '@/lib/weather/useForecast';
import { PlanBoard } from './board/PlanBoard';
import { PlanningChat } from './chat/PlanningChat';
import { CitySelector } from './CitySelector';
import { CurrentPanel } from './ForecastView';
import { LocationNotice } from './LocationNotice';
import { WeatherWidget } from './WeatherWidget';

type Board = { plans: BoardPlan[]; activeId: string | null };
type BoardAction =
  | { type: 'chat'; conversationId: string; cityId: string; plan: BoardPlan | null }
  | { type: 'reopen'; id: string };

// Plans live in page memory only; a reload starts an empty board.
function boardReducer(state: Board, action: BoardAction): Board {
  if (action.type === 'reopen') return { ...state, plans: stopChecking(state.plans, action.id) };
  const plans = applyChatPlan(state.plans, action.conversationId, action.cityId, action.plan);
  return { plans, activeId: boardId(action.conversationId, action.cityId) };
}

export function WeatherApp({
  cities,
  defaultCity,
  locatedCityId = null,
}: {
  /** Featured cities bundled with the page; any catalogue city can be chosen through search. */
  cities: readonly City[];
  defaultCity: City;
  /** Set only when the default came from the visitor's approximate location. */
  locatedCityId?: string | null;
}) {
  const [selectedId, setSelectedId] = useState(defaultCity.id);
  const [locationNoticeOpen, setLocationNoticeOpen] = useState(locatedCityId !== null);
  // Featured cities plus every catalogue city chosen on this page, so plans can find theirs again.
  const [chosen, setChosen] = useState<readonly City[]>(() => [defaultCity]);
  const known = useMemo(
    () => [...cities, ...chosen.filter(c => !cities.some(f => f.id === c.id))],
    [cities, chosen],
  );
  const city = known.find(c => c.id === selectedId) ?? defaultCity;
  const locatedCity = locatedCityId ? known.find(c => c.id === locatedCityId) : undefined;
  // Loaded once for the selected city and shared by the chat, the board and the forecast panels.
  const forecast = useForecast(city.id);
  const bounds = useDateBounds(city?.timeZone ?? 'UTC');
  const [board, dispatch] = useReducer(boardReducer, { plans: [], activeId: null });
  const [reopen, setReopen] = useState<{ plan: BoardPlan; seq: number } | null>(null);
  const cityId = city?.id;

  const onPlanChange = useCallback((conversationId: string, plan: BoardPlan | null) => {
    if (cityId) dispatch({ type: 'chat', conversationId, cityId, plan });
  }, [cityId]);

  // Any city the visitor picks (search, chat or plan) replaces the located default and closes the notice.
  const chooseCity = useCallback((next: City) => {
    setChosen(list => (list.some(c => c.id === next.id) ? list : [...list, next]));
    setSelectedId(next.id);
    setLocationNoticeOpen(false);
  }, []);

  const onOpen = useCallback((plan: BoardPlan) => {
    dispatch({ type: 'reopen', id: plan.id });
    setSelectedId(plan.cityId);
    setLocationNoticeOpen(false);
    setReopen(r => ({ plan, seq: (r?.seq ?? 0) + 1 }));
  }, []);

  if (!city) return null;
  const cityName = cityDisplayName(city);
  const fresh = forecast.state.status === 'ready' && !isExpired(forecast.state.data.fetchedAt, forecast.now)
    ? forecast.state.data
    : null;

  return (
    <>
      {locationNoticeOpen && locatedCity && locatedCity.id === city.id && (
        <LocationNotice cityName={cityDisplayName(locatedCity)} onDismiss={() => setLocationNoticeOpen(false)} />
      )}
      {/* Keyed so a city chosen in the chat also shows here. */}
      <CitySelector key={city.id} cities={cities} selected={city} onSelect={chooseCity} />
      <div className="top-grid">
        <PlanningChat
          city={city}
          cities={cities}
          onSelectCity={chooseCity}
          days={fresh?.daily ?? null}
          onPlanChange={onPlanChange}
          reopen={reopen}
        />
        <CurrentPanel state={forecast.state} now={forecast.now} cityName={cityName} onReload={forecast.reload} />
      </div>
      <PlanBoard
        cityName={cityName}
        timeZone={city.timeZone}
        bounds={bounds}
        forecast={fresh}
        plans={board.plans.filter(p => p.cityId === city.id)}
        activeId={board.activeId}
        onOpen={onOpen}
      />
      <WeatherWidget
        forecast={forecast.state.status === 'ready' ? forecast.state.data : null}
        timeZone={city.timeZone}
        now={forecast.now}
      />
    </>
  );
}

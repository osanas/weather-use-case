'use client';

import { useCallback, useReducer, useState } from 'react';
import { cityDisplayName, type City } from '@/lib/cities';
import { isExpired } from '@/lib/forecast';
import { applyChatPlan, boardId, stopChecking, type BoardPlan } from '@/lib/planner/board';
import { useDateBounds } from '@/lib/planner/usePlanner';
import { useForecast } from '@/lib/weather/useForecast';
import { PlanBoard } from './board/PlanBoard';
import { PlanningChat } from './chat/PlanningChat';
import { CitySelector } from './CitySelector';
import { CurrentPanel, ForecastPanels } from './ForecastView';

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

export function WeatherApp({ cities, defaultCityId }: { cities: readonly City[]; defaultCityId: string }) {
  const [selectedId, setSelectedId] = useState(defaultCityId);
  const city = cities.find(c => c.id === selectedId) ?? cities[0];
  // Loaded once for the selected city and shared by the chat, the board and the forecast panels.
  const forecast = useForecast(city?.id ?? defaultCityId);
  const bounds = useDateBounds(city?.timeZone ?? 'UTC');
  const [board, dispatch] = useReducer(boardReducer, { plans: [], activeId: null });
  const [reopen, setReopen] = useState<{ plan: BoardPlan; seq: number } | null>(null);
  const cityId = city?.id;

  const onPlanChange = useCallback((conversationId: string, plan: BoardPlan | null) => {
    if (cityId) dispatch({ type: 'chat', conversationId, cityId, plan });
  }, [cityId]);

  const onOpen = useCallback((plan: BoardPlan) => {
    dispatch({ type: 'reopen', id: plan.id });
    setSelectedId(plan.cityId);
    setReopen(r => ({ plan, seq: (r?.seq ?? 0) + 1 }));
  }, []);

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
        <PlanningChat
          city={city}
          cities={cities}
          onSelectCity={setSelectedId}
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
      <ForecastPanels state={forecast.state} now={forecast.now} />
    </>
  );
}

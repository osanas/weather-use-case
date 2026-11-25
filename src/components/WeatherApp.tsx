'use client';

import { useCallback, useMemo, useReducer, useState, type ReactNode } from 'react';
import { cityDisplayName, type City } from '@/lib/cities';
import { isExpired, nextDays } from '@/lib/forecast';
import { applyChatPlan, boardId, stopChecking, type BoardPlan } from '@/lib/planner/board';
import { useForecast } from '@/lib/weather/useForecast';
import { DayPlans, PlanTray } from './board/PlanChips';
import { PlanningChat } from './chat/PlanningChat';
import { CitySelector } from './CitySelector';
import { CurrentPanel } from './ForecastView';
import { WeatherWidget, type WeatherOverlay } from './WeatherWidget';

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
}: {
  /** Featured cities bundled with the page; any catalogue city can be chosen through search. */
  cities: readonly City[];
  defaultCity: City;
}) {
  const [selectedId, setSelectedId] = useState(defaultCity.id);
  // Featured cities plus every catalogue city chosen on this page, so plans can find theirs again.
  const [chosen, setChosen] = useState<readonly City[]>(() => [defaultCity]);
  const known = useMemo(
    () => [...cities, ...chosen.filter(c => !cities.some(f => f.id === c.id))],
    [cities, chosen],
  );
  const city = known.find(c => c.id === selectedId) ?? defaultCity;
  // Loaded once for the selected city and shared by the chat, the board and the forecast panels.
  const forecast = useForecast(city.id);
  const [board, dispatch] = useReducer(boardReducer, { plans: [], activeId: null });
  const [reopen, setReopen] = useState<{ plan: BoardPlan; seq: number } | null>(null);
  const cityId = city?.id;

  const onPlanChange = useCallback((conversationId: string, plan: BoardPlan | null) => {
    if (cityId) dispatch({ type: 'chat', conversationId, cityId, plan });
  }, [cityId]);

  // Any city the visitor picks (search, chat or plan) replaces the located default.
  const chooseCity = useCallback((next: City) => {
    setChosen(list => (list.some(c => c.id === next.id) ? list : [...list, next]));
    setSelectedId(next.id);
  }, []);

  const onOpen = useCallback((plan: BoardPlan) => {
    dispatch({ type: 'reopen', id: plan.id });
    setSelectedId(plan.cityId);
    setReopen(r => ({ plan, seq: (r?.seq ?? 0) + 1 }));
  }, []);

  // The widget shows the active plan's day whenever that day changes or a plan is reopened;
  // otherwise the visitor's own day choice stands.
  const [widgetDate, setWidgetDate] = useState<string | undefined>(undefined);
  const active = board.plans.find(p => p.id === board.activeId) ?? null;
  const focusKey = active?.date ? `${active.id}|${active.date}|${reopen?.seq ?? 0}` : null;
  const [lastFocus, setLastFocus] = useState<string | null>(null);
  if (focusKey !== lastFocus) {
    setLastFocus(focusKey);
    if (active?.date) setWidgetDate(active.date);
  }

  const cityPlans = useMemo(() => board.plans.filter(p => p.cityId === cityId), [board.plans, cityId]);
  const ready = forecast.state.status === 'ready' ? forecast.state.data : null;
  const shownDates = useMemo(() => {
    if (!ready || !city) return new Set<string>();
    return new Set(nextDays(ready.daily, city.timeZone, forecast.now, ready.daily.length).map(d => d.date));
  }, [ready, city, forecast.now]);
  const timeZone = city?.timeZone ?? 'UTC';
  const activeId = board.activeId;

  // Plans drawn on the widget exactly as the planner returned them; nothing is scored here.
  const overlay = useMemo<WeatherOverlay>(() => {
    const dayBadges: Record<string, ReactNode> = {};
    for (const date of shownDates) {
      const dayPlans = cityPlans.filter(p => p.date === date);
      if (dayPlans.length > 0) {
        dayBadges[date] = <DayPlans plans={dayPlans} timeZone={timeZone} activeId={activeId} onOpen={onOpen} />;
      }
    }
    const activePlan = cityPlans.find(p => p.id === activeId);
    return {
      windows: cityPlans.flatMap(p => (p.status === 'match' && p.start && p.end
        ? [{ start: p.start, end: p.end, active: p.id === activeId }]
        : [])),
      limits: activePlan?.limits,
      dayBadges,
    };
  }, [cityPlans, shownDates, timeZone, activeId, onOpen]);
  const unplaced = cityPlans.filter(p => !p.date || !shownDates.has(p.date));

  if (!city) return null;
  const cityName = cityDisplayName(city);
  const fresh = forecast.state.status === 'ready' && !isExpired(forecast.state.data.fetchedAt, forecast.now)
    ? forecast.state.data
    : null;

  return (
    <>
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
      <PlanTray plans={unplaced} timeZone={city.timeZone} activeId={activeId} onOpen={onOpen} />
      <WeatherWidget
        forecast={forecast.state.status === 'ready' ? forecast.state.data : null}
        timeZone={city.timeZone}
        now={forecast.now}
        selectedDate={widgetDate}
        onSelectDate={setWidgetDate}
        overlay={overlay}
      />
    </>
  );
}

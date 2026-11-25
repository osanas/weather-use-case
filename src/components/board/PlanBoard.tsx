'use client';

import { useEffect, useRef } from 'react';
import { describeWeatherCode, formatHour, formatPercent, formatTemperature } from '@/lib/format';
import { messages as t } from '@/lib/i18n/messages';
import { hoursOfDay, inWindow, localHour, type BoardPlan } from '@/lib/planner/board';
import { datesIn, longDayLabel } from '@/lib/planner/calendar';
import { activityName, relativeDay } from '@/lib/planner/conversation';
import type { DateBounds } from '@/lib/planner/form';
import type { DailySummary, HourlyPoint } from '@/lib/weather/types';
import './board.css';
import { useUnits } from '../Units';

/** Display scale for the wind bars only; it is not a limit or a judgment. */
const WIND_SCALE_KMH = 60;
const HOUR_LABELS = [0, 6, 12, 18];

type Props = {
  cityName: string;
  timeZone: string;
  bounds: DateBounds | null;
  /** The selected city's fresh forecast, or `null` while it is missing or expired. */
  forecast: { hourly: readonly HourlyPoint[]; daily: readonly DailySummary[] } | null;
  /** The selected city's plans, in creation order. */
  plans: readonly BoardPlan[];
  /** The plan being discussed with Pico. */
  activeId: string | null;
  onOpen: (plan: BoardPlan) => void;
};

const failed = (p: BoardPlan) => p.status === 'insufficient' || p.status === 'unavailable' || p.status === 'error';
const pct = (value: number | null, scale = 100) =>
  value === null || !Number.isFinite(value) ? 0 : Math.max(0, Math.min(100, (value / scale) * 100));

/** Visible summary of a plan, from its answers and the planner's outcome only. */
function chipDetail(plan: BoardPlan, timeZone: string): string {
  if (plan.status === 'match' && plan.start && plan.end) return `${formatHour(plan.start, timeZone)} – ${formatHour(plan.end, timeZone)}`;
  if (plan.status === 'no_match') return t.board.status.no_match;
  if (failed(plan)) return t.board.status.failed;
  const hours = plan.durationHours ? `${t.board.hours(plan.durationHours)} · ` : '';
  return hours + (plan.status === 'checking' ? t.board.status.checking : t.board.status.draft);
}

function planLabel(plan: BoardPlan, timeZone: string): string {
  const parts = [activityName(plan.answers), plan.date ? longDayLabel(plan.date) : t.board.unscheduledDay];
  if (plan.durationHours) parts.push(t.duration(plan.durationHours));
  if (plan.status === 'match' && plan.start && plan.end) {
    parts.push(t.board.label.match(formatHour(plan.start, timeZone), formatHour(plan.end, timeZone)));
  } else if (plan.status === 'no_match') parts.push(t.board.label.no_match);
  else if (failed(plan)) parts.push(t.board.label.failed);
  else parts.push(plan.status === 'checking' ? t.board.label.checking : t.board.label.draft);
  return t.board.plan(parts.join(', '));
}

function PlanChip({ plan, timeZone, active, onOpen }: { plan: BoardPlan; timeZone: string; active: boolean; onOpen: (p: BoardPlan) => void }) {
  return (
    <button
      type="button"
      className={`board-plan board-plan-${failed(plan) ? 'failed' : plan.status}`}
      aria-current={active ? 'true' : undefined}
      aria-label={planLabel(plan, timeZone)}
      onClick={() => onOpen(plan)}
    >
      <span className="board-plan-activity">{activityName(plan.answers)}</span>
      <span className="board-plan-detail">{chipDetail(plan, timeZone)}</span>
      {plan.status === 'checking' ? <span className="board-dots" aria-hidden="true"><i /><i /><i /></span> : null}
    </button>
  );
}

/**
 * The planning board under Pico's chat: one column per forecast day with its public summary,
 * an hour track and thin raw bars for rain chance and wind. Plans come from the conversation;
 * a window is drawn exactly as the planner returned it, and the dashed limits are the
 * server's. The bars and track are decorative: the same hours are in the hourly forecast table.
 */
export function PlanBoard({ cityName, timeZone, bounds, forecast, plans, activeId, onOpen }: Props) {
  const scrollerRef = useRef<HTMLOListElement>(null);
  const units = useUnits();
  const dates = bounds ? datesIn(bounds) : forecast?.daily.map(d => d.date) ?? [];
  const active = plans.find(p => p.id === activeId) ?? null;
  const unscheduled = plans.filter(p => !p.date || !dates.includes(p.date));

  // Keep the active plan's day in view inside the board, without scrolling the page.
  const activeDate = active?.date ?? null;
  useEffect(() => {
    const scroller = scrollerRef.current;
    const column = activeDate ? scroller?.querySelector<HTMLElement>(`[data-date="${activeDate}"]`) : null;
    if (!scroller || !column) return;
    const left = column.offsetLeft - scroller.offsetLeft;
    const visible = left >= scroller.scrollLeft && left + column.offsetWidth <= scroller.scrollLeft + scroller.clientWidth;
    if (visible) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    scroller.scrollTo({ left: Math.max(0, left - 8), behavior: reduce ? 'auto' : 'smooth' });
  }, [activeDate]);

  return (
    <section className="card board" aria-labelledby="board-heading">
      <div className="board-head">
        <div>
          <h2 id="board-heading">{t.board.heading}</h2>
          <p className="board-title">{t.board.title(cityName)}</p>
        </div>
        <ul className="board-legend" aria-hidden="true">
          <li><i className="lg-window" />{t.board.legend.window}</li>
          <li><i className="lg-rain" />{t.board.legend.rain}</li>
          <li><i className="lg-wind" />{t.board.legend.wind}</li>
          <li><i className="lg-limit" />{t.board.legend.limit}</li>
        </ul>
      </div>
      <p className="note">{t.board.intro}</p>
      {!forecast ? <p className="note board-unavailable">{t.board.noForecast}</p> : null}

      {unscheduled.length > 0 ? (
        <div className="board-tray">
          <h3>{t.board.unscheduled}</h3>
          <ul>
            {unscheduled.map(p => (
              <li key={p.id}><PlanChip plan={p} timeZone={timeZone} active={p.id === activeId} onOpen={onOpen} /></li>
            ))}
          </ul>
        </div>
      ) : null}

      <ol className="board-days" ref={scrollerRef} aria-label={t.board.days} tabIndex={0}>
        {dates.map(date => {
          const day = forecast?.daily.find(d => d.date === date);
          const hours = forecast ? hoursOfDay(forecast.hourly, date, timeZone) : [];
          const dayPlans = plans.filter(p => p.date === date);
          const windows = dayPlans.filter(p => p.status === 'match' && p.start && p.end);
          const limits = active?.date === date ? active.limits : undefined;
          return (
            <li key={date} className={`board-day${active?.date === date ? ' board-day-active' : ''}`} data-date={date}>
              <h3 className="board-day-name">{relativeDay(date, bounds)}</h3>
              <p className="board-day-weather">
                {day ? (
                  <>
                    {describeWeatherCode(day.weatherCode)} · {formatTemperature(day.maxC, units)} / {formatTemperature(day.minC, units)}
                    {' · '}{t.board.rain(formatPercent(day.precipitationProbability))}
                  </>
                ) : '—'}
              </p>

              <ul className="board-day-plans">
                {dayPlans.length === 0 ? <li className="board-empty">{t.board.noPlans}</li> : null}
                {dayPlans.map(p => (
                  <li key={p.id}><PlanChip plan={p} timeZone={timeZone} active={p.id === activeId} onOpen={onOpen} /></li>
                ))}
              </ul>

              <div className="board-chart" aria-hidden="true">
                <div className="board-track">
                  {hours.map(h => {
                    const on = windows.filter(p => inWindow(h.time, p.start!, p.end!));
                    const isActive = on.some(p => p.id === activeId);
                    return (
                      <span
                        key={h.time}
                        className={on.length ? `on${isActive ? ' active' : ''}` : undefined}
                        style={{ gridColumn: localHour(h.time, timeZone) + 1 }}
                      />
                    );
                  })}
                </div>
                {hours.length > 0 ? (
                  <>
                    <div className="board-bars board-rain">
                      {hours.map(h => (
                        <span key={h.time} style={{ gridColumn: localHour(h.time, timeZone) + 1, height: `${pct(h.precipitationProbability)}%` }} />
                      ))}
                      {limits ? <b className="board-limit" style={{ bottom: `${pct(limits.maxPrecipitationProbability)}%` }} /> : null}
                    </div>
                    <div className="board-bars board-wind">
                      {hours.map(h => (
                        <span key={h.time} style={{ gridColumn: localHour(h.time, timeZone) + 1, height: `${pct(h.windKmh, WIND_SCALE_KMH)}%` }} />
                      ))}
                      {limits ? <b className="board-limit" style={{ bottom: `${pct(limits.maxWindKmh, WIND_SCALE_KMH)}%` }} /> : null}
                    </div>
                  </>
                ) : null}
                <div className="board-scale">
                  {HOUR_LABELS.map(h => <span key={h} style={{ gridColumn: h + 1 }}>{h}</span>)}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

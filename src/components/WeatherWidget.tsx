'use client';

import { memo, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { areaRects, scaleRows, stepSegments } from '@/lib/forecast-chart';
import { localDateString, nextDays, upcomingHours } from '@/lib/forecast';
import {
  describeWeatherCode,
  formatDay,
  formatHour,
  formatPercent,
  formatTemperature,
  formatWind,
  unavailable,
} from '@/lib/format';
import type { Locale, Messages } from '@/lib/i18n';
import type { DailySummary, HourlyPoint, WeatherResponse } from '@/lib/weather/types';
import {
  compactValue,
  hoursOn,
  limitFor,
  maxValue,
  metricDomain,
  metricValues,
  METRICS,
  threeHourMarks,
  weekdayOf,
  windowSpans,
  type HourMark,
  type Metric,
  type PlanLimits,
  type PlanWindow,
} from '@/lib/weather-widget';
import { ICONS, iconForCode } from '@/lib/world/icons';
import { DailyTable, HourlyTable } from './ForecastTables';
import { PixelArt } from './world/PixelArt';
import { useLocale, useMessages } from './Language';
import { useUnits } from './Units';
import { TEMPERATURE_UNIT, WIND_UNIT, type Units } from '@/lib/units';

/** What the planning board (WEA-18) draws on the widget. Drawn as given, never scored here. */
export type WeatherOverlay = {
  windows: PlanWindow[];
  limits?: PlanLimits;
  dayBadges?: Record<string, ReactNode>;
};

type Props = {
  forecast: WeatherResponse | null;
  timeZone: string;
  now: number;
  /** Controlled selected day (YYYY-MM-DD); defaults to today in the city's zone. */
  selectedDate?: string;
  onSelectDate?: (date: string) => void;
  overlay?: WeatherOverlay;
};

const unitLabel = (metric: Metric, units: Units, t: Messages) =>
  metric === 'temperature' ? TEMPERATURE_UNIT[units] : metric === 'wind' ? WIND_UNIT[units] : t.widget.chance;
const fullValue = (metric: Metric, value: number | null, units: Units, locale: Locale) =>
  metric === 'temperature' ? formatTemperature(value, units, locale)
    : metric === 'wind' ? formatWind(value, units, locale) : formatPercent(value, locale);

// Curve grid in chart units: one 12-unit column per hour, values between TOP and BOTTOM.
const COL = 12;
const HEIGHT = 48;
const TOP = 10;
const BOTTOM = 46;
const LINE = 2;

// Every-six-hour marks stay on phones; the others hide there (forecast.css).
const rank = (mark: HourMark) => (mark.hour % 6 === 0 ? 'ww-major' : 'ww-minor');

const at = (x: number, y?: number) => ({ '--x': x, ...(y === undefined ? {} : { '--y': y }) } as CSSProperties);

function Curve({ hours, metric, timeZone, overlay }: {
  hours: HourlyPoint[];
  metric: Metric;
  timeZone: string;
  overlay?: WeatherOverlay;
}) {
  const units = useUnits();
  const locale = useLocale();
  const t = useMessages();
  const values = metricValues(hours, metric);
  const limit = limitFor(metric, overlay?.limits);
  const domain = metricDomain(values, metric, limit);
  const rows = scaleRows(values, domain, TOP, BOTTOM);
  const limitRow = limit === null ? null : scaleRows([limit], domain, TOP, BOTTOM)[0] ?? null;
  const spans = windowSpans(hours, overlay?.windows ?? []);
  const marks = threeHourMarks(hours, timeZone, locale);
  const width = hours.length * COL;
  const columnCentre = (index: number) => (index + 0.5) / hours.length;
  return (
    <div className="ww-curve" data-metric={metric} aria-hidden="true">
      <div className="ww-plot">
        <svg
          className="ww-svg"
          viewBox={`0 0 ${width} ${HEIGHT}`}
          preserveAspectRatio="none"
          shapeRendering="crispEdges"
          focusable="false"
        >
          {spans.map((s, i) => (
            <rect key={`band-${i}`} className={s.active ? 'ww-window ww-window-active' : 'ww-window'}
              x={s.from * COL} y={0} width={(s.to - s.from) * COL} height={HEIGHT} />
          ))}
          <g className="ww-area">
            {areaRects(rows, COL, HEIGHT).map((r, i) => <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} />)}
          </g>
          <g className="ww-line">
            {stepSegments(rows, COL, LINE).map((r, i) => <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} />)}
          </g>
          <rect className="ww-baseline" x={0} y={HEIGHT - 1} width={width} height={1} />
          {limitRow === null ? null : (
            <line className="ww-limit" x1={0} x2={width} y1={limitRow} y2={limitRow} vectorEffect="non-scaling-stroke" />
          )}
          {spans.filter(s => s.active).map((s, i) => (
            <rect key={`outline-${i}`} className="ww-window-outline"
              x={s.from * COL} y={0} width={(s.to - s.from) * COL} height={HEIGHT} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        {marks.map(mark => {
          const row = rows[mark.index];
          if (row === null || row === undefined) return null;
          return (
            <span key={mark.index} className={`ww-value ${rank(mark)}`} style={at(columnCentre(mark.index), row / HEIGHT)}>
              {compactValue(values[mark.index] ?? null, metric, units, locale)}
            </span>
          );
        })}
        {limitRow === null ? null : (
          <span className="ww-limit-label" style={at(1, limitRow / HEIGHT)}>
            {t.widget.limit(compactValue(limit, metric, units, locale) + (metric === 'wind' ? ` ${WIND_UNIT[units]}` : ''))}
          </span>
        )}
      </div>
      <div className="ww-hours">
        {marks.map(mark => (
          <span key={mark.index} className={rank(mark)} style={at(columnCentre(mark.index))}>{mark.label}</span>
        ))}
      </div>
      {spans.length > 0 ? (
        <p className="ww-legend"><span className="ww-key ww-key-window" /> {t.widget.plannedWindow}</p>
      ) : null}
    </div>
  );
}

/** The selected day's values for the chosen tab, for screen readers. */
function CurveTable({ hours, metric, day, timeZone }: { hours: HourlyPoint[]; metric: Metric; day: DailySummary; timeZone: string }) {
  const units = useUnits();
  const locale = useLocale();
  const t = useMessages();
  const values = metricValues(hours, metric);
  return (
    <div className="sr-only">
      <table>
        <caption>{t.widget.tableCaption(t.widget.metric[metric], formatDay(day.date, locale))}</caption>
        <thead>
          <tr>
            <th scope="col">{t.widget.time}</th>
            <th scope="col">{t.widget.metric[metric]}</th>
          </tr>
        </thead>
        <tbody>
          {hours.map((hour, i) => (
            <tr key={hour.time}>
              <th scope="row">{formatHour(hour.time, timeZone, locale)}</th>
              <td>{fullValue(metric, values[i] ?? null, units, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Reading({ text, className }: { text: string; className: string }) {
  const locale = useLocale();
  return <span className={text === unavailable(locale) ? `${className} ww-missing` : className}>{text}</span>;
}

function DayHeader({ day, hours, today }: { day: DailySummary; hours: HourlyPoint[]; today: string }) {
  const units = useUnits();
  const locale = useLocale();
  const t = useMessages();
  const wind = maxValue(hours.map(hour => hour.windKmh));
  return (
    <div className="ww-head">
      <PixelArt grid={ICONS[iconForCode(day.weatherCode)]} className="ww-head-icon" />
      <div className="ww-head-temps">
        <Reading text={formatTemperature(day.maxC, units, locale)} className="ww-high" />
        <span className="ww-low">{t.widget.low} <Reading text={formatTemperature(day.minC, units, locale)} className="ww-low-value" /></span>
      </div>
      <dl className="ww-stats">
        <div><dt>{t.widget.metric.precipitation}</dt><dd>{formatPercent(day.precipitationProbability, locale)}</dd></div>
        <div><dt>{t.widget.metric.wind}</dt><dd>{wind === null ? formatWind(null, units, locale) : t.widget.upTo(formatWind(wind, units, locale))}</dd></div>
      </dl>
      <div className="ww-when">
        <p className="ww-weekday">{day.date === today ? t.common.today : weekdayOf(day.date, 'long', locale)}</p>
        <p>{formatDay(day.date, locale)}</p>
        <p className="ww-conditions">{describeWeatherCode(day.weatherCode, locale)}</p>
      </div>
    </div>
  );
}

function dayLabel(day: DailySummary, today: string, units: Units, locale: Locale, t: Messages): string {
  return t.widget.dayLabel(t.widget.dayName(day.date === today, formatDay(day.date, locale)),
    describeWeatherCode(day.weatherCode, locale), formatTemperature(day.maxC, units, locale),
    formatTemperature(day.minC, units, locale));
}

/**
 * One forecast widget: the selected day's summary, a pixel curve of temperature,
 * precipitation or wind by hour (WAI-ARIA tabs), and a card per forecast day. The upcoming
 * hours and five-day summary are also kept as visually hidden tables (WX-02).
 */
// Memoised: the chat and board re-render the page often while the forecast props stay the same.
export const WeatherWidget = memo(function WeatherWidget({ forecast, timeZone, now, selectedDate, onSelectDate, overlay }: Props) {
  const [ownDate, setOwnDate] = useState<string | null>(null);
  const [metric, setMetric] = useState<Metric>('temperature');
  const units = useUnits();
  const locale = useLocale();
  const t = useMessages();
  const tabs = useRef<Partial<Record<Metric, HTMLButtonElement | null>>>({});
  const id = useId();
  if (!forecast) return null;

  const today = localDateString(now, timeZone);
  const days = nextDays(forecast.daily, timeZone, now, forecast.daily.length);
  const wanted = selectedDate ?? ownDate ?? today;
  const day = days.find(d => d.date === wanted) ?? days[0] ?? null;
  const hours = day ? hoursOn(forecast.hourly, day.date, timeZone) : [];
  const tabId = (m: Metric) => `${id}-tab-${m}`;
  const panelId = `${id}-panel`;

  const select = (date: string) => {
    setOwnDate(date);
    onSelectDate?.(date);
  };

  const onTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const i = METRICS.indexOf(metric);
    const last = METRICS.length - 1;
    const next = { ArrowRight: i === last ? 0 : i + 1, ArrowLeft: i === 0 ? last : i - 1, Home: 0, End: last }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    const target = METRICS[next]!;
    setMetric(target);
    tabs.current[target]?.focus();
  };

  return (
    <section className="card fc ww forecast" aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`}>{t.widget.heading}</h2>
      {day ? <DayHeader day={day} hours={hours} today={today} /> : null}

      <div className="ww-tabs" role="tablist" aria-label={t.widget.chart}>
        {METRICS.map(m => (
          <button
            key={m}
            ref={el => { tabs.current[m] = el; }}
            type="button"
            role="tab"
            id={tabId(m)}
            aria-selected={m === metric}
            aria-controls={panelId}
            tabIndex={m === metric ? 0 : -1}
            className="ww-tab"
            onClick={() => setMetric(m)}
            onKeyDown={onTabKey}
          >
            {t.widget.metric[m]}
          </button>
        ))}
      </div>
      {/* Named "Hourly chart" rather than by its tab, so "Temperature" keeps naming only the current reading (WX-02). */}
      <div className="ww-panel" role="tabpanel" id={panelId} aria-label={t.widget.hourlyChart} tabIndex={0}>
        {day ? (
          <p className="ww-caption" aria-hidden="true">{t.widget.caption(t.widget.metric[metric], unitLabel(metric, units, t), formatDay(day.date, locale))}</p>
        ) : null}
        {day && hours.length > 0 ? (
          <>
            <Curve hours={hours} metric={metric} timeZone={timeZone} overlay={overlay} />
            <CurveTable hours={hours} metric={metric} day={day} timeZone={timeZone} />
          </>
        ) : (
          <p className="ww-empty">{t.widget.noHourly}</p>
        )}
      </div>

      {days.length > 0 ? (
        <ol className="ww-days" aria-label={t.widget.days}>
          {days.map(d => {
            const badge = overlay?.dayBadges?.[d.date];
            return (
              <li key={d.date} className="ww-day-item">
                <button
                  type="button"
                  className="ww-day"
                  aria-pressed={d.date === day?.date}
                  aria-label={dayLabel(d, today, units, locale, t)}
                  onClick={() => select(d.date)}
                >
                  <span className="ww-day-name">{d.date === today ? t.common.today : weekdayOf(d.date, 'short', locale)}</span>
                  <PixelArt grid={ICONS[iconForCode(d.weatherCode)]} className="ww-day-icon" />
                  <span className="ww-day-temps">
                    <strong>{compactValue(d.maxC, 'temperature', units, locale) || '–'}</strong>
                    <span>{compactValue(d.minC, 'temperature', units, locale) || '–'}</span>
                  </span>
                </button>
                {badge === undefined || badge === null || badge === false ? null : <div className="ww-badge">{badge}</div>}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="ww-empty">{t.widget.noDaily}</p>
      )}

      <HourlyTable hours={upcomingHours(forecast.hourly, now)} timeZone={timeZone} />
      <DailyTable days={nextDays(forecast.daily, timeZone, now)} today={today} />
    </section>
  );
});

import { rangeSpan, temperatureDomain, type Domain } from '@/lib/forecast-chart';
import { describeWeatherCode, formatDay, formatPercent, formatTemperature, UNAVAILABLE } from '@/lib/format';
import type { DailySummary } from '@/lib/weather/types';
import { DROP, ICONS, iconForCode } from '@/lib/world/icons';
import { PixelArt } from './world/PixelArt';

// The min–max bar is a row of pixel cells: each cell is 4 units wide with a 1-unit gap.
const CELLS = 12;
const CELL = 4;
const CELL_GAP = 1;
const BAR_HEIGHT = 4;

function RangeBar({ day, domain }: { day: DailySummary; domain: Domain | null }) {
  const span = rangeSpan(day.minC, day.maxC, domain, CELLS);
  return (
    <svg
      className="fc-range"
      viewBox={`0 0 ${CELLS * CELL} ${BAR_HEIGHT}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      {Array.from({ length: CELLS }, (_, i) => {
        const on = span !== null && i >= span.start && i < span.start + span.width;
        return (
          <rect
            key={i}
            className={on ? 'fc-cell-on' : 'fc-cell-off'}
            x={i * CELL}
            y={0}
            width={CELL - CELL_GAP}
            height={BAR_HEIGHT}
          />
        );
      })}
    </svg>
  );
}

// A missing reading still reads "Unavailable", in a smaller size that fits the card.
function Reading({ text, strong = false }: { text: string; strong?: boolean }) {
  if (text === UNAVAILABLE) return <span className="fc-missing">{text}</span>;
  return strong ? <strong>{text}</strong> : <span>{text}</span>;
}

export function DailyForecast({ days, today }: { days: DailySummary[]; today: string }) {
  if (days.length === 0) {
    return <p className="card">No daily forecast is available.</p>;
  }
  const domain = temperatureDomain(days);
  return (
    <section className="card fc" aria-labelledby="daily-heading">
      <h2 id="daily-heading">5-day forecast</h2>
      <div className="fc-scroll" tabIndex={0} role="group" aria-label="5-day forecast cards, scroll sideways">
        <ol className="fc-days" aria-hidden="true">
          {days.map(day => (
            <li key={day.date} className={day.date === today ? 'fc-day fc-day-today' : 'fc-day'}>
              <span className="fc-day-name">
                {day.date === today ? <span className="fc-today">Today</span> : null}
                {formatDay(day.date)}
              </span>
              <PixelArt grid={ICONS[iconForCode(day.weatherCode)]} className="fc-icon fc-icon-lg" />
              <span className="fc-condition">{describeWeatherCode(day.weatherCode)}</span>
              <RangeBar day={day} domain={domain} />
              <span className="fc-range-labels">
                <span><span className="fc-label">Low</span> <Reading text={formatTemperature(day.minC)} /></span>
                <span><span className="fc-label">High</span> <Reading text={formatTemperature(day.maxC)} strong /></span>
              </span>
              <span className="fc-meta">
                <PixelArt grid={DROP} className="fc-glyph fc-glyph-drop" />
                {formatPercent(day.precipitationProbability)}
              </span>
            </li>
          ))}
        </ol>
      </div>
      <div className="fc-sr-only">
        <table>
          <caption>5-day forecast</caption>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col">Conditions</th>
              <th scope="col">Low</th>
              <th scope="col">High</th>
              <th scope="col">Precipitation</th>
            </tr>
          </thead>
          <tbody>
            {days.map(day => (
              <tr key={day.date}>
                <th scope="row">
                  {day.date === today ? `Today, ${formatDay(day.date)}` : formatDay(day.date)}
                </th>
                <td>{describeWeatherCode(day.weatherCode)}</td>
                <td>{formatTemperature(day.minC)}</td>
                <td>{formatTemperature(day.maxC)}</td>
                <td>{formatPercent(day.precipitationProbability)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

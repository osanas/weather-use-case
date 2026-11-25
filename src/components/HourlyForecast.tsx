import type { CSSProperties } from 'react';
import { precipHeights, stepSegments, temperatureRows } from '@/lib/forecast-chart';
import {
  describeWeatherCode,
  formatHour,
  formatPercent,
  formatTemperature,
  formatWind,
  UNAVAILABLE,
} from '@/lib/format';
import type { HourlyPoint } from '@/lib/weather/types';
import { DROP, ICONS, WIND, iconForCode } from '@/lib/world/icons';
import { PixelArt } from './world/PixelArt';

// Chart grid, in units of 0.25rem: one 24-unit column per 6rem tile, so bars and steps
// sit exactly above their tile and pixels stay square.
const COL = 24;
const HEIGHT = 32;
const TEMP_TOP = 3;
const TEMP_BOTTOM = 16;
const LINE = 2;
const BASELINE = 31;
const BAR_MAX = 11;
const BAR_WIDTH = 12;

function HourlyChart({ hours }: { hours: HourlyPoint[] }) {
  const rows = temperatureRows(hours.map(hour => hour.temperatureC), TEMP_TOP, TEMP_BOTTOM);
  const bars = precipHeights(hours.map(hour => hour.precipitationProbability), BAR_MAX);
  const width = hours.length * COL;
  return (
    <svg
      className="fc-chart"
      viewBox={`0 0 ${width} ${HEIGHT}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      <rect className="fc-baseline" x={0} y={BASELINE} width={width} height={1} />
      <g className="fc-precip">
        {bars.map((height, i) => height ? (
          <rect key={i} x={i * COL + (COL - BAR_WIDTH) / 2} y={BASELINE - height} width={BAR_WIDTH} height={height} />
        ) : null)}
      </g>
      <g className="fc-temp">
        {stepSegments(rows, COL, LINE).map((r, i) => (
          <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} />
        ))}
      </g>
    </svg>
  );
}

// A missing reading still reads "Unavailable", in a smaller size that fits the tile.
function TemperatureValue({ text }: { text: string }) {
  return <span className={text === UNAVAILABLE ? 'fc-temp-value fc-missing' : 'fc-temp-value'}>{text}</span>;
}

export function HourlyForecast({ hours, timeZone }: { hours: HourlyPoint[]; timeZone: string }) {
  if (hours.length === 0) {
    return <p className="card">No upcoming hourly forecast is available.</p>;
  }
  return (
    <section className="card fc" aria-labelledby="hourly-heading">
      <h2 id="hourly-heading">Hourly forecast</h2>
      <p className="fc-legend" aria-hidden="true">
        <span className="fc-key fc-key-temp" /> Temperature
        <span className="fc-key fc-key-precip" /> Chance of precipitation
      </p>
      <div className="fc-scroll" tabIndex={0} role="group" aria-label="Hourly forecast chart, scroll sideways">
        <div className="fc-track" style={{ '--cols': hours.length } as CSSProperties} aria-hidden="true">
          <HourlyChart hours={hours} />
          <ol className="fc-tiles">
            {hours.map(hour => (
              <li key={hour.time} className="fc-tile">
                <span className="fc-time">{formatHour(hour.time, timeZone)}</span>
                <span className="fc-icon-wrap" title={describeWeatherCode(hour.weatherCode)}>
                  <PixelArt grid={ICONS[iconForCode(hour.weatherCode)]} className="fc-icon" />
                </span>
                <TemperatureValue text={formatTemperature(hour.temperatureC)} />
                <span className="fc-meta">
                  <PixelArt grid={DROP} className="fc-glyph fc-glyph-drop" />
                  {formatPercent(hour.precipitationProbability)}
                </span>
                <span className="fc-meta">
                  <PixelArt grid={WIND} className="fc-glyph fc-glyph-wind" />
                  {formatWind(hour.windKmh)}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <div className="sr-only">
        <table>
          <caption>Hourly forecast</caption>
          <thead>
            <tr>
              <th scope="col">Time</th>
              <th scope="col">Conditions</th>
              <th scope="col">Temperature</th>
              <th scope="col">Precipitation</th>
              <th scope="col">Wind</th>
            </tr>
          </thead>
          <tbody>
            {hours.map(hour => (
              <tr key={hour.time}>
                <th scope="row">{formatHour(hour.time, timeZone)}</th>
                <td>{describeWeatherCode(hour.weatherCode)}</td>
                <td>{formatTemperature(hour.temperatureC)}</td>
                <td>{formatPercent(hour.precipitationProbability)}</td>
                <td>{formatWind(hour.windKmh)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

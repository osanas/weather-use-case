'use client';

import type { City } from '@/lib/cities';
import { formatDay, formatHour, formatPercent, formatWind } from '@/lib/format';
import type { PlanRequest } from '@/lib/planner/criteria';
import type { PlanCriteria, PlanMode, PlanResponse } from '@/lib/planner/types';

type State =
  | { status: 'loading'; request: PlanRequest }
  | { status: 'done'; request: PlanRequest; data: PlanResponse }
  | { status: 'error'; request: PlanRequest; message: string };

const MODE_LABELS: Record<PlanMode, string> = {
  agent: 'AI-assisted recommendation',
  'rule-based': 'Rule-based recommendation',
};

const hours = (n: number) => `${n} ${n === 1 ? 'hour' : 'hours'}`;

/** Effective constraints from the server response. The thresholds are read-only policy values. */
function Constraints({ criteria }: { criteria: PlanCriteria }) {
  return (
    <>
      <h4>Constraints used</h4>
      <dl className="constraints">
        <dt>Activity</dt><dd className="capitalize">{criteria.activity}</dd>
        <dt>Date</dt><dd>{formatDay(criteria.date)} ({criteria.date})</dd>
        <dt>Duration</dt><dd>{hours(criteria.durationHours)}</dd>
        <dt>Maximum precipitation</dt><dd>{formatPercent(criteria.maxPrecipitationProbability)}</dd>
        <dt>Maximum wind</dt><dd>{formatWind(criteria.maxWindKmh)}</dd>
      </dl>
    </>
  );
}

/** Live region for the planning outcome. Times are shown in the city's IANA zone. */
export function PlanResult({ state, city, cityName, onRetry }: {
  state: State | null;
  city: City;
  cityName: string;
  onRetry: () => void;
}) {
  return (
    <div role="region" aria-label="Planning result" aria-live="polite" className="plan-result">
      {state ? <Content state={state} city={city} cityName={cityName} onRetry={onRetry} /> : null}
    </div>
  );
}

function Content({ state, city, cityName, onRetry }: {
  state: State; city: City; cityName: string; onRetry: () => void;
}) {
  if (state.status === 'loading') {
    return <p id="plan-loading" role="status">Finding the best time in {cityName}…</p>;
  }

  if (state.status === 'error') {
    return (
      <div role="alert" className="error">
        <p>{state.message}</p>
        <button type="button" onClick={onRetry}>Retry</button>
      </div>
    );
  }

  const { data } = state;

  if (data.outcome === 'planning_unavailable') {
    return (
      <>
        <h3>Activity planning is temporarily unavailable</h3>
        <p>
          No time can be recommended right now. The forecast for {cityName} above is still available.
        </p>
      </>
    );
  }

  const { criteria } = data;
  const day = formatDay(criteria.date);
  const mode = <p className="mode">{MODE_LABELS[data.mode]}</p>;

  if (data.outcome === 'match') {
    return (
      <>
        <h3>
          Best time: {day}, {formatHour(data.start, city.timeZone)} to {formatHour(data.end, city.timeZone)}
        </h3>
        {mode}
        <dl>
          <dt>Highest precipitation probability</dt><dd>{formatPercent(data.maxPrecipitationProbability)}</dd>
          <dt>Highest sustained wind</dt><dd>{formatWind(data.maxWindKmh)}</dd>
        </dl>
        <Constraints criteria={criteria} />
        <p className="note">
          Based on the Open-Meteo forecast for {cityName}. Forecast conditions can change, so check again
          before you go.
        </p>
      </>
    );
  }

  if (data.outcome === 'no_match') {
    return (
      <>
        <h3>No time meets these limits</h3>
        {mode}
        <p>
          No {criteria.durationHours}-hour period on {day} in {cityName} stays within the precipitation and
          wind limits for every hour. Try another date or a shorter duration.
        </p>
        <Constraints criteria={criteria} />
      </>
    );
  }

  return (
    <>
      <h3>Forecast insufficient</h3>
      {mode}
      <p>
        {data.reason === 'stale'
          ? 'The forecast is out of date, so a reliable time cannot be recommended.'
          : `The forecast for ${day} in ${cityName} is missing readings, so a reliable time cannot be recommended.`}
      </p>
      <button type="button" onClick={onRetry}>Try again</button>
      <Constraints criteria={criteria} />
    </>
  );
}

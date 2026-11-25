'use client';

import type { ReactNode } from 'react';
import type { City } from '@/lib/cities';
import { formatDay, formatHour, formatPercent, formatWind } from '@/lib/format';
import type { Locale, Messages } from '@/lib/i18n';
import { errorText } from '@/lib/i18n/error-text';
import type { PlanRequest } from '@/lib/planner/criteria';
import { activityLabel, resultDate } from '@/lib/planner/conversation';
import { addCalendarDays } from '@/lib/planner/planner';
import type { PlanCriteria, PlanResponse } from '@/lib/planner/types';
import { useLocale, useMessages } from './Language';
import { useUnits } from './Units';

type State =
  | { status: 'loading'; request: PlanRequest }
  | { status: 'done'; request: PlanRequest; data: PlanResponse }
  | { status: 'error'; request: PlanRequest; message: string; code?: string };

/** The searched period: one day, or the first to the last day of a flexible search. */
function searchedPeriod(criteria: PlanCriteria, locale: Locale, t: Messages): string {
  if (criteria.days <= 1) return `${formatDay(criteria.date, locale)} (${criteria.date})`;
  const last = addCalendarDays(criteria.date, criteria.days - 1);
  return `${t.result.range(formatDay(criteria.date, locale), formatDay(last, locale))} (${t.result.range(criteria.date, last)})`;
}

/** Effective constraints from the server response. The thresholds are read-only policy values. */
function Constraints({ criteria, activityName }: { criteria: PlanCriteria; activityName?: string }) {
  const units = useUnits();
  const locale = useLocale();
  const t = useMessages();
  const profile = activityLabel(criteria.activity, locale);
  return (
    <>
      <h4>{t.result.constraints}</h4>
      <dl className="constraints">
        <dt>{t.result.activity}</dt>
        <dd>{activityName && activityName !== profile ? t.result.profileLimits(activityName, profile) : profile}</dd>
        <dt>{criteria.days > 1 ? t.result.daysSearched : t.result.date}</dt><dd>{searchedPeriod(criteria, locale, t)}</dd>
        <dt>{t.result.duration}</dt><dd>{t.duration(criteria.durationHours)}</dd>
        <dt>{t.result.maxPrecipitation}</dt><dd>{formatPercent(criteria.maxPrecipitationProbability, locale)}</dd>
        <dt>{t.result.maxWind}</dt><dd>{formatWind(criteria.maxWindKmh, units, locale)}</dd>
      </dl>
    </>
  );
}

/** Live region for the planning outcome. Times are shown in the city's IANA zone. */
export function PlanResult({ state, city, cityName, onRetry, compact = false, activityName }: {
  state: State | null;
  city: City;
  cityName: string;
  onRetry: () => void;
  /** Folds the explanation into a Details disclosure (chat bubble); constraints stay visible. */
  compact?: boolean;
  /** The visitor's typed activity name, shown in the browser only. */
  activityName?: string;
}) {
  const t = useMessages();
  return (
    <div role="region" aria-label={t.result.region} aria-live="polite" className="plan-result">
      {state ? <Content state={state} city={city} cityName={cityName} onRetry={onRetry} compact={compact} activityName={activityName} /> : null}
    </div>
  );
}

function Content({ state, city, cityName, onRetry, compact, activityName }: {
  state: State; city: City; cityName: string; onRetry: () => void; compact: boolean; activityName?: string;
}) {
  const units = useUnits();
  const locale = useLocale();
  const t = useMessages();
  const fold = (children: ReactNode) => compact
    ? <details className="plan-details"><summary>{t.result.how}</summary>{children}</details>
    : children;
  if (state.status === 'loading') {
    return <p id="plan-loading" role="status">{t.result.finding(cityName)}</p>;
  }

  if (state.status === 'error') {
    return (
      <div role="alert" className="error">
        <p>{errorText(t, state.code, 'plan')}</p>
        <button type="button" onClick={onRetry}>{t.common.retry}</button>
      </div>
    );
  }

  const { data } = state;

  if (data.outcome === 'planning_unavailable') {
    return (
      <>
        <h3>{t.result.unavailableTitle}</h3>
        <p>{t.result.unavailableText(cityName)}</p>
      </>
    );
  }

  const { criteria } = data;
  const day = formatDay(resultDate(data, city.timeZone), locale);
  const period = criteria.days > 1 ? t.result.nextDays(criteria.days) : day;
  const mode = <p className="mode">{t.result.mode[data.mode]}</p>;

  if (data.outcome === 'match') {
    return (
      <>
        <h3>{t.result.bestTime(day, formatHour(data.start, city.timeZone, locale), formatHour(data.end, city.timeZone, locale))}</h3>
        {mode}
        <dl>
          <dt>{t.result.highestPrecipitation}</dt><dd>{formatPercent(data.maxPrecipitationProbability, locale)}</dd>
          <dt>{t.result.highestWind}</dt><dd>{formatWind(data.maxWindKmh, units, locale)}</dd>
        </dl>
        {fold(<>
        <p className="explanation">
          {/* Server-owned template filled from planner values; model text is never rendered. */}
          {t.result.explanation({
            activity: activityLabel(criteria.activity, locale),
            maxPrecipitation: formatPercent(criteria.maxPrecipitationProbability, locale),
            maxWind: formatWind(criteria.maxWindKmh, units, locale),
            hours: criteria.durationHours,
            precipitation: formatPercent(data.maxPrecipitationProbability, locale),
            wind: formatWind(data.maxWindKmh, units, locale),
          })}
        </p>
        </>)}
        <Constraints criteria={criteria} activityName={activityName} />
        <p className="note">{t.result.basedOn(cityName)}</p>
      </>
    );
  }

  if (data.outcome === 'no_match') {
    return (
      <>
        <h3>{t.result.noMatchTitle}</h3>
        {mode}
        <p>{t.result.noMatchText({ hours: criteria.durationHours, city: cityName, day, days: criteria.days })}</p>
        <Constraints criteria={criteria} activityName={activityName} />
      </>
    );
  }

  return (
    <>
      <h3>{t.result.insufficientTitle}</h3>
      {mode}
      <p>{data.reason === 'stale' ? t.result.stale : t.result.missing(period, cityName)}</p>
      <button type="button" onClick={onRetry}>{t.common.tryAgain}</button>
      <Constraints criteria={criteria} activityName={activityName} />
    </>
  );
}

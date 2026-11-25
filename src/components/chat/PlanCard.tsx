import { describeWeatherCode, formatHour, formatTemperature } from '@/lib/format';
import { relativeDay, resultDate } from '@/lib/planner/conversation';
import type { DateBounds } from '@/lib/planner/form';
import type { PlanResponse } from '@/lib/planner/types';
import type { DailySummary } from '@/lib/weather/types';
import { useUnits } from '../Units';
import { useLocale, useMessages } from '../Language';

type Match = Extract<PlanResponse, { outcome: 'match' }>;

const HOURS = Array.from({ length: 24 }, (_, h) => h);

/** Local hour (0–24) of an instant in the city's zone; midnight at the end counts as 24. */
function localHour(iso: string, timeZone: string, end = false): number {
  const hour = Number(new Intl.DateTimeFormat('en-CA', { hour: 'numeric', hourCycle: 'h23', timeZone }).format(Date.parse(iso)));
  return end && hour === 0 ? 24 : hour;
}

/**
 * The plan as a card in Pico's bubble: the day, its public forecast summary and a 24-hour
 * strip with the planner's window. The window is drawn exactly as the planner returned it;
 * nothing here judges the weather. The result region below states the same in text.
 */
export function PlanCard({ data, name, timeZone, bounds, day }: {
  data: Match;
  /** The activity as the visitor named it. */
  name: string;
  timeZone: string;
  bounds: DateBounds | null;
  day: DailySummary | undefined;
}) {
  const units = useUnits();
  const locale = useLocale();
  const t = useMessages();
  const from = localHour(data.start, timeZone);
  const to = localHour(data.end, timeZone, true);
  return (
    <div className="plan-card" aria-hidden="true">
      <div className="plan-card-head">
        <span className="plan-card-dot" />
        <span className="plan-card-day">{relativeDay(resultDate(data, timeZone), bounds, locale)}</span>
        <span className="plan-card-activity">{name}</span>
        {day ? (
          <span className="plan-card-weather">
            {describeWeatherCode(day.weatherCode, locale)} · {formatTemperature(day.maxC, units, locale)}
          </span>
        ) : null}
      </div>
      <div className="plan-card-window">
        <span>{formatHour(data.start, timeZone, locale)} – {formatHour(data.end, timeZone, locale)}</span>
        <span className="plan-card-label">{t.card.window}</span>
      </div>
      <div className="plan-strip">
        {HOURS.map(h => <span key={h} className={h >= from && h < to ? 'on' : undefined} />)}
      </div>
      <div className="plan-strip-scale"><span>0</span><span>6</span><span>12</span><span>18</span><span>24</span></div>
    </div>
  );
}

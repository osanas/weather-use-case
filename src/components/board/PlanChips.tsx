'use client';

import { formatHour } from '@/lib/format';
import { messages as t } from '@/lib/i18n/messages';
import type { BoardPlan } from '@/lib/planner/board';
import { longDayLabel } from '@/lib/planner/calendar';
import { activityName } from '@/lib/planner/conversation';
import './board.css';

const failed = (p: BoardPlan) => p.status === 'insufficient' || p.status === 'unavailable' || p.status === 'error';

/** "11:00" in the city's zone; the zone name stays in the accessible name. */
const shortHour = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat('en-CA', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }).format(Date.parse(iso));

/** Visible summary of a plan, from its answers and the planner's outcome only. */
function chipDetail(plan: BoardPlan, timeZone: string, short: boolean): string {
  if (plan.status === 'match' && plan.start && plan.end) {
    return short
      ? `${shortHour(plan.start, timeZone)}–${shortHour(plan.end, timeZone)}`
      : `${formatHour(plan.start, timeZone)} – ${formatHour(plan.end, timeZone)}`;
  }
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

type ChipProps = { plan: BoardPlan; timeZone: string; active: boolean; onOpen: (p: BoardPlan) => void; short?: boolean };

/** One plan as a button: selecting it reopens the plan in the chat without sending a request. */
export function PlanChip({ plan, timeZone, active, onOpen, short = false }: ChipProps) {
  return (
    <button
      type="button"
      className={`board-plan board-plan-${failed(plan) ? 'failed' : plan.status}`}
      aria-current={active ? 'true' : undefined}
      aria-label={planLabel(plan, timeZone)}
      onClick={() => onOpen(plan)}
    >
      <span className="board-plan-activity">{activityName(plan.answers)}</span>
      <span className="board-plan-detail">{chipDetail(plan, timeZone, short)}</span>
      {plan.status === 'checking' ? <span className="board-dots" aria-hidden="true"><i /><i /><i /></span> : null}
    </button>
  );
}

/** The plans of one forecast day, shown under its card in the weather widget. */
export function DayPlans({ plans, timeZone, activeId, onOpen }: {
  plans: readonly BoardPlan[]; timeZone: string; activeId: string | null; onOpen: (p: BoardPlan) => void;
}) {
  return (
    <ul className="day-plans" aria-label={t.board.dayPlans}>
      {plans.map(p => (
        <li key={p.id}><PlanChip plan={p} timeZone={timeZone} active={p.id === activeId} onOpen={onOpen} short /></li>
      ))}
    </ul>
  );
}

/**
 * Plans the widget cannot place on a day card: no day chosen yet, a day outside the shown
 * forecast, or no forecast at all. Hidden while there are none.
 */
export function PlanTray({ plans, timeZone, activeId, onOpen }: {
  plans: readonly BoardPlan[]; timeZone: string; activeId: string | null; onOpen: (p: BoardPlan) => void;
}) {
  if (plans.length === 0) return null;
  return (
    <section className="card board-tray" aria-labelledby="plan-tray-heading">
      <h2 id="plan-tray-heading">{t.board.heading}</h2>
      <ul>
        {plans.map(p => (
          <li key={p.id}><PlanChip plan={p} timeZone={timeZone} active={p.id === activeId} onOpen={onOpen} /></li>
        ))}
      </ul>
    </section>
  );
}

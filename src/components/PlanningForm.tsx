'use client';

import { useCallback, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import type { City } from '@/lib/cities';
import { submitPlan } from '@/lib/planner/client';
import {
  EMPTY_FORM, fieldMessage, FORM_FIELDS, planDateBounds, validatePlanForm,
  type FormField, type PlanFormErrors, type PlanFormValues,
} from '@/lib/planner/form';
import { ACTIVITIES, type PlanCriteria, type PlanResponse } from '@/lib/planner/types';
import { PlanResult } from './PlanResult';

const ACTIVITY_LABELS: Record<(typeof ACTIVITIES)[number], string> = {
  hiking: 'Hiking', cycling: 'Cycling', walking: 'Walking',
};

type Request =
  | { status: 'loading'; cityId: string; criteria: PlanCriteria }
  | { status: 'done'; cityId: string; criteria: PlanCriteria; data: PlanResponse }
  | { status: 'error'; cityId: string; criteria: PlanCriteria; message: string };

// Minute-resolution clock for the date bounds. `null` while rendering on the server, so
// the static page never bakes in a build-time date.
const MINUTE_MS = 60_000;
const subscribeMinute = (onChange: () => void) => {
  const id = setInterval(onChange, MINUTE_MS);
  return () => clearInterval(id);
};
const minuteSnapshot = () => Math.floor(Date.now() / MINUTE_MS) * MINUTE_MS;
const serverSnapshot = () => null;

/** Activity planning form and result for the selected catalogue city. */
export function PlanningForm({ city, cityName }: { city: City; cityName: string }) {
  const [values, setValues] = useState<PlanFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<PlanFormErrors>({});
  const [request, setRequest] = useState<Request | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const now = useSyncExternalStore(subscribeMinute, minuteSnapshot, serverSnapshot);
  const bounds = now === null ? null : planDateBounds(now, city.timeZone);

  const send = useCallback(async (criteria: PlanCriteria) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setRequest({ status: 'loading', cityId: criteria.cityId, criteria });
    const result = await submitPlan(criteria, controller.signal);
    if (controller.signal.aborted) return;
    if (result.ok) {
      setRequest({ status: 'done', cityId: criteria.cityId, criteria, data: result.data });
    } else if (result.kind === 'invalid') {
      const serverErrors: PlanFormErrors = {};
      for (const field of result.fields) {
        if ((FORM_FIELDS as readonly string[]).includes(field) || field === 'cityId') {
          serverErrors[field as FormField | 'cityId'] = fieldMessage(field, bounds ?? undefined);
        }
      }
      setErrors(Object.keys(serverErrors).length > 0 ? serverErrors : { form: result.message });
      setRequest(null);
    } else {
      setRequest({ status: 'error', cityId: criteria.cityId, criteria, message: result.message });
    }
  }, [bounds]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const effectiveBounds = bounds ?? planDateBounds(Date.now(), city.timeZone);
    const validation = validatePlanForm(values, city.id, effectiveBounds);
    if (!validation.ok) {
      setErrors(validation.errors);
      const first = FORM_FIELDS.find(field => validation.errors[field]);
      if (first) document.getElementById(`plan-${first}`)?.focus();
      return;
    }
    setErrors({});
    void send(validation.criteria);
  };

  const update = (field: FormField) => (event: { target: { value: string } }) =>
    setValues(v => ({ ...v, [field]: event.target.value }));

  const fieldProps = (field: FormField) => ({
    id: `plan-${field}`,
    name: field,
    value: values[field],
    onChange: update(field),
    'aria-invalid': errors[field] ? true : undefined,
    'aria-describedby': errors[field] ? `plan-${field}-error` : undefined,
  });

  const fieldError = (field: FormField) => errors[field]
    ? <p id={`plan-${field}-error`} className="field-error">{errors[field]}</p>
    : null;

  // A result for a previously selected city is never shown for the current one.
  const current = request && request.cityId === city.id ? request : null;
  const loading = current?.status === 'loading';

  return (
    <section className="card planner" aria-labelledby="planner-heading">
      <h2 id="planner-heading">Plan an activity</h2>
      <p className="note">Find the best time in {cityName} for the limits you choose.</p>
      <form noValidate onSubmit={onSubmit}>
        {errors.cityId || errors.form
          ? <p className="field-error" role="alert">{errors.cityId ?? errors.form}</p>
          : null}
        <div className="field">
          <label htmlFor="plan-activity">Activity</label>
          <select {...fieldProps('activity')} required>
            <option value="">Choose an activity</option>
            {ACTIVITIES.map(a => <option key={a} value={a}>{ACTIVITY_LABELS[a]}</option>)}
          </select>
          {fieldError('activity')}
        </div>
        <div className="field">
          <label htmlFor="plan-date">Date</label>
          <input {...fieldProps('date')} type="date" required min={bounds?.min} max={bounds?.max} />
          {fieldError('date')}
        </div>
        <div className="field">
          <label htmlFor="plan-durationHours">Duration (hours)</label>
          <input {...fieldProps('durationHours')} type="number" inputMode="numeric" required min={1} max={4} step={1} />
          {fieldError('durationHours')}
        </div>
        <div className="field">
          <label htmlFor="plan-maxPrecipitationProbability">Maximum precipitation (%)</label>
          <input
            {...fieldProps('maxPrecipitationProbability')}
            type="number" inputMode="decimal" required min={0} max={100} step="any"
          />
          {fieldError('maxPrecipitationProbability')}
        </div>
        <div className="field">
          <label htmlFor="plan-maxWindKmh">Maximum wind (km/h)</label>
          <input {...fieldProps('maxWindKmh')} type="number" inputMode="decimal" required min={0} step="any" />
          {fieldError('maxWindKmh')}
        </div>
        {/* Kept enabled while loading so keyboard focus stays put; a new request replaces the old one. */}
        <button type="submit" aria-describedby={loading ? 'plan-loading' : undefined}>Find best time</button>
      </form>
      <PlanResult
        state={current}
        city={city}
        cityName={cityName}
        onRetry={() => { if (current) void send(current.criteria); }}
      />
    </section>
  );
}

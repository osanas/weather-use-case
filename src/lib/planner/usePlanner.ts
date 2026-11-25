'use client';

import { useCallback, useRef, useState, useSyncExternalStore } from 'react';
import type { City } from '@/lib/cities';
import { submitPlan } from './client';
import type { PlanRequest } from './criteria';
import {
  fieldMessage, FORM_FIELDS, planDateBounds, validatePlanForm,
  type FormField, type PlanFormErrors, type PlanFormValues,
} from './form';
import type { PlanResponse } from './types';

export type PlannerRequest =
  | { status: 'loading'; cityId: string; request: PlanRequest }
  | { status: 'done'; cityId: string; request: PlanRequest; data: PlanResponse }
  | { status: 'error'; cityId: string; request: PlanRequest; message: string; code?: string };

// Minute-resolution clock for the date bounds. `null` while rendering on the server, so
// the static page never bakes in a build-time date.
const MINUTE_MS = 60_000;
const subscribeMinute = (onChange: () => void) => {
  const id = setInterval(onChange, MINUTE_MS);
  return () => clearInterval(id);
};
const minuteSnapshot = () => Math.floor(Date.now() / MINUTE_MS) * MINUTE_MS;
const serverSnapshot = () => null;

/** The plannable dates for a city, or `null` until the browser clock is known. */
export function useDateBounds(timeZone: string) {
  const now = useSyncExternalStore(subscribeMinute, minuteSnapshot, serverSnapshot);
  return now === null ? null : planDateBounds(now, timeZone);
}

/**
 * Planning state for the selected city: validation, the single in-flight request and its
 * result. The same client validation and `/api/plan` request as the former form; a newer
 * request aborts the previous one, and a result for another city is never returned.
 */
export function usePlanner(city: City) {
  const [errors, setErrors] = useState<PlanFormErrors>({});
  const [request, setRequest] = useState<PlannerRequest | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const bounds = useDateBounds(city.timeZone);

  const send = useCallback(async (planRequest: PlanRequest) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const { cityId } = planRequest;
    setRequest({ status: 'loading', cityId, request: planRequest });
    const result = await submitPlan(planRequest, controller.signal);
    if (controller.signal.aborted) return;
    if (result.ok) {
      setRequest({ status: 'done', cityId, request: planRequest, data: result.data });
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
      setRequest({ status: 'error', cityId, request: planRequest, message: result.message, code: result.code });
    }
  }, [bounds]);

  /**
   * Validates the values and sends them. `target` is the city the visitor just chose when it
   * differs from the one this render knows; `days` is how many local days to search from the
   * date (3 for "I'm flexible"). Returns whether a request was sent.
   */
  const submit = useCallback((values: PlanFormValues, target: City = city, days = 1): boolean => {
    const effectiveBounds = target === city && bounds ? bounds : planDateBounds(Date.now(), target.timeZone);
    const validation = validatePlanForm(values, target.id, effectiveBounds, days);
    if (!validation.ok) {
      setErrors(validation.errors);
      return false;
    }
    setErrors({});
    void send(validation.request);
    return true;
  }, [bounds, city, send]);

  const retry = useCallback(() => {
    if (request && request.cityId === city.id) void send(request.request);
  }, [request, city.id, send]);

  // A result for a previously selected city is never shown for the current one.
  const current = request && request.cityId === city.id ? request : null;
  return { errors, setErrors, request: current, bounds, submit, retry };
}

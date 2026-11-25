'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { cityDisplayName, type City } from '@/lib/cities';
import { messages as t } from '@/lib/i18n/messages';
import {
  activityLabel, answersToValues, chatView, clearAnswer, isComplete, NO_ANSWERS,
  type Answers, type Choice, type TurnKey,
} from '@/lib/planner/conversation';
import { boardId, conversationIdOf, planFromChat, type BoardPlan } from '@/lib/planner/board';
import { usePlanner } from '@/lib/planner/usePlanner';
import { ACTIVITIES } from '@/lib/planner/types';
import type { DailySummary } from '@/lib/weather/types';
import { CitySelector } from '../CitySelector';
import { Companion } from '../Companion';
import { PlanResult } from '../PlanResult';
import { PixelArt } from '../world/PixelArt';
import { VISITOR } from '@/lib/world/avatar';
import { DatePicker } from './DatePicker';
import { PlanCard } from './PlanCard';

let conversations = 0;
/** A new conversation id: one per plan, kept while its answers are edited. */
const newConversation = () => `plan-${++conversations}`;

/** Cities offered as quick choices besides the selected one. */
const FEATURED = ['montreal-qc', 'laval-qc', 'quebec-qc'];

type Props = {
  city: City;
  cities: readonly City[];
  onSelectCity: (cityId: string) => void;
  /** Daily forecast for the selected city, or `null` while missing or expired. */
  days: readonly DailySummary[] | null;
  /** Receives the conversation's plan for the board on every change; `null` before an activity. */
  onPlanChange: (conversationId: string, plan: BoardPlan | null) => void;
  /** A board plan to open again; the city is already selected. A new `seq` reopens it. */
  reopen: { plan: BoardPlan; seq: number } | null;
};

/**
 * Pico's planning conversation. Pico asks for the activity, the city, the day and the
 * duration; each answer is a badge or a structured input (select, date picker, hour
 * stepper), never free text. The last answer sends one request to `/api/plan` with the same
 * validation as before, and the planner's result is shown in Pico's bubble.
 */
export function PlanningChat({ city, cities, onSelectCity, days, onPlanChange, reopen }: Props) {
  const cityName = cityDisplayName(city);
  const planner = usePlanner(city);
  const [answers, setAnswers] = useState<Answers>(NO_ANSWERS);
  const [typing, setTyping] = useState<'activity' | 'city' | 'duration' | null>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const currentRef = useRef<HTMLDivElement>(null);
  const focusNext = useRef(false);
  const ids = useId();
  const [conversationId, setConversationId] = useState(newConversation);
  const [reopened, setReopened] = useState(0);

  // Opening a plan from the board restores its conversation and answers. Nothing is sent:
  // Pico asks whether to check again, so each plan still costs one request.
  if (reopen && reopen.seq !== reopened) {
    setReopened(reopen.seq);
    setConversationId(conversationIdOf(reopen.plan.id));
    setAnswers({ ...reopen.plan.answers, city: true });
    setTyping(null);
    planner.setErrors({});
  }

  const cityChoices = [city.id, ...FEATURED.filter(id => id !== city.id)].slice(0, 3).flatMap(id => {
    const c = cities.find(x => x.id === id);
    return c ? [{ id: c.id, label: c.label }] : [];
  });

  const view = chatView({
    answers, cityName, cityChoices, bounds: planner.bounds, days, errors: planner.errors, request: planner.request,
  });

  // The board follows the conversation: draft, day, then the planner's outcome.
  const boardPlan = planFromChat(boardId(conversationId, city.id), city.id, answers, planner.request);
  const boardKey = JSON.stringify(boardPlan);
  useEffect(() => {
    onPlanChange(conversationId, boardKey === 'null' ? null : (JSON.parse(boardKey) as BoardPlan));
  }, [conversationId, boardKey, onPlanChange]);

  useEffect(() => {
    if (reopened) composerRef.current?.querySelector<HTMLElement>('button')?.focus();
  }, [reopened]);

  // After an answer, focus the next choice so the conversation can continue from the
  // keyboard; while Pico is checking, focus his bubble so the result is read next.
  useEffect(() => {
    if (!focusNext.current) return;
    focusNext.current = false;
    const composer = composerRef.current;
    const target = composer?.querySelector<HTMLElement>('.composer-input input, .composer-input select')
      ?? composer?.querySelector<HTMLElement>('button, select, input')
      ?? currentRef.current;
    target?.focus();
  });

  function answer(next: Answers, target: City = city, submit = false) {
    planner.setErrors({});
    setAnswers(next);
    setTyping(null);
    focusNext.current = true;
    // Send once the last missing answer arrives, or after fixing a rejected one.
    const fixing = Object.keys(planner.errors).length > 0;
    if (submit || (isComplete(next) && (!isComplete(answers) || fixing))) planner.submit(answersToValues(next), target);
  }

  function choose(choice: Choice) {
    if (choice.opens === 'city') {
      setTyping('city');
      focusNext.current = true;
      return;
    }
    if (choice.id === 'next-another') setConversationId(newConversation());
    let target = city;
    if (choice.cityId && choice.cityId !== city.id) {
      target = cities.find(c => c.id === choice.cityId) ?? city;
      onSelectCity(target.id);
    }
    answer({ ...answers, ...choice.answer }, target, choice.submit);
  }

  function edit(key: TurnKey) {
    planner.setErrors({});
    setAnswers(clearAnswer(answers, key));
    setTyping(null);
    focusNext.current = true;
  }

  const result = view.step === 'result' || view.step === 'checking' || view.step === 'error';
  const match = planner.request?.status === 'done' && planner.request.data.outcome === 'match' ? planner.request.data : null;

  return (
    <section
      className="card planner chat"
      aria-labelledby="planner-heading"
      // Set once the client clock is known, which also means the chat is interactive.
      data-ready={planner.bounds ? 'true' : undefined}
    >
      <h2 id="planner-heading">{t.chat.heading}</h2>
      <p className="note">{t.chat.intro(cityName)}</p>
      <div className="chat-stage">
        <div className="chat-hero" aria-hidden="true">
          <Companion mood={view.mood} />
        </div>
        <div className="chat-main">
          <ol className="chat-log" aria-label={t.chat.conversation}>
            {view.turns.flatMap(turn => [
              <li key={`${turn.key}-q`} className="msg msg-pico">
                <Companion mood="hello" variant="avatar" still />
                <p className="bubble">{turn.question}</p>
              </li>,
              <li key={`${turn.key}-a`} className="msg msg-user">
                <p className="bubble"><span className="sr-only">{t.chat.you}: </span>{turn.answer}</p>
                <button type="button" className="msg-edit" aria-label={t.chat.editAnswer(turn.answer)} onClick={() => edit(turn.key)}>
                  {t.chat.edit}
                </button>
                <PixelArt grid={VISITOR} className="visitor" />
              </li>,
            ])}
            <li className="msg msg-pico msg-current" data-step={view.step}>
              <Companion mood={view.mood} variant="avatar" />
              <div className="bubble" ref={currentRef} tabIndex={-1}>
                <p className="guide-bubble" aria-live={view.announce ? 'polite' : 'off'} aria-atomic="true">
                  {view.prompt}
                </p>
                {view.step === 'checking' ? <span className="typing" aria-hidden="true"><i /><i /><i /></span> : null}
                {match ? (
                  <PlanCard data={match} timeZone={city.timeZone} bounds={planner.bounds} day={days?.find(d => d.date === match.criteria.date)} />
                ) : null}
                <PlanResult
                  state={result ? planner.request : null}
                  city={city}
                  cityName={cityName}
                  onRetry={planner.retry}
                  compact
                />
              </div>
            </li>
          </ol>

          <div className="composer" ref={composerRef} role="group" aria-label={t.chat.answers}>
            {view.choices.length > 0 ? (
              <div className="quick-replies">
                {view.choices.map(choice => (
                  <button key={choice.id} type="button" className={choice.detail ? 'quick-reply day-choice' : 'quick-reply'} onClick={() => choose(choice)}>
                    <span>{choice.label}</span>
                    {choice.detail ? <small>{choice.detail}</small> : null}
                  </button>
                ))}
                {view.input === 'date' && planner.bounds ? (
                  <DatePicker
                    bounds={planner.bounds}
                    value={answers.date}
                    onPick={date => answer({ ...answers, when: answers.when && answers.when !== 'pick' && view.step === 'day' ? answers.when : 'pick', date })}
                  />
                ) : null}
              </div>
            ) : null}

            {typing === 'city' ? (
              <div className="composer-input">
                <CitySelector
                  cities={cities}
                  selectedId=""
                  label={t.city.other}
                  onSelect={id => {
                    const target = cities.find(c => c.id === id) ?? city;
                    if (target.id !== city.id) onSelectCity(target.id);
                    answer({ ...answers, city: true }, target);
                  }}
                />
              </div>
            ) : null}

            {view.input === 'activity' || view.input === 'duration' ? (
              typing === view.input ? (
                <StructuredInput
                  kind={view.input}
                  id={ids}
                  initial={view.input === 'activity' ? answers.activity : answers.duration}
                  onDone={value => answer(view.input === 'activity' ? { ...answers, activity: value } : { ...answers, duration: value })}
                  onCancel={() => { setTyping(null); focusNext.current = true; }}
                />
              ) : (
                <button type="button" className="link-button" onClick={() => { setTyping(view.input as 'activity' | 'duration'); focusNext.current = true; }}>
                  {t.chat.typeInstead}
                </button>
              )
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

/** The structured alternative to the badges: a pixel select or a 1–4 hour stepper. */
function StructuredInput({ kind, id, initial, onDone, onCancel }: {
  kind: 'activity' | 'duration';
  id: string;
  initial: string;
  onDone: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial || (kind === 'duration' ? '1' : ''));
  const inputId = `${id}-${kind}`;
  const hours = Number(value);
  const step = (delta: number) => setValue(String(Math.min(4, Math.max(1, (Number.isFinite(hours) ? hours : 1) + delta))));
  return (
    <form className="composer-input" noValidate onSubmit={event => { event.preventDefault(); if (value.trim()) onDone(value.trim()); }}>
      {kind === 'activity' ? (
        <>
          <label htmlFor={inputId}>{t.activityInput.label}</label>
          <select id={inputId} value={value} onChange={event => setValue(event.target.value)}>
            <option value="">{t.activityInput.placeholder}</option>
            {ACTIVITIES.map(a => <option key={a} value={a}>{activityLabel(a)}</option>)}
          </select>
        </>
      ) : (
        <>
          <label htmlFor={inputId}>{t.durationInput.label}</label>
          <div className="stepper">
            <button type="button" aria-label={t.durationInput.less} onClick={() => step(-1)} disabled={hours <= 1}>−</button>
            <input id={inputId} type="number" inputMode="numeric" min={1} max={4} step={1} value={value}
              onChange={event => setValue(event.target.value)} />
            <button type="button" aria-label={t.durationInput.more} onClick={() => step(1)} disabled={hours >= 4}>+</button>
          </div>
        </>
      )}
      <div className="composer-actions">
        <button type="submit" disabled={!value.trim()}>{t.chat.confirm}</button>
        <button type="button" className="link-button" onClick={onCancel}>{t.chat.useChoices}</button>
      </div>
    </form>
  );
}

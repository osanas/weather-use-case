'use client';

import { useEffect, useRef } from 'react';

export type ParticleKind = 'rain' | 'storm' | 'snow';

/** Canvas pixels per CSS pixel: particles are drawn low-res and scaled up crisply. */
const PIXEL = 3;
const MAX_PARTICLES = 180;

type Drop = { x: number; y: number; len: number; speed: number; phase: number };

function spawn(kind: ParticleKind, w: number, h: number, anywhere: boolean): Drop {
  const snow = kind === 'snow';
  return {
    x: Math.random() * (w + 20) - 10,
    y: anywhere ? Math.random() * h : -Math.random() * 20,
    len: snow ? (Math.random() < 0.25 ? 2 : 1) : 3 + Math.floor(Math.random() * 3),
    // Art pixels per second.
    speed: snow ? 8 + Math.random() * 10 : (kind === 'storm' ? 150 : 110) + Math.random() * 50,
    phase: Math.random() * Math.PI * 2,
  };
}

/**
 * Rain or snow on a low-resolution canvas. Stops when the tab is hidden, and draws one
 * still frame when reduced motion is requested. `data-animating` reports the state.
 */
export function Particles({ kind }: { kind: ParticleKind | null }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    // The state is written to the DOM directly: it describes the canvas, not React output.
    const setAnimating = (on: boolean) => { canvas.dataset.animating = String(on); };
    if (!kind) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setAnimating(false);
      return;
    }

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let drops: Drop[] = [];
    let frame = 0;
    let last = 0;
    let color = '#a8d8ff';

    const resize = () => {
      const w = Math.max(1, Math.floor(canvas.clientWidth / PIXEL));
      const h = Math.max(1, Math.floor(canvas.clientHeight / PIXEL));
      canvas.width = w;
      canvas.height = h;
      const density = kind === 'snow' ? 1 / 90 : kind === 'storm' ? 1 / 45 : 1 / 70;
      const count = Math.min(MAX_PARTICLES, Math.round(w * h * density / 10));
      drops = Array.from({ length: count }, () => spawn(kind, w, h, true));
      color = getComputedStyle(canvas).getPropertyValue(kind === 'snow' ? '--px-snowflake' : '--px-raindrop').trim()
        || color;
    };

    const draw = (t: number) => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = color;
      for (const d of drops) {
        if (kind === 'snow') {
          const x = Math.round(d.x + Math.sin(t / 1000 + d.phase) * 2);
          ctx.fillRect(x, Math.round(d.y), d.len, d.len);
        } else {
          ctx.fillRect(Math.round(d.x), Math.round(d.y), 1, d.len);
        }
      }
    };

    const step = (t: number) => {
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0;
      last = t;
      const w = canvas.width;
      const h = canvas.height;
      for (let i = 0; i < drops.length; i++) {
        const d = drops[i]!;
        d.y += d.speed * dt;
        if (kind !== 'snow') d.x -= d.speed * dt * 0.12;
        if (d.y > h || d.x < -10) drops[i] = spawn(kind, w, h, false);
      }
      draw(t);
      frame = requestAnimationFrame(step);
    };

    const start = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
      const run = !reduced.matches && document.visibilityState === 'visible';
      setAnimating(run);
      if (run) frame = requestAnimationFrame(step);
      else draw(0);
    };

    const observer = new ResizeObserver(() => { resize(); if (!frame) draw(0); });
    observer.observe(canvas);
    resize();
    start();
    reduced.addEventListener('change', start);
    document.addEventListener('visibilitychange', start);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      reduced.removeEventListener('change', start);
      document.removeEventListener('visibilitychange', start);
    };
  }, [kind]);

  return <canvas ref={ref} className="particles" data-kind={kind ?? 'none'} data-animating="false" />;
}

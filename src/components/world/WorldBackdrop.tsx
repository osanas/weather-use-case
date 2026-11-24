'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import type { Scene } from '@/lib/world/scene';
import { Particles } from './Particles';

/**
 * Decorative pixel-art Montréal. Hidden from assistive technology: the live label in the
 * header states the conditions in text. All motion stops when reduced motion is requested.
 */
export function WorldBackdrop({ scene, scenery }: { scene: Scene | null; scenery: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  // Light parallax: nearer layers move slightly faster than farther ones while scrolling.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    const update = () => {
      frame = 0;
      el.style.setProperty('--scroll', reduced.matches ? '0' : String(Math.min(window.scrollY, 1200)));
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    window.addEventListener('scroll', onScroll, { passive: true });
    reduced.addEventListener('change', update);
    update();
    return () => {
      window.removeEventListener('scroll', onScroll);
      reduced.removeEventListener('change', update);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const particles = scene?.sky === 'rain' ? 'rain' : scene?.sky === 'storm' ? 'storm' : scene?.sky === 'snow' ? 'snow' : null;

  return (
    <div ref={ref} className="backdrop" aria-hidden="true">
      {scenery}
      <Particles kind={particles} />
    </div>
  );
}

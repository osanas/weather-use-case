import type { CSSProperties } from 'react';
import { PUDDLES, skyline, SKYLINE_HEIGHT, SKYLINE_WIDTH, type SkylineLayer } from '@/lib/world/skyline';
import { CLOUD_LARGE, CLOUD_SMALL, MOON, STARS, STAR_FIELD, SUN } from '@/lib/world/sprites';
import { PixelArt, PixelRuns } from './PixelArt';

/*
 * The static art of the backdrop, rendered on the server: the skyline code never ships to
 * the browser and its markup is not hydrated node by node. Which parts show, and in what
 * colours, is decided by CSS from the scene attributes on `.world`.
 */

type CloudSpec = { size: 'large' | 'small'; top: number; x: number; duration: number; rank: number };

// `rank` decides which clouds a sky shows: clear skies show the first two, overcast all.
const CLOUDS: readonly CloudSpec[] = [
  { size: 'large', top: 10, x: 12, duration: 160, rank: 1 },
  { size: 'small', top: 22, x: 64, duration: 120, rank: 2 },
  { size: 'large', top: 5, x: 78, duration: 190, rank: 3 },
  { size: 'small', top: 30, x: 36, duration: 140, rank: 4 },
  { size: 'large', top: 18, x: 48, duration: 175, rank: 5 },
  { size: 'small', top: 8, x: 92, duration: 130, rank: 6 },
  { size: 'large', top: 26, x: 2, duration: 200, rank: 7 },
];

function SkylineSvg({ layer, className, ripples = false }: { layer: SkylineLayer; className: string; ripples?: boolean }) {
  return (
    <svg
      className={className}
      viewBox={`0 0 ${SKYLINE_WIDTH} ${SKYLINE_HEIGHT}`}
      preserveAspectRatio="xMidYMax slice"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      <PixelRuns grid={layer.base} />
      <PixelRuns grid={layer.snow} className="snowcaps" />
      <PixelRuns grid={layer.wet} className="wet" />
      {ripples ? (
        <g className="ripples">
          {PUDDLES.map((p, i) => (
            <rect key={p.x} className="px-ripple" x={p.x - 2} y={p.y} width={4} height={1}
              style={{ animationDelay: `${(i * 0.37) % 1.6}s` } as CSSProperties} />
          ))}
        </g>
      ) : null}
    </svg>
  );
}

export function Scenery() {
  const { far, mid, near } = skyline();
  return (
    <>
      <div className="sky" />
      <svg className="stars" viewBox={`0 0 ${STAR_FIELD.width} ${STAR_FIELD.height}`}
        preserveAspectRatio="xMidYMin slice" shapeRendering="crispEdges" aria-hidden="true" focusable="false">
        {STARS.map(s => s.big ? (
          <g key={`${s.x}-${s.y}`} className={`star twinkle-${s.twinkle}`}>
            <rect x={s.x} y={s.y - 1} width={1} height={3} />
            <rect x={s.x - 1} y={s.y} width={3} height={1} />
          </g>
        ) : (
          <rect key={`${s.x}-${s.y}`} className={`star twinkle-${s.twinkle}`} x={s.x} y={s.y} width={1} height={1} />
        ))}
      </svg>
      <div className="celestial sun"><PixelArt grid={SUN} /></div>
      <div className="celestial moon"><PixelArt grid={MOON} /></div>
      <div className="clouds">
        {CLOUDS.map(c => (
          <div
            key={c.rank}
            className={`cloud cloud-${c.size}`}
            data-rank={c.rank}
            style={{
              '--cloud-top': `${c.top}%`,
              '--cloud-x': `${c.x}vw`,
              '--cloud-duration': `${c.duration}s`,
              // Negative delays spread the clouds along their path from the first frame.
              '--cloud-delay': `${-((c.x + 30) / 140) * c.duration}s`,
            } as CSSProperties}
          >
            <PixelArt grid={c.size === 'large' ? CLOUD_LARGE : CLOUD_SMALL} />
          </div>
        ))}
      </div>
      <div className="skyline">
        <SkylineSvg layer={far} className="layer layer-far" />
        <SkylineSvg layer={mid} className="layer layer-mid" />
        <SkylineSvg layer={near} className="layer layer-near" ripples />
      </div>
      <div className="fog-bands"><span /><span /><span /></div>
      <div className="flash" />
    </>
  );
}

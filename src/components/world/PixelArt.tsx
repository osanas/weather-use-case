import { gridMarkup, gridWidth, type Grid } from '@/lib/world/pixels';

const markupCache = new WeakMap<Grid, string>();

function markupFor(grid: Grid): string {
  let markup = markupCache.get(grid);
  if (markup === undefined) {
    markup = gridMarkup(grid);
    markupCache.set(grid, markup);
  }
  return markup;
}

/**
 * Runs of a static pixel grid as an SVG group. Each rect gets the class `px-<name>`, so the
 * scene's CSS tokens decide the colours. The markup is generated from our own art (see
 * `gridMarkup`) and inserted as-is, so React skips it during hydration.
 */
export function PixelRuns({ grid, className }: { grid: Grid; className?: string }) {
  return <g className={className} dangerouslySetInnerHTML={{ __html: markupFor(grid) }} />;
}

/** A decorative pixel sprite as a crisp SVG. */
export function PixelArt({ grid, className }: { grid: Grid; className?: string }) {
  const width = gridWidth(grid);
  return (
    <svg
      className={className}
      viewBox={`0 0 ${width} ${grid.length}`}
      width={width}
      height={grid.length}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
    >
      <PixelRuns grid={grid} />
    </svg>
  );
}

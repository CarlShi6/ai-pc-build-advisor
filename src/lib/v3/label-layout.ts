/** Screen-space placement of the scene's label cards, kept pure so it can be tested without a DOM. */

/** Gap kept between label cards, in pixels. */
const LABEL_GAP = 6;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const overlaps = (a: Rect, b: Rect, gap: number) =>
  Math.abs(a.x - b.x) < (a.w + b.w) / 2 + gap && Math.abs(a.y - b.y) < (a.h + b.h) / 2 + gap;

/** Moves a card off an obstacle by the shorter way, up or down. */
function clearOf(label: Rect, obstacle: Rect) {
  const reach = (label.h + obstacle.h) / 2 + LABEL_GAP;
  const up = obstacle.y - reach;
  const down = obstacle.y + reach;
  label.y = Math.abs(label.y - up) <= Math.abs(label.y - down) ? up : down;
}

/**
 * Label cards never overlap each other and keep clear of `obstacles` (fixed spots such as other
 * parts' on-screen centres, so a card never sits where its neighbour is pointed at). Top to
 * bottom, a card that would cover one above it moves just below it; if that runs off the bottom,
 * the column is pushed back up. Cards are centred on (x, y).
 */
export function separated<T extends Rect>(
  labels: T[],
  height: number,
  obstacles: Rect[] = [],
): T[] {
  const sorted = [...labels].sort((a, b) => a.y - b.y);
  const overlapsX = (a: T, b: T) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 + LABEL_GAP;
  for (let round = 0; round < 3; round += 1) {
    for (const label of sorted)
      for (const obstacle of obstacles)
        if (overlaps(label, obstacle, LABEL_GAP)) clearOf(label, obstacle);
    sorted.sort((a, b) => a.y - b.y);
    for (const [index, label] of sorted.entries()) {
      label.y = Math.max(label.y, label.h / 2 + 4);
      for (const above of sorted.slice(0, index))
        if (overlapsX(label, above))
          label.y = Math.max(label.y, above.y + (above.h + label.h) / 2 + LABEL_GAP);
    }
    for (const [index, label] of [...sorted.entries()].reverse()) {
      label.y = Math.min(label.y, height - label.h / 2 - 4);
      for (const below of sorted.slice(index + 1))
        if (overlapsX(label, below))
          label.y = Math.min(label.y, below.y - (below.h + label.h) / 2 - LABEL_GAP);
    }
    const clear = sorted.every((label) =>
      obstacles.every((obstacle) => !overlaps(label, obstacle, 0)),
    );
    if (clear) break;
  }
  return sorted;
}

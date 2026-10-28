/** Screen-space placement of the scene's label cards, kept pure so it can be tested without a DOM. */
/** Gap kept between label cards, in pixels. */
const LABEL_GAP = 6;

/**
 * Label cards never overlap: top to bottom, a card that would cover one above it moves down just
 * below it; if that runs off the bottom, the column is pushed back up. Cards are centred on (x, y).
 */
export function separated<T extends { x: number; y: number; w: number; h: number }>(
  labels: T[],
  height: number,
): T[] {
  const sorted = [...labels].sort((a, b) => a.y - b.y);
  const overlapsX = (a: T, b: T) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 + LABEL_GAP;
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
  return sorted;
}

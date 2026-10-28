import { describe, expect, it } from "vitest";
import { separated } from "@/lib/v3/label-layout";

type Card = { id: string; x: number; y: number; w: number; h: number };
const overlap = (a: Card, b: Card) =>
  Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2;

describe("label cards", () => {
  it("never overlap, even when every card wants the same spot", () => {
    const cards: Card[] = Array.from({ length: 8 }, (_, index) => ({
      id: String(index),
      x: 400 + (index % 2) * 30,
      y: 300,
      w: 140,
      h: 44,
    }));
    const placed = separated(cards, 640);
    for (const [index, a] of placed.entries())
      for (const b of placed.slice(index + 1)) expect(overlap(a, b), `${a.id}/${b.id}`).toBe(false);
    for (const card of placed) {
      expect(card.y - card.h / 2).toBeGreaterThanOrEqual(0);
      expect(card.y + card.h / 2).toBeLessThanOrEqual(640);
    }
  });

  it("leaves cards that already clear each other where they are", () => {
    const cards: Card[] = [
      { id: "left", x: 100, y: 200, w: 140, h: 44 },
      { id: "right", x: 600, y: 200, w: 140, h: 44 },
    ];
    expect(separated(cards, 640).map((card) => card.y)).toEqual([200, 200]);
  });
});

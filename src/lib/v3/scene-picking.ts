import type { SlotId } from "@/lib/v3/build-document";

/**
 * One ray hit, nearest first: the slot it belongs to, whether it lets pointing through, and what
 * was hit: a part's real surface (or the grown hit area of a small part), or the box-sized hit
 * area every part gets while exploded.
 */
export interface SlotHit {
  slot: SlotId | null;
  /** An exploded case panel: the ray goes on to what is behind it. */
  passThrough: boolean;
  /** "box": the exploded fallback area, which can be mostly empty air (an AIO's box). */
  kind?: "part" | "box";
}

/** Parts at least this many pixels across on screen; smaller ones get an invisible hit area. */
export const MIN_HIT_PX = 44;

/** Slots that are small even when the build is assembled: they always get a hit area. */
export const SMALL_SLOTS: readonly SlotId[] = ["cpu", "memory", "storage"];

/**
 * Which slot a pointer means when its ray passes through several things, in this order: the
 * nearest part surface (small parts count their grown hit area as surface); else the nearest
 * exploded box area; else the case (its frame). Pass-through hits and hits outside any slot are
 * ignored, so the case only wins when no other part is on the ray.
 */
export function pickSlot(hits: SlotHit[]): SlotId | null {
  let boxHit: SlotId | null = null;
  let caseHit: SlotId | null = null;
  for (const hit of hits) {
    if (!hit.slot || hit.passThrough) continue;
    if (hit.slot === "case") caseHit ??= hit.slot;
    else if (hit.kind === "box") boxHit ??= hit.slot;
    else return hit.slot;
  }
  return boxHit ?? caseHit;
}

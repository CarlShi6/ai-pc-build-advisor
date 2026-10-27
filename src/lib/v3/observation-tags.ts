import type { VisualObservation } from "@/lib/v3/image-contract";

/** Observation categories the review groups by; theme and lighting share one "Overall look" row. */
export type ObservationGroup = "case" | "gpu" | "cooler" | "fan" | "motherboard" | "look";

export function observationGroup(item: VisualObservation): ObservationGroup {
  return item.category === "theme" || item.category === "lighting" ? "look" : item.category;
}

function tag(value: string) {
  const text = value.trim().replace(/\s+/g, " ");
  return text ? text[0].toUpperCase() + text.slice(1) : "";
}

/**
 * One line of what the photo shows for a group, e.g. "White · Tempered glass · 5 fans · Blue LED
 * rings". Only observations visible in the photo count; duplicates are dropped. Reasons and
 * confidence stay with the observations themselves (shown on expand).
 */
export function observationTagLine(
  observations: VisualObservation[],
  group: ObservationGroup,
): string {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const item of observations) {
    if (observationGroup(item) !== group || !item.visibleInImage || item.origin === "unknown")
      continue;
    const value = tag(item.value);
    if (!value || seen.has(value.toLowerCase())) continue;
    seen.add(value.toLowerCase());
    tags.push(value);
  }
  return tags.join(" · ");
}

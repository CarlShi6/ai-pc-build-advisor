import { slotOccupancy, type BuildDocumentV3, type SlotId } from "@/lib/v3/build-document";
import type { VisualObservation } from "@/lib/v3/image-contract";

/**
 * PRD §9.3 level 2 ("appearance-informed"): what a photo shows about a slot whose exact part is
 * still unresolved. It drives a look-alike placeholder in the scene, never a part identity, so
 * nothing here names a model, sets a price or affects compatibility.
 */
export const PHOTO_APPEARANCE_LABEL = "Appearance from photo · proportions estimated";

export type AppearanceColor = "white" | "black" | "silver" | "gray" | "pink";

export interface SlotAppearance {
  slot: SlotId;
  /** Observed body colour; null when the photo shows the part but not a colour. */
  color: AppearanceColor | null;
  /** Observed lighting colour (fan rings, pump ring, light strips). */
  lightColor: string | null;
  /** Case only: a tempered-glass / windowed side panel was observed. */
  glassPanel: boolean;
  /** Case only: the number of fans counted in the photo (0 when not counted). */
  fanCount: number;
  /** Cooler only. */
  coolerType: "aio" | "air" | null;
  observationIds: string[];
}

/** Base colours for appearance placeholders (PBR lighting does the shading). */
export const appearanceHex: Record<AppearanceColor, string> = {
  white: "#e9ebee",
  black: "#1f2124",
  silver: "#b9bfc5",
  gray: "#6b7078",
  pink: "#e799be",
};

export const lightHex: Record<string, string> = {
  blue: "#4f9dff",
  cyan: "#45d4e6",
  purple: "#a98fe2",
  pink: "#ef7fbf",
  red: "#ff6a5f",
  green: "#6fdc8c",
  orange: "#ffa24c",
  white: "#f2f5ff",
};

/** Slots a photo can show; hidden parts (CPU, storage, PSU, memory) never get a placeholder. */
const appearanceSlots = ["case", "gpu", "cooler", "motherboard"] as const;

const numberWords: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

function usable(item: VisualObservation) {
  return item.visibleInImage && item.origin !== "unknown";
}

function bodyColor(value: string): AppearanceColor | null {
  const match = value.toLowerCase().match(/\b(white|black|silver|gr[ae]y|pink)\b/)?.[1];
  if (!match) return null;
  return match === "grey" ? "gray" : (match as AppearanceColor);
}

function lightColor(value: string): string | null {
  const text = value.toLowerCase();
  if (/\b(no|unlit|none|without|off)\b/.test(text)) return null;
  return text.match(/\b(blue|cyan|purple|pink|red|green|orange|white)\b/)?.[1] ?? null;
}

function isColorAttribute(item: VisualObservation) {
  return /colou?r|finish|theme/.test(item.attribute.toLowerCase());
}

function isLightingAttribute(item: VisualObservation) {
  return item.category === "lighting" || /light|led|rgb|glow/.test(item.attribute.toLowerCase());
}

function fanCountFrom(value: string): number {
  const text = value.toLowerCase();
  const digits = text.match(/\b(\d{1,2})\b/)?.[1];
  if (digits) return Math.min(12, Number(digits));
  const word = text.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/)?.[1];
  return word ? numberWords[word] : 0;
}

/** Appearance placeholders for the unresolved slots the photo shows. */
export function photoAppearance(
  document: BuildDocumentV3,
): Partial<Record<SlotId, SlotAppearance>> {
  const observations = (document.imageContext?.observations ?? []).filter(usable);
  if (!observations.length) return {};
  const lighting = observations.filter(isLightingAttribute);
  const sharedLight =
    lighting.map((item) => lightColor(item.value)).find((color) => color !== null) ?? null;
  const theme = observations.find((item) => item.category === "theme" && bodyColor(item.value));
  const result: Partial<Record<SlotId, SlotAppearance>> = {};
  for (const slot of appearanceSlots) {
    if (slotOccupancy(document, slot) !== "unresolved") continue;
    const own = observations.filter((item) => item.category === slot);
    // Without an observation of its own a slot keeps the empty-slot style.
    if (!own.length) continue;
    const colorItem = own.find((item) => isColorAttribute(item) && bodyColor(item.value));
    const ids = new Set(own.map((item) => item.id));
    if (!colorItem && theme) ids.add(theme.id);
    const appearance: SlotAppearance = {
      slot,
      color: colorItem ? bodyColor(colorItem.value) : theme ? bodyColor(theme.value) : null,
      lightColor: sharedLight,
      glassPanel: false,
      fanCount: 0,
      coolerType: null,
      observationIds: [],
    };
    if (slot === "case") {
      appearance.glassPanel = own.some(
        (item) =>
          /glass|window/.test(`${item.attribute} ${item.value}`.toLowerCase()) &&
          !/\b(no|without|solid)\b/.test(item.value.toLowerCase()),
      );
      const fanItem = observations.find(
        (item) =>
          item.category === "fan" &&
          /count|number|quantity|layout/.test(item.attribute.toLowerCase()) &&
          fanCountFrom(item.value) > 0,
      );
      if (fanItem) {
        appearance.fanCount = fanCountFrom(fanItem.value);
        ids.add(fanItem.id);
      }
    }
    if (slot === "cooler") {
      const text = own.map((item) => `${item.attribute} ${item.value}`.toLowerCase()).join(" ");
      appearance.coolerType = /\b(aio|liquid|water|radiator|pump)\b/.test(text)
        ? "aio"
        : /\b(air|tower|heatsink)\b/.test(text)
          ? "air"
          : null;
    }
    if (sharedLight) {
      const lightItem = lighting.find((item) => lightColor(item.value) === sharedLight);
      if (lightItem) ids.add(lightItem.id);
    }
    appearance.observationIds = [...ids];
    result[slot] = appearance;
  }
  return result;
}

export const PHOTO_FANS_LABEL = "Appearance from photo";

export interface PhotoFans {
  count: number;
  /** Fan frame colour from the photo (a fan colour, else the theme). */
  color: AppearanceColor | null;
  lightColor: string | null;
  observationIds: string[];
}

/**
 * Fans the photo shows, drawn on a confirmed case whose reference model has none of its own.
 * A stopgap until the fan models (visual redesign slice D); a style note, never a Build part.
 */
export function photoFans(document: BuildDocumentV3): PhotoFans | null {
  if (slotOccupancy(document, "case") !== "selected") return null;
  const observations = (document.imageContext?.observations ?? []).filter(usable);
  const countItem = observations.find(
    (item) =>
      item.category === "fan" &&
      /count|number|quantity|layout/.test(item.attribute.toLowerCase()) &&
      fanCountFrom(item.value) > 0,
  );
  if (!countItem) return null;
  const colorItem =
    observations.find(
      (item) => item.category === "fan" && isColorAttribute(item) && bodyColor(item.value),
    ) ?? observations.find((item) => item.category === "theme" && bodyColor(item.value));
  const lightItem = observations
    .filter(isLightingAttribute)
    .find((item) => lightColor(item.value) !== null);
  return {
    count: fanCountFrom(countItem.value),
    color: colorItem ? bodyColor(colorItem.value) : null,
    lightColor: lightItem ? lightColor(lightItem.value) : null,
    observationIds: [countItem, colorItem, lightItem].flatMap((item) => (item ? [item.id] : [])),
  };
}

/** Short trait line for labels and tooltips, e.g. "White · Glass side panel · 5 fans · Blue light". */
export function appearanceSummary(appearance: SlotAppearance): string {
  const traits = [
    appearance.color && appearance.color[0].toUpperCase() + appearance.color.slice(1),
    appearance.glassPanel && "Glass side panel",
    appearance.fanCount > 0 && `${appearance.fanCount} fan${appearance.fanCount === 1 ? "" : "s"}`,
    appearance.coolerType === "aio" && "Liquid AIO",
    appearance.coolerType === "air" && "Air cooler",
    appearance.lightColor &&
      `${appearance.lightColor[0].toUpperCase()}${appearance.lightColor.slice(1)} light`,
  ].filter(Boolean);
  return traits.length ? traits.join(" · ") : "Seen in photo";
}

/** Body colour name for a catalog colour like "White" or "Black / walnut"; null when unknown. */
export function colorName(value: string | null | undefined): AppearanceColor | null {
  return value ? bodyColor(value) : null;
}

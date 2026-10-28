import { v3Catalog } from "@/lib/v3/catalog";
import { recalculateBuild } from "@/lib/product-trust";
import type { Build, SavedBuild } from "@/types/build";
import type { Part, PartCategory } from "@/types/parts";
import type { CandidateReview } from "@/lib/v3/candidate-matcher";
import type { VisibleCatalogCategory } from "@/lib/v3/appearance-catalog";
import type { VisualObservation } from "@/lib/v3/image-contract";
import { readAppearanceParams, type AppearanceParams } from "@/lib/v3/appearance-params";
import {
  modelGuessSchema,
  visibleTextSchema,
  type ModelGuess,
  type VisibleText,
} from "@/lib/v3/model-guess";

export const primarySlots = [
  "case",
  "motherboard",
  "cpu",
  "cooler",
  "gpu",
  "memory",
  "storage",
  "psu",
] as const;
export type SlotId = (typeof primarySlots)[number];
export type DraftSource = "image" | "describe" | "import" | "blank" | "sample" | "legacy";
export type Occupancy = "selected" | "unselected" | "unresolved";

export interface VisualPriority {
  id: string;
  category: "colorway" | "case_style" | "lighting" | "fan_layout" | "component_placement";
  value: string;
  observationId: string;
  sourceCategory: VisualObservation["category"];
  locked: boolean;
}

export interface ImageBuildContext {
  referenceImageId: string;
  analysisId: string;
  imageStored: false;
  observations: VisualObservation[];
  /** Step A: the photo's per-category look; absent on drafts from older analyses. */
  appearance?: AppearanceParams;
  /** Fields the user set on the review page ("category.field"); the rest are as the AI read them. */
  appearanceUserSet?: string[];
  /** Step B: the AI model guesses and legible text, shown as guesses; they never select a part. */
  modelGuesses?: ModelGuess[];
  visibleText?: VisibleText[];
  reviews: Partial<Record<VisibleCatalogCategory, CandidateReview>>;
  visualPriorities: VisualPriority[];
  plannedSelections: Partial<
    Record<
      SlotId,
      { partId: string; origin: "image_review" | "manual_change"; observationIds: string[] }
    >
  >;
}

export interface BuildDocumentV3 {
  schemaVersion: 3;
  revision: number;
  source: DraftSource;
  sourceInput?: string;
  build: Build;
  unresolved: Partial<Record<SlotId, string>>;
  imageContext?: ImageBuildContext;
  savedBuildId?: string;
  /** `updatedAt` of the saved record this draft was last loaded from or saved as. */
  savedVersion?: string;
  /**
   * True when the user never set a target budget (photo drafts). `build.budget` then holds 0 as a
   * placeholder that is never shown; read the budget with `budgetOf`.
   */
  budgetUnset?: true;
}

/** The draft's target budget, or null when none was set (never a $0 budget). */
export function budgetOf(document: BuildDocumentV3): number | null {
  return document.budgetUnset ? null : document.build.budget;
}

export const slotCategory: Record<SlotId, PartCategory> = {
  case: "case",
  motherboard: "motherboard",
  cpu: "cpu",
  cooler: "cooler",
  gpu: "gpu",
  memory: "ram",
  storage: "ssd",
  psu: "psu",
};

export const slotLabel: Record<SlotId, string> = {
  case: "Case",
  motherboard: "Motherboard",
  cpu: "CPU",
  cooler: "Cooler",
  gpu: "GPU",
  memory: "Memory",
  storage: "Storage",
  psu: "Power supply",
};

export function createDraft(
  source: DraftSource,
  options: {
    name?: string;
    /** Null: no target budget (photo drafts); omitted: the 2500 default. */
    budget?: number | null;
    useCases?: string[];
    sourceInput?: string;
    parts?: Part[];
    unresolved?: Partial<Record<SlotId, string>>;
    imageContext?: ImageBuildContext;
  } = {},
): BuildDocumentV3 {
  const build = recalculateBuild({
    id: crypto.randomUUID(),
    name: options.name ?? "Untitled build",
    budget: options.budget === null ? 0 : (options.budget ?? 2500),
    targetUseCase: options.useCases ?? [],
    totalPrice: 0,
    parts: options.parts ?? [],
    compatibilityStatus: "warning",
    compatibilityChecks: [],
    compatibilityWarnings: [],
    confidenceScore: {
      score: 0,
      label: "Low",
      summary: "Required parts have not been selected.",
      passCount: 0,
      warningCount: 0,
      failCount: 0,
    },
  });
  return {
    schemaVersion: 3,
    revision: 0,
    source,
    sourceInput: options.sourceInput,
    build,
    unresolved: options.unresolved ?? {},
    imageContext: options.imageContext,
    ...(options.budget === null && { budgetUnset: true as const }),
  };
}

function isBuild(value: unknown): value is Build {
  return (
    !!value &&
    typeof value === "object" &&
    "parts" in value &&
    Array.isArray(value.parts) &&
    "id" in value &&
    typeof value.id === "string"
  );
}

/**
 * v3 draft state stored alongside a saved Build. It rides inside the existing
 * `saved_builds.build` JSON, so no database migration is needed and builds saved
 * before this field existed still read as legacy builds. Image bytes are never stored.
 */
export interface StoredDraftEnvelope {
  schemaVersion: 3;
  revision: number;
  source: DraftSource;
  sourceInput?: string;
  unresolved: Partial<Record<SlotId, string>>;
  imageContext?: ImageBuildContext;
  budgetUnset?: true;
}

type BuildWithDraft = Build & { v3Draft?: unknown };

const draftSources: readonly DraftSource[] = [
  "image",
  "describe",
  "import",
  "blank",
  "sample",
  "legacy",
];
const MAX_SOURCE_INPUT = 20_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isSlotId(value: string): value is SlotId {
  return (primarySlots as readonly string[]).includes(value);
}

function stripDraft(build: Build): Build {
  const { v3Draft: _ignored, ...rest } = build as BuildWithDraft;
  return rest as Build;
}

function partIdInSlot(build: Build, slot: SlotId) {
  return build.parts.find((part) => part.category === slotCategory[slot])?.id;
}

function readImageContext(value: unknown, build: Build): ImageBuildContext | undefined {
  if (
    !isRecord(value) ||
    typeof value.referenceImageId !== "string" ||
    typeof value.analysisId !== "string" ||
    value.imageStored !== false ||
    !Array.isArray(value.observations) ||
    !Array.isArray(value.visualPriorities) ||
    !isRecord(value.reviews) ||
    !isRecord(value.plannedSelections)
  )
    return undefined;
  // Planned selections only survive while the saved Build still holds that exact part.
  const plannedSelections: ImageBuildContext["plannedSelections"] = {};
  for (const [slot, selection] of Object.entries(value.plannedSelections)) {
    if (
      isSlotId(slot) &&
      isRecord(selection) &&
      typeof selection.partId === "string" &&
      selection.partId === partIdInSlot(build, slot)
    )
      plannedSelections[slot] = selection as ImageBuildContext["plannedSelections"][SlotId];
  }
  const appearance = readAppearanceParams(value.appearance);
  const userSet = Array.isArray(value.appearanceUserSet)
    ? value.appearanceUserSet.filter((path): path is string => typeof path === "string")
    : undefined;
  const guesses = modelGuessSchema.array().max(8).safeParse(value.modelGuesses);
  const text = visibleTextSchema.array().max(12).safeParse(value.visibleText);
  return {
    ...(value as unknown as ImageBuildContext),
    plannedSelections,
    appearance,
    appearanceUserSet: appearance ? userSet : undefined,
    modelGuesses: guesses.success ? guesses.data : undefined,
    visibleText: text.success ? text.data : undefined,
  };
}

function readDraftEnvelope(value: unknown, build: Build): StoredDraftEnvelope | null {
  if (!isRecord(value) || value.schemaVersion !== 3) return null;
  const source = draftSources.find((item) => item === value.source);
  if (!source) return null;
  const revision =
    typeof value.revision === "number" && Number.isInteger(value.revision) && value.revision >= 0
      ? value.revision
      : 0;
  // An unresolved note is dropped once that slot holds a real part (e.g. edited elsewhere).
  const unresolved: Partial<Record<SlotId, string>> = {};
  if (isRecord(value.unresolved)) {
    for (const [slot, note] of Object.entries(value.unresolved)) {
      if (isSlotId(slot) && typeof note === "string" && note.trim() && !partIdInSlot(build, slot))
        unresolved[slot] = note;
    }
  }
  return {
    schemaVersion: 3,
    revision,
    source,
    sourceInput:
      typeof value.sourceInput === "string"
        ? value.sourceInput.slice(0, MAX_SOURCE_INPUT)
        : undefined,
    unresolved,
    imageContext: readImageContext(value.imageContext, build),
    ...(value.budgetUnset === true && { budgetUnset: true as const }),
  };
}

export function fromLegacyBuild(value: unknown, savedBuildId?: string): BuildDocumentV3 | null {
  const candidate =
    value && typeof value === "object" && "build" in value ? (value as SavedBuild).build : value;
  if (!isBuild(candidate)) return null;
  const build = stripDraft(candidate);
  const envelope = readDraftEnvelope((candidate as BuildWithDraft).v3Draft, build);
  if (envelope) return { ...envelope, build, savedBuildId };
  return {
    schemaVersion: 3,
    revision: 0,
    source: "legacy",
    build,
    unresolved: {},
    savedBuildId,
  };
}

/** Opens a saved record as a Studio draft that remembers which save version it came from. */
export function fromSavedBuild(saved: SavedBuild): BuildDocumentV3 | null {
  const restored = fromLegacyBuild(saved.build, saved.id);
  if (!restored) return null;
  // The store rebuilds `build` from its parts and regenerates its name; keep the saved name.
  return {
    ...restored,
    build: { ...restored.build, name: saved.name },
    savedVersion: saved.updatedAt,
  };
}

/** Build payload for the existing save endpoint, carrying the v3 draft envelope. */
export function toSavedBuildPayload(document: BuildDocumentV3): Build {
  const build = stripDraft(document.build);
  const unresolved: Partial<Record<SlotId, string>> = {};
  for (const slot of primarySlots) {
    const note = document.unresolved[slot];
    if (note && !partIdInSlot(build, slot)) unresolved[slot] = note;
  }
  const v3Draft: StoredDraftEnvelope = {
    schemaVersion: 3,
    revision: document.revision,
    source: document.source,
    sourceInput: document.sourceInput?.slice(0, MAX_SOURCE_INPUT),
    unresolved,
    imageContext: document.imageContext,
    ...(document.budgetUnset && { budgetUnset: true as const }),
  };
  return { ...build, v3Draft } as Build;
}

export function selectedPart(document: BuildDocumentV3, slot: SlotId): Part | undefined {
  return document.build.parts.find((part) => part.category === slotCategory[slot]);
}

export function slotOccupancy(document: BuildDocumentV3, slot: SlotId): Occupancy {
  if (selectedPart(document, slot)) return "selected";
  return document.unresolved[slot] ? "unresolved" : "unselected";
}

export function completeness(document: BuildDocumentV3) {
  const selected = primarySlots.filter(
    (slot) => slotOccupancy(document, slot) === "selected",
  ).length;
  const unresolved = primarySlots.filter(
    (slot) => slotOccupancy(document, slot) === "unresolved",
  ).length;
  return {
    selected,
    unresolved,
    missing: primarySlots.length - selected - unresolved,
    complete: selected === primarySlots.length,
  };
}

export function selectPart(document: BuildDocumentV3, slot: SlotId, part: Part): BuildDocumentV3 {
  if (part.category !== slotCategory[slot])
    throw new Error("Part category does not match the slot.");
  const parts = document.build.parts.filter((current) => current.category !== part.category);
  const unresolved = { ...document.unresolved };
  delete unresolved[slot];
  return {
    ...document,
    revision: document.revision + 1,
    unresolved,
    imageContext: document.imageContext
      ? {
          ...document.imageContext,
          plannedSelections: {
            ...document.imageContext.plannedSelections,
            [slot]: { partId: part.id, origin: "manual_change", observationIds: [] },
          },
        }
      : undefined,
    build: recalculateBuild({ ...document.build, parts: [...parts, part] }),
  };
}

export function removePart(document: BuildDocumentV3, slot: SlotId): BuildDocumentV3 {
  const parts = document.build.parts.filter((part) => part.category !== slotCategory[slot]);
  const plannedSelections = { ...document.imageContext?.plannedSelections };
  delete plannedSelections[slot];
  return {
    ...document,
    revision: document.revision + 1,
    imageContext: document.imageContext
      ? { ...document.imageContext, plannedSelections }
      : undefined,
    build: recalculateBuild({ ...document.build, parts }),
  };
}

export function setVisualPriorityLock(
  document: BuildDocumentV3,
  priorityId: string,
  locked: boolean,
): BuildDocumentV3 {
  if (!document.imageContext?.visualPriorities.some((item) => item.id === priorityId))
    throw new Error("The visual priority is unavailable.");
  return {
    ...document,
    revision: document.revision + 1,
    imageContext: {
      ...document.imageContext,
      visualPriorities: document.imageContext.visualPriorities.map((item) =>
        item.id === priorityId ? { ...item, locked } : item,
      ),
    },
  };
}

export function catalogForSlot(slot: SlotId) {
  return v3Catalog.filter((part) => part.category === slotCategory[slot]);
}

export interface ImportMatch {
  line: string;
  part?: Part;
  status: "matched" | "ambiguous" | "unknown";
}

export function previewPartsList(input: string): ImportMatch[] {
  const rows = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const normalized = line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, "").toLowerCase();
      const matches = v3Catalog.filter((part) =>
        [part.id, part.displayName, `${part.brand} ${part.model}`, part.model].some(
          (name) => normalized === name.toLowerCase(),
        ),
      );
      if (matches.length === 1) return { line, part: matches[0], status: "matched" as const };
      return { line, status: matches.length > 1 ? ("ambiguous" as const) : ("unknown" as const) };
    });
  const categoryCounts = new Map<PartCategory, number>();
  rows.forEach((row) => {
    if (row.part)
      categoryCounts.set(row.part.category, (categoryCounts.get(row.part.category) ?? 0) + 1);
  });
  return rows.map((row) =>
    row.part && (categoryCounts.get(row.part.category) ?? 0) > 1
      ? { line: row.line, status: "ambiguous" as const }
      : row,
  );
}

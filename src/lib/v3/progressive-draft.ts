import {
  createDraft,
  primarySlots,
  selectedPart,
  selectPart,
  type BuildDocumentV3,
  type ImageBuildContext,
  type SlotId,
} from "@/lib/v3/build-document";
import {
  anyKnown,
  appearanceValue,
  unknownAppearance,
  type AppearanceParams,
} from "@/lib/v3/appearance-params";
import type { StreamedCategory, StreamedPart } from "@/lib/v3/analysis-stream";
import type { ImageAnalysisResult } from "@/lib/v3/image-contract";
import { confirmImageBuild, proposeImageBuild, type SuggestedParts } from "@/lib/v3/image-build";
import { catalogPartById } from "@/lib/v3/catalog";
import { matchVisualCandidates } from "@/lib/v3/candidate-matcher";
import { KEEP_UNKNOWN_NOTE } from "@/lib/v3/slot-identity";

/**
 * The Studio draft while a photo is read (analysis-stream.ts). It starts empty; each appearance
 * category is drawn as it arrives; the full result then fills in observations and guesses and
 * runs the contradiction checks. What the user changed meanwhile always wins: a part they chose,
 * a slot they kept unknown, a look field they set.
 */

/** Slots a photo can show; they wait as "Reading…" until their category arrives. */
export const readingSlots: SlotId[] = ["case", "gpu", "cooler", "memory", "motherboard"];

/** The slot a category is drawn in; fans belong to the case. */
export const slotOfCategory: Record<StreamedCategory, SlotId> = {
  case: "case",
  gpu: "gpu",
  cooler: "cooler",
  fans: "case",
  memory: "memory",
  motherboard: "motherboard",
};

export const foundLabel: Record<StreamedCategory, string> = {
  case: "Case found",
  gpu: "Graphics card found",
  cooler: "Cooler found",
  fans: "Case fans found",
  memory: "Memory found",
  motherboard: "Motherboard found",
};

const VISIBLE_NOTE = "Visible in reference; exact identity unresolved";

/** The empty draft Studio opens with when Analyze starts. */
export function startReadingDraft(readingId: string): BuildDocumentV3 {
  return createDraft("image", {
    name: "Reference photo build",
    budget: null,
    imageContext: {
      referenceImageId: readingId,
      analysisId: readingId,
      imageStored: false,
      observations: [],
      appearance: structuredClone(unknownAppearance),
      reviews: {},
      visualPriorities: [],
      plannedSelections: {},
      reading: true,
    },
  });
}

/** Reads the photo again into an interrupted draft: what is drawn and what the user chose stay. */
export function resumeReadingDraft(document: BuildDocumentV3, readingId: string): BuildDocumentV3 {
  if (!document.imageContext) return document;
  return {
    ...document,
    // The new read is checked again, so an earlier "unclear" goes until it says so.
    imageContext: {
      ...document.imageContext,
      analysisId: readingId,
      reading: true,
      photoUnclear: undefined,
    },
  };
}

/** The read ended without a full result (failed, or the user set the interruption aside). */
export function endReadingDraft(document: BuildDocumentV3): BuildDocumentV3 {
  if (!document.imageContext?.reading) return document;
  const { reading: _reading, ...context } = document.imageContext;
  return { ...document, imageContext: context };
}

/** A draft whose read stopped with the page (a reload or a closed tab), not by an error. */
export function wasInterrupted(document: BuildDocumentV3, live: unknown) {
  return !!document.imageContext?.reading && !live;
}

/** Slots the user decided while the photo was read: a chosen part or "keep unknown". */
export function userSlots(document: BuildDocumentV3): SlotId[] {
  return primarySlots.filter(
    (slot) => !!selectedPart(document, slot) || document.unresolved[slot] === KEEP_UNKNOWN_NOTE,
  );
}

/** One category's values, keeping any field the user set. */
function mergeCategory<C extends StreamedCategory>(
  shown: AppearanceParams,
  category: C,
  value: AppearanceParams[C],
  userSet: string[],
): AppearanceParams[C] {
  const next = { ...value } as Record<string, string>;
  for (const field of Object.keys(next))
    if (userSet.includes(`${category}.${field}`))
      next[field] = appearanceValue(shown, `${category}.${field}`);
  return next as AppearanceParams[C];
}

/** Draws one streamed category. A slot the user decided keeps their choice. */
export function applyStreamedPart(document: BuildDocumentV3, part: StreamedPart): BuildDocumentV3 {
  const context = document.imageContext;
  if (!context?.appearance) return document;
  const appearance = {
    ...context.appearance,
    [part.category]: mergeCategory(
      context.appearance,
      part.category,
      part.value,
      context.appearanceUserSet ?? [],
    ),
  } as AppearanceParams;
  const slot = slotOfCategory[part.category];
  const unresolved = { ...document.unresolved };
  if (
    anyKnown(appearance[part.category] as Record<string, string>) &&
    !userSlots(document).includes(slot)
  )
    unresolved[slot] ??= VISIBLE_NOTE;
  return { ...document, unresolved, imageContext: { ...context, appearance } };
}

/**
 * The full result: observations, guesses and the checked appearance. Returns the categories whose
 * drawn look changed (for "Adjusted after full read"); user-set fields and slots are kept.
 */
export function applyFullResult(
  document: BuildDocumentV3,
  result: ImageAnalysisResult,
): { document: BuildDocumentV3; adjusted: StreamedCategory[] } {
  const context = document.imageContext;
  const userSet = context?.appearanceUserSet ?? [];
  const shown = context?.appearance ?? unknownAppearance;
  const read = result.appearance;
  let appearance = read;
  if (read && userSet.length) {
    appearance = structuredClone(read);
    for (const path of userSet) {
      const [category, field] = path.split(".") as [StreamedCategory, string];
      (appearance[category] as Record<string, string>)[field] = appearanceValue(shown, path);
    }
  }
  const adjusted = appearance
    ? (Object.keys(appearance) as StreamedCategory[]).filter(
        (category) =>
          anyKnown(shown[category] as Record<string, string>) &&
          JSON.stringify(shown[category]) !== JSON.stringify(appearance![category]),
      )
    : [];
  const proposal = proposeImageBuild(
    { ...result, ...(appearance && { appearance }) },
    {},
    null,
    null,
    userSet,
  );
  let next = confirmImageBuild(proposal, null);
  const kept = userSlots(document);
  // The user's parts and "keep unknown" notes come back on top; build id and name stay.
  for (const slot of kept) {
    const part = selectedPart(document, slot);
    if (part) next = selectPart(next, slot, part);
    else next = { ...next, unresolved: { ...next.unresolved, [slot]: KEEP_UNKNOWN_NOTE } };
  }
  const plannedSelections = {
    ...next.imageContext!.plannedSelections,
    ...context?.plannedSelections,
  };
  const extras: Partial<ImageBuildContext> = {
    ...(context?.photoUnclear && { photoUnclear: true as const }),
    summary: result.summary,
    ...(read && { appearanceRead: read }),
    quality: result.quality,
    absentParts: result.absentParts,
    ...(result.appearanceCorrections && { appearanceCorrections: result.appearanceCorrections }),
  };
  return {
    document: {
      ...next,
      revision: document.revision,
      build: { ...next.build, id: document.build.id, name: document.build.name },
      imageContext: { ...next.imageContext!, ...extras, plannedSelections },
    },
    adjusted,
  };
}

/** The analysis behind an image draft, rebuilt from what the draft keeps (for the match drawer). */
export function analysisOfDraft(document: BuildDocumentV3): ImageAnalysisResult | null {
  const context = document.imageContext;
  if (!context) return null;
  return {
    analysisId: context.analysisId,
    imageId: context.referenceImageId,
    status: "ready",
    createdAt: "",
    provider: "openai",
    image: { mime: "image/jpeg", width: 1, height: 1 },
    summary: context.summary ?? "",
    quality: context.quality ?? "clear",
    qualityIssues: [],
    observations: context.observations,
    unknownPartIdentities: [...primarySlots],
    absentParts: context.absentParts ?? [],
    ...(context.appearance && { appearance: context.appearance }),
    ...(context.appearanceCorrections && { appearanceCorrections: context.appearanceCorrections }),
    modelGuesses: context.modelGuesses ?? [],
    visibleText: context.visibleText ?? [],
  };
}

/** Confirmed matches from the drawer go into the open draft; other slots are left alone. */
export function applyMatches(
  document: BuildDocumentV3,
  suggested: SuggestedParts,
): BuildDocumentV3 {
  let next = document;
  for (const { slot, partId } of suggested.proposal.selected) {
    const part = catalogPartById(partId);
    if (part) next = selectPart(next, slot, part);
  }
  const planned = suggested.proposal.candidate.imageContext?.plannedSelections ?? {};
  return {
    ...next,
    imageContext: next.imageContext && {
      ...next.imageContext,
      reviews: structuredClone(suggested.reviews),
      plannedSelections: { ...next.imageContext.plannedSelections, ...planned },
    },
  };
}

/** A look field the user set in the drawer; it stays when later results arrive. */
export function setDraftAppearance(
  document: BuildDocumentV3,
  appearance: AppearanceParams,
  userSet: string[],
): BuildDocumentV3 {
  if (!document.imageContext) return document;
  return {
    ...document,
    revision: document.revision + 1,
    imageContext: {
      ...document.imageContext,
      appearance,
      appearanceUserSet: userSet,
    },
  };
}

/** Visible parts that have catalog options and no part chosen yet (fans are not Build slots). */
export function matchableCount(document: BuildDocumentV3, analysis: ImageAnalysisResult) {
  return matchVisualCandidates(analysis).filter(
    (set) =>
      set.category !== "fan" &&
      set.status === "candidates" &&
      !selectedPart(document, set.category as SlotId),
  ).length;
}

export function matchButtonLabel(count: number) {
  return count > 0
    ? `${count} part${count === 1 ? "" : "s"} can be matched to a model`
    : "Photo reading details";
}

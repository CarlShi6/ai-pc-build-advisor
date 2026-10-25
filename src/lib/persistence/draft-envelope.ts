import type { Build } from "@/types/build";

/** Upper bound for the serialized v3 draft envelope stored inside `saved_builds.build`. */
export const MAX_DRAFT_ENVELOPE_CHARS = 200_000;

/**
 * Stores rebuild a saved Build from its parts, which drops unknown fields. This carries the
 * optional v3 draft envelope across that rebuild. The envelope is validated again when a
 * Studio draft is read (`fromLegacyBuild`), so here it is only shape- and size-checked.
 */
export function withDraftEnvelope(input: Build, safeBuild: Build): Build {
  const envelope = (input as Build & { v3Draft?: unknown }).v3Draft;
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) return safeBuild;
  if (JSON.stringify(envelope).length > MAX_DRAFT_ENVELOPE_CHARS)
    throw new Error("This build's draft details are too large to save.");
  return { ...safeBuild, v3Draft: envelope } as Build;
}

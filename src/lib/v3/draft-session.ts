import type { BuildDocumentV3 } from "@/lib/v3/build-document";

const KEY = "aipc-v3-active-draft";

export function readDraft(): BuildDocumentV3 | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(window.sessionStorage.getItem(KEY) ?? "null");
    if (value?.schemaVersion !== 3 || !value?.build || !Array.isArray(value.build.parts))
      return null;
    return value as BuildDocumentV3;
  } catch {
    return null;
  }
}

export function writeDraft(document: BuildDocumentV3) {
  if (typeof window !== "undefined") window.sessionStorage.setItem(KEY, JSON.stringify(document));
}

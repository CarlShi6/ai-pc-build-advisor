/**
 * Optimistic concurrency for saved Builds. The saved record's `updatedAt` is its save version:
 * a client that last saw version X may only overwrite the record while it is still at X, so a
 * stale tab cannot silently replace a newer save made elsewhere.
 */
export const SAVE_CONFLICT_CODE = "SAVE_CONFLICT";

export class SaveConflictError extends Error {
  readonly code = SAVE_CONFLICT_CODE;

  constructor() {
    super(
      "This build was saved from another tab or window after you opened it. Open the saved version or overwrite it with this one.",
    );
    this.name = "SaveConflictError";
  }
}

function sameInstant(left: string, right: string) {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  return Number.isNaN(leftTime) || Number.isNaN(rightTime)
    ? left === right
    : leftTime === rightTime;
}

/** Throws when the caller expected a version and the stored record has moved past it. */
export function assertSaveVersion(currentUpdatedAt: string, expectedUpdatedAt?: string) {
  if (expectedUpdatedAt !== undefined && !sameInstant(currentUpdatedAt, expectedUpdatedAt))
    throw new SaveConflictError();
}

/** A save timestamp strictly after the previous one, so two quick saves never share a version. */
export function nextSaveTimestamp(previousUpdatedAt?: string, now = Date.now()) {
  const previous = previousUpdatedAt ? Date.parse(previousUpdatedAt) : Number.NaN;
  return new Date(Number.isNaN(previous) ? now : Math.max(now, previous + 1)).toISOString();
}

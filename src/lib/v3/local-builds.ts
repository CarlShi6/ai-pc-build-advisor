import { ApiClientError } from "@/lib/apiClient";
import { recalculateBuild } from "@/lib/build-advisor";
import { withDraftEnvelope } from "@/lib/persistence/draft-envelope";
import {
  assertSaveVersion,
  nextSaveTimestamp,
  SAVE_CONFLICT_CODE,
  SaveConflictError,
} from "@/lib/persistence/save-version";
import type { SaveBuildRequest, SaveBuildResponse } from "@/types/api";
import type { SavedBuild, SavedBuildSummary } from "@/types/build";

/**
 * My Builds in this browser's localStorage, for the first deployment (docs/DEPLOY.md, Stage 2):
 * no accounts and no server database. Same contract as the server endpoints, including the
 * save-version conflict check between tabs. Builds never leave the browser; clearing site data
 * deletes them.
 */
export const LOCAL_BUILDS_KEY = "aipc-v3-saved-builds";
export const LOCAL_BUILD_LIMIT = 10;

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function readAll(): SavedBuild[] {
  try {
    const value = JSON.parse(storage()?.getItem(LOCAL_BUILDS_KEY) ?? "[]");
    return Array.isArray(value)
      ? value.filter(
          (item): item is SavedBuild =>
            !!item &&
            typeof item.id === "string" &&
            typeof item.updatedAt === "string" &&
            Array.isArray(item.build?.parts),
        )
      : [];
  } catch {
    return [];
  }
}

function writeAll(builds: SavedBuild[]) {
  const store = storage();
  if (!store) throw new ApiClientError("This browser cannot save builds.", 503, false);
  try {
    store.setItem(LOCAL_BUILDS_KEY, JSON.stringify(builds));
  } catch {
    throw new ApiClientError(
      "This browser's storage is full, so the build was not saved.",
      507,
      false,
    );
  }
}

function summaryOf(saved: SavedBuild): SavedBuildSummary {
  return {
    id: saved.id,
    name: saved.name,
    createdAt: saved.createdAt,
    updatedAt: saved.updatedAt,
    totalPrice: saved.totalPrice,
    compatibilityStatus: saved.compatibilityStatus,
    ownedParts: saved.ownedParts,
    targetUseCase: saved.targetUseCase,
    cpuName: saved.build.parts.find((part) => part.category === "cpu")?.displayName,
    gpuName: saved.build.parts.find((part) => part.category === "gpu")?.displayName,
  };
}

const summaries = (builds: SavedBuild[]) =>
  [...builds]
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .map(summaryOf);

const notFound = () =>
  new ApiClientError("This saved build was not found in this browser.", 404, false);

export async function getLocalSavedBuilds() {
  return { builds: summaries(readAll()), limit: LOCAL_BUILD_LIMIT };
}

export async function saveLocalBuild(payload: SaveBuildRequest): Promise<SaveBuildResponse> {
  const builds = readAll();
  const index = payload.id ? builds.findIndex((item) => item.id === payload.id) : -1;
  const existing = index >= 0 ? builds[index] : undefined;
  if (existing) {
    try {
      assertSaveVersion(existing.updatedAt, payload.expectedUpdatedAt);
    } catch (error) {
      if (error instanceof SaveConflictError)
        throw new ApiClientError(error.message, 409, false, SAVE_CONFLICT_CODE);
      throw error;
    }
  } else if (builds.length >= LOCAL_BUILD_LIMIT) {
    throw new ApiClientError(
      `This browser holds up to ${LOCAL_BUILD_LIMIT} saved builds. Delete one in My Builds first.`,
      409,
      false,
    );
  }
  const now = nextSaveTimestamp(existing?.updatedAt);
  const build = withDraftEnvelope(payload.build, recalculateBuild(payload.build));
  const saved: SavedBuild = {
    id: existing?.id ?? `local-${crypto.randomUUID()}`,
    name: payload.name.trim() || build.name,
    build,
    buildNeeds: payload.buildNeeds,
    feedback: [],
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    totalPrice: build.totalPrice,
    compatibilityStatus: build.compatibilityStatus,
    ownedParts: build.parts.filter((part) => part.owned).length,
    targetUseCase: build.targetUseCase,
  };
  if (existing) builds[index] = saved;
  else builds.unshift(saved);
  writeAll(builds);
  return {
    savedBuild: saved,
    summary: summaryOf(saved),
    builds: summaries(builds),
    limit: LOCAL_BUILD_LIMIT,
  };
}

export async function getLocalSavedBuild(id: string): Promise<SavedBuild> {
  const saved = readAll().find((item) => item.id === id);
  if (!saved) throw notFound();
  return saved;
}

export async function deleteLocalSavedBuild(id: string) {
  const builds = readAll();
  if (!builds.some((item) => item.id === id)) throw notFound();
  const left = builds.filter((item) => item.id !== id);
  writeAll(left);
  return { builds: summaries(left), limit: LOCAL_BUILD_LIMIT };
}

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDraft, fromSavedBuild, toSavedBuildPayload } from "@/lib/v3/build-document";
import {
  deleteLocalSavedBuild,
  getLocalSavedBuild,
  getLocalSavedBuilds,
  LOCAL_BUILD_LIMIT,
  LOCAL_BUILDS_KEY,
  saveLocalBuild,
} from "@/lib/v3/local-builds";
import { createWhiteShowcaseSample } from "@/lib/v3/showcase-sample";
import { hiddenInProduction, isLegacyPage, notFoundResponse } from "@/lib/production-surface";
import { SAVE_CONFLICT_CODE } from "@/lib/persistence/save-version";

function memoryStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
}

const request = (draft = createWhiteShowcaseSample()) => ({
  name: draft.build.name,
  build: toSavedBuildPayload(draft),
  buildNeeds: { targetUseCase: draft.build.targetUseCase },
});

beforeEach(() => {
  vi.stubGlobal("window", { localStorage: memoryStorage() });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("My Builds in this browser (first deployment)", () => {
  it("saves, lists, reopens and deletes a build without any server", async () => {
    const draft = createWhiteShowcaseSample();
    const saved = await saveLocalBuild(request(draft));
    expect(saved.savedBuild.id).toMatch(/^local-/);
    expect((await getLocalSavedBuilds()).builds.map((item) => item.id)).toEqual([
      saved.savedBuild.id,
    ]);
    const reopened = fromSavedBuild(await getLocalSavedBuild(saved.savedBuild.id))!;
    expect(reopened.build.parts.map((part) => part.id)).toEqual(
      draft.build.parts.map((part) => part.id),
    );
    expect(window.localStorage.getItem(LOCAL_BUILDS_KEY)).toContain(saved.savedBuild.id);
    expect((await deleteLocalSavedBuild(saved.savedBuild.id)).builds).toEqual([]);
    await expect(getLocalSavedBuild(saved.savedBuild.id)).rejects.toMatchObject({ status: 404 });
  });

  it("refuses to overwrite a newer save from another tab", async () => {
    const first = await saveLocalBuild(request());
    const id = first.savedBuild.id;
    await saveLocalBuild({ ...request(), id, expectedUpdatedAt: first.savedBuild.updatedAt });
    await expect(
      saveLocalBuild({ ...request(), id, expectedUpdatedAt: first.savedBuild.updatedAt }),
    ).rejects.toMatchObject({ code: SAVE_CONFLICT_CODE, status: 409 });
  });

  it("holds a fixed number of builds and ignores unreadable storage", async () => {
    for (let i = 0; i < LOCAL_BUILD_LIMIT; i += 1)
      await saveLocalBuild(request(createDraft("blank")));
    await expect(saveLocalBuild(request())).rejects.toThrow(/up to 10 saved builds/);
    window.localStorage.setItem(LOCAL_BUILDS_KEY, "{not json");
    expect((await getLocalSavedBuilds()).builds).toEqual([]);
  });
});

describe("production surface (v3 only)", () => {
  it("hides pre-v3 pages and every API the v3 app does not call", () => {
    for (const path of ["/compare", "/checkout/success", "/legacy-workspace/", "/Dashboard"])
      expect(isLegacyPage(path)).toBe(true);
    for (const path of ["/", "/studio", "/start/describe", "/my-builds", "/privacy"])
      expect(hiddenInProduction(path)).toBe(false);
    for (const path of ["/api/checkout/create-session", "/api/stripe/webhook", "/api/auth/sign-in"])
      expect(hiddenInProduction(path)).toBe(true);
    for (const path of ["/api/image-analyses", "/api/analytics/events", "/api/build/recommend"])
      expect(hiddenInProduction(path)).toBe(false);
  });

  it("answers 404 as JSON for APIs and HTML for pages", async () => {
    const api = notFoundResponse("/api/builds/saved");
    expect(api.status).toBe(404);
    await expect(api.json()).resolves.toMatchObject({ error: { code: "NOT_FOUND" } });
    const page = notFoundResponse("/cart");
    expect(page.status).toBe(404);
    expect(page.headers.get("content-type")).toMatch(/text\/html/);
  });
});

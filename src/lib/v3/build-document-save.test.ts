import { describe, expect, it } from "vitest";
import { seedParts } from "@/data/seedParts";
import { MockPersistenceStore } from "@/lib/persistence/mock-store";
import { nextSaveTimestamp, SaveConflictError } from "@/lib/persistence/save-version";
import {
  completeness,
  createDraft,
  fromLegacyBuild,
  fromSavedBuild,
  selectPart,
  setVisualPriorityLock,
  slotOccupancy,
  toSavedBuildPayload,
  type ImageBuildContext,
} from "@/lib/v3/build-document";

const cpu = seedParts.find((part) => part.category === "cpu")!;
const gpu = seedParts.find((part) => part.category === "gpu")!;
const psu = seedParts.find((part) => part.category === "psu")!;

function importedDraft() {
  return createDraft("import", {
    name: "Imported parts draft",
    sourceInput: `${cpu.displayName}\nSome mystery 1000W PSU`,
    parts: [cpu],
    unresolved: { psu: "Some mystery 1000W PSU" },
  });
}

async function signedInStore() {
  const store = new MockPersistenceStore();
  const session = await store.signIn({ email: "v3-save@example.com", password: "test-password" });
  return { store, actor: { sessionId: session.sessionId, userId: session.user?.id } };
}

describe("v3 draft save round trip", () => {
  it("keeps source, revision and unresolved slots through the existing save path", async () => {
    const { store, actor } = await signedInStore();
    const draft = selectPart(importedDraft(), "gpu", gpu);

    const saved = await store.saveBuild(actor, {
      name: draft.build.name,
      build: toSavedBuildPayload(draft),
      buildNeeds: { budget: draft.build.budget },
    });
    const restored = fromLegacyBuild(
      (await store.getSavedBuild(actor, saved.savedBuild.id))?.build,
      saved.savedBuild.id,
    );

    expect(restored).toMatchObject({
      source: "import",
      revision: draft.revision,
      sourceInput: draft.sourceInput,
      unresolved: { psu: "Some mystery 1000W PSU" },
      savedBuildId: saved.savedBuild.id,
    });
    expect(slotOccupancy(restored!, "psu")).toBe("unresolved");
    expect(completeness(restored!)).toEqual(completeness(draft));
    expect(restored!.build.parts.map((part) => part.id).sort()).toEqual(
      draft.build.parts.map((part) => part.id).sort(),
    );
    expect("v3Draft" in restored!.build).toBe(false);
  });

  it("still reads builds saved before the envelope existed as legacy", () => {
    const legacy = createDraft("blank", { parts: [cpu] }).build;
    expect(fromLegacyBuild(legacy, "old-1")).toMatchObject({
      source: "legacy",
      revision: 0,
      unresolved: {},
    });
  });

  it("drops an unresolved note when that slot was filled elsewhere", () => {
    const payload = toSavedBuildPayload(importedDraft());
    const editedElsewhere = { ...payload, parts: [...payload.parts, psu] };
    const restored = fromLegacyBuild(editedElsewhere);
    expect(restored?.unresolved).toEqual({});
    expect(slotOccupancy(restored!, "psu")).toBe("selected");
  });

  it("ignores a malformed envelope instead of trusting it", () => {
    const build = { ...createDraft("blank", { parts: [cpu] }).build, v3Draft: { source: "x" } };
    expect(fromLegacyBuild(build)?.source).toBe("legacy");
    const badSlots = {
      ...createDraft("blank").build,
      v3Draft: {
        schemaVersion: 3,
        source: "import",
        revision: -4,
        unresolved: { gpu: 5, fan: "?" },
      },
    };
    expect(fromLegacyBuild(badSlots)).toMatchObject({
      source: "import",
      revision: 0,
      unresolved: {},
    });
  });

  it("keeps image review context without image bytes and prunes stale planned picks", () => {
    const imageContext: ImageBuildContext = {
      referenceImageId: "ref-1",
      analysisId: "analysis-1",
      imageStored: false,
      observations: [],
      reviews: {},
      visualPriorities: [],
      plannedSelections: {
        cpu: { partId: cpu.id, origin: "image_review", observationIds: ["obs-1"] },
        gpu: { partId: gpu.id, origin: "image_review", observationIds: ["obs-2"] },
      },
    };
    const draft = createDraft("image", { parts: [cpu], imageContext });
    const restored = fromLegacyBuild(JSON.parse(JSON.stringify(toSavedBuildPayload(draft))));
    expect(restored?.imageContext?.imageStored).toBe(false);
    expect(Object.keys(restored?.imageContext?.plannedSelections ?? {})).toEqual(["cpu"]);

    const storedFlag = { ...toSavedBuildPayload(draft) } as Record<string, unknown>;
    storedFlag.v3Draft = {
      ...(storedFlag.v3Draft as object),
      imageContext: { ...imageContext, imageStored: true },
    };
    expect(fromLegacyBuild(storedFlag)?.imageContext).toBeUndefined();
  });
});

describe("saved draft envelope limits", () => {
  it("refuses an oversized envelope instead of storing it", async () => {
    const { store, actor } = await signedInStore();
    const payload = toSavedBuildPayload(
      createDraft("describe", { sourceInput: "quiet white PC", parts: [cpu] }),
    ) as unknown as Record<string, unknown>;
    payload.v3Draft = { ...(payload.v3Draft as object), padding: "x".repeat(250_000) };
    await expect(
      store.saveBuild(actor, {
        name: "Too large",
        build: payload as never,
        buildNeeds: {},
      }),
    ).rejects.toThrow("too large");
  });
});

describe("save revision check", () => {
  async function savedTwice() {
    const { store, actor } = await signedInStore();
    const first = await store.saveBuild(actor, {
      name: "Shared build",
      build: toSavedBuildPayload(importedDraft()),
      buildNeeds: {},
    });
    const opened = fromSavedBuild(first.savedBuild)!;
    return { store, actor, first, opened };
  }

  it("opens a saved build with its save version and saved name", async () => {
    const { first, opened } = await savedTwice();
    expect(opened).toMatchObject({
      savedBuildId: first.savedBuild.id,
      savedVersion: first.savedBuild.updatedAt,
      build: { name: "Shared build" },
      source: "import",
    });
  });

  it("rejects a stale tab instead of overwriting a newer save", async () => {
    const { store, actor, first, opened } = await savedTwice();
    const newerTab = selectPart(opened, "gpu", gpu);
    const newer = await store.saveBuild(actor, {
      id: first.savedBuild.id,
      name: "Shared build",
      build: toSavedBuildPayload(newerTab),
      buildNeeds: {},
      expectedUpdatedAt: opened.savedVersion,
    });
    expect(Date.parse(newer.savedBuild.updatedAt)).toBeGreaterThan(
      Date.parse(first.savedBuild.updatedAt),
    );

    const staleTab = selectPart(opened, "psu", psu);
    await expect(
      store.saveBuild(actor, {
        id: first.savedBuild.id,
        name: "Shared build",
        build: toSavedBuildPayload(staleTab),
        buildNeeds: {},
        expectedUpdatedAt: opened.savedVersion,
      }),
    ).rejects.toBeInstanceOf(SaveConflictError);

    const stored = await store.getSavedBuild(actor, first.savedBuild.id);
    expect(stored?.updatedAt).toBe(newer.savedBuild.updatedAt);
    expect(stored?.build.parts.some((part) => part.id === gpu.id)).toBe(true);
    expect(stored?.build.parts.some((part) => part.id === psu.id)).toBe(false);

    // Overwriting is an explicit choice: the tab re-saves against the version it was shown.
    const overwritten = await store.saveBuild(actor, {
      id: first.savedBuild.id,
      name: "Shared build",
      build: toSavedBuildPayload(staleTab),
      buildNeeds: {},
      expectedUpdatedAt: stored!.updatedAt,
    });
    expect(overwritten.savedBuild.build.parts.some((part) => part.id === psu.id)).toBe(true);
    expect(overwritten.builds).toHaveLength(1);
  });

  it("leaves saves without a version unchecked for older clients", async () => {
    const { store, actor, first } = await savedTwice();
    await store.saveBuild(actor, {
      id: first.savedBuild.id,
      name: "Shared build",
      build: toSavedBuildPayload(importedDraft()),
      buildNeeds: {},
    });
    await expect(
      store.saveBuild(actor, {
        id: first.savedBuild.id,
        name: "Legacy client",
        build: toSavedBuildPayload(importedDraft()),
        buildNeeds: {},
      }),
    ).resolves.toMatchObject({ savedBuild: { name: "Legacy client" } });
  });

  it("never reuses a save version for saves within the same millisecond", () => {
    const previous = "2026-10-25T12:00:00.000Z";
    expect(nextSaveTimestamp(previous, Date.parse(previous))).toBe("2026-10-25T12:00:00.001Z");
    expect(nextSaveTimestamp(previous, Date.parse(previous) - 5000)).toBe(
      "2026-10-25T12:00:00.001Z",
    );
    expect(nextSaveTimestamp(undefined, Date.parse(previous))).toBe(previous);
  });
});

describe("saved image-born build keeps the look lock", () => {
  it("round-trips locked and unlocked visual priorities and unknown slots", async () => {
    const { store, actor } = await signedInStore();
    const imageContext: ImageBuildContext = {
      referenceImageId: "ref-white",
      analysisId: "analysis-white",
      imageStored: false,
      observations: [],
      reviews: {},
      visualPriorities: [
        {
          id: "priority-colorway",
          category: "colorway",
          value: "white exterior",
          observationId: "obs-1",
          sourceCategory: "case",
          locked: false,
        },
        {
          id: "priority-lighting",
          category: "lighting",
          value: "RGB fan rings",
          observationId: "obs-2",
          sourceCategory: "fan",
          locked: false,
        },
      ],
      plannedSelections: {},
    };
    const draft = setVisualPriorityLock(
      createDraft("image", {
        parts: [cpu],
        unresolved: { gpu: "Visible GPU, identity unknown" },
        imageContext,
      }),
      "priority-colorway",
      true,
    );
    const saved = await store.saveBuild(actor, {
      name: "White show build",
      build: toSavedBuildPayload(draft),
      buildNeeds: {},
    });
    const restored = fromSavedBuild((await store.getSavedBuild(actor, saved.savedBuild.id))!)!;

    expect(restored.imageContext?.visualPriorities).toEqual([
      expect.objectContaining({ id: "priority-colorway", value: "white exterior", locked: true }),
      expect.objectContaining({ id: "priority-lighting", locked: false }),
    ]);
    expect(restored.unresolved).toEqual({ gpu: "Visible GPU, identity unknown" });
    expect(slotOccupancy(restored, "gpu")).toBe("unresolved");
    expect(slotOccupancy(restored, "psu")).toBe("unselected");
    expect(restored.revision).toBe(draft.revision);
  });
});

import { describe, expect, it } from "vitest";
import { seedParts } from "@/data/seedParts";
import { MockPersistenceStore } from "@/lib/persistence/mock-store";
import {
  completeness,
  createDraft,
  fromLegacyBuild,
  selectPart,
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

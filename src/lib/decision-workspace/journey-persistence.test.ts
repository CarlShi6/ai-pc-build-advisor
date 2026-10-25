import { describe, expect, it } from "vitest";
import { recommendedBuildPartIds, seedParts } from "@/data/seedParts";
import { MockPersistenceStore } from "@/lib/persistence/mock-store";
import { createSeedBuild } from "@/lib/product-trust";

const parts = Object.values(recommendedBuildPartIds)
  .filter(Boolean)
  .map((id) => seedParts.find((part) => part.id === id)!)
  .filter(Boolean);

describe("decision workspace persistence journey", () => {
  it("saves and restores the canonical build and requirements for an authenticated actor", async () => {
    const store = new MockPersistenceStore();
    const session = await store.signIn({ email: "journey@example.com", password: "test-password" });
    const actor = { sessionId: session.sessionId, userId: session.user?.id };
    const build = createSeedBuild(parts, 2500);
    const buildNeeds = { budget: 2500, targetUseCase: ["gaming"] };

    const result = await store.saveBuild(actor, { name: "Journey build", build, buildNeeds });
    const restored = await store.getSavedBuild(actor, result.savedBuild.id);

    expect(restored?.build.parts.map((part) => part.id)).toEqual(
      build.parts.map((part) => part.id),
    );
    expect(restored?.buildNeeds).toEqual(buildNeeds);
  });

  it("leaves the first saved build available when a later save exceeds the free limit", async () => {
    const store = new MockPersistenceStore();
    const session = await store.signIn({ email: "limit@example.com", password: "test-password" });
    const actor = { sessionId: session.sessionId, userId: session.user?.id };
    const build = createSeedBuild(parts, 2500);
    const first = await store.saveBuild(actor, {
      name: "Stable build",
      build,
      buildNeeds: { budget: 2500 },
    });

    await expect(
      store.saveBuild(actor, { name: "Second build", build, buildNeeds: { budget: 2400 } }),
    ).rejects.toThrow("saved build slot is full");
    await expect(store.getSavedBuild(actor, first.savedBuild.id)).resolves.toMatchObject({
      name: "Stable build",
    });
  });
});

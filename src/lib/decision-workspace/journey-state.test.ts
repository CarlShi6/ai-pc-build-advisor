import { describe, expect, it } from "vitest";
import {
  advisorActionsFromNeeds,
  createOperationGate,
  createRequestSequence,
  mergeCustomerNeeds,
  needsUpdateFromAdvisorAction,
  summarizeBuildChange,
} from "@/lib/decision-workspace/journey-state";
import { createSeedBuild } from "@/lib/product-trust";
import { recommendedBuildPartIds, seedParts } from "@/data/seedParts";

const parts = Object.values(recommendedBuildPartIds)
  .filter(Boolean)
  .map((id) => seedParts.find((part) => part.id === id)!)
  .filter(Boolean);

describe("decision workspace journey state", () => {
  it("merges supported requirements without clearing older incomplete fields", () => {
    expect(
      mergeCustomerNeeds(
        { budget: 2500, targetUseCase: ["gaming"] },
        { gpuBrandPreference: "nvidia" },
      ),
    ).toEqual({ budget: 2500, targetUseCase: ["gaming"], gpuBrandPreference: "nvidia" });
  });

  it("turns structured advisor actions into requirement proposals", () => {
    expect(needsUpdateFromAdvisorAction({ type: "update_budget", budget: 2200 })).toEqual({
      budget: 2200,
    });
    expect(needsUpdateFromAdvisorAction({ type: "explain_current_build" })).toBeNull();
  });

  it("turns extracted advisor needs into reviewable actions", () => {
    expect(advisorActionsFromNeeds({ budget: 2200, gpuBrandPreference: "nvidia" })).toEqual([
      expect.objectContaining({ type: "update_budget", budget: 2200 }),
      expect.objectContaining({ type: "update_brand_preference", gpuBrandPreference: "nvidia" }),
    ]);
  });

  it("blocks duplicate journey operations until the active one finishes", () => {
    const gate = createOperationGate();
    expect(gate.tryBegin("advisor")).toBe(true);
    expect(gate.tryBegin("advisor")).toBe(false);
    gate.finish("refining");
    expect(gate.current()).toBe("advisor");
    gate.finish("advisor");
    expect(gate.tryBegin("saving")).toBe(true);
  });

  it("prevents an older async response from becoming current", () => {
    const sequence = createRequestSequence();
    const first = sequence.begin();
    const second = sequence.begin();
    expect(sequence.isLatest(first)).toBe(false);
    expect(sequence.isLatest(second)).toBe(true);
    sequence.invalidate();
    expect(sequence.isLatest(second)).toBe(false);
  });

  it("summarizes refined build consequences", () => {
    const current = createSeedBuild(parts, 2500);
    const cheaperGpu = seedParts.find((part) => part.id === "gpu-rtx-4070-ti-super")!;
    const candidate = createSeedBuild(
      current.parts.map((part) => (part.category === "gpu" ? cheaperGpu : part)),
      2400,
    );
    const summary = summarizeBuildChange(current, candidate);
    expect(summary.changedCategories).toContain("gpu");
    expect(summary.totalDelta).toBeLessThan(0);
  });
});

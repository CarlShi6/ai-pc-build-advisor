import { describe, expect, it } from "vitest";
import { seedParts } from "@/data/seedParts";
import {
  budgetOf,
  createDraft,
  fromLegacyBuild,
  primarySlots,
  selectPart,
  slotCategory,
  toSavedBuildPayload,
} from "@/lib/v3/build-document";
import { createGlassFrontFixture } from "@/lib/v3/dev-image-fixture";
import { proposeImageBuild } from "@/lib/v3/image-build";
import { buildShoppingPlan, shoppingPlanJson, shoppingPlanMarkdown } from "@/lib/v3/shopping-plan";

const first = (category: string) => seedParts.find((part) => part.category === category)!;
const cpu = first("cpu");
const gpu = first("gpu");

function partialDraft() {
  return createDraft("import", {
    name: "Plan test",
    budget: 1800,
    parts: [cpu, gpu],
    unresolved: { psu: "Some mystery 1000W PSU" },
  });
}

describe("Studio shopping plan", () => {
  it("lists all eight slots and keeps unknown prices unknown, never $0", () => {
    const plan = buildShoppingPlan(partialDraft());
    expect(plan.lines.map((line) => line.slot)).toEqual([...primarySlots]);
    const psu = plan.lines.find((line) => line.slot === "psu")!;
    expect(psu).toMatchObject({
      status: "unresolved",
      price: null,
      note: "Some mystery 1000W PSU",
    });
    const caseLine = plan.lines.find((line) => line.slot === "case")!;
    expect(caseLine).toMatchObject({ status: "empty", price: null });
    expect(plan.knownSubtotal).toBe(cpu.price + gpu.price);
    expect(plan).toMatchObject({ pricedCount: 2, openCount: 6, complete: false });
  });

  it("never reports an overall pass for an incomplete draft", () => {
    const plan = buildShoppingPlan(partialDraft());
    expect(plan.compatibility).toBe("incomplete");
    const markdown = shoppingPlanMarkdown(plan, new Date("2026-10-25T00:00:00Z"));
    expect(markdown).toContain("Incomplete");
    expect(markdown).not.toMatch(/PASS on/);
  });

  it("labels seed prices and links as references, not live offers", () => {
    const plan = buildShoppingPlan(partialDraft());
    const cpuLine = plan.lines.find((line) => line.slot === "cpu")!;
    expect(cpuLine.priceBasis).toBe("Seed price, not a live quote");
    expect(cpuLine.links.every((link) => link.url.startsWith("http"))).toBe(true);
    expect(cpuLine.links.some((link) => link.kind === "search")).toBe(true);
    const markdown = shoppingPlanMarkdown(plan);
    expect(markdown).toContain("Tax and shipping not included");
    expect(markdown).toContain('Unresolved: "Some mystery 1000W PSU"');
  });

  it("reports the rule result once every slot is filled", () => {
    let draft = createDraft("blank");
    for (const slot of primarySlots) draft = selectPart(draft, slot, first(slotCategory[slot]));
    const plan = buildShoppingPlan(draft);
    expect(plan.complete).toBe(true);
    expect(plan.openCount).toBe(0);
    expect(plan.compatibility).toBe(draft.build.compatibilityStatus);
    expect(plan.findings.every((finding) => finding.severity !== ("pass" as string))).toBe(true);
  });

  it("counts owned parts as $0 without a purchase link", () => {
    const draft = createDraft("blank", { parts: [{ ...cpu, owned: true }] });
    const line = buildShoppingPlan(draft).lines.find((item) => item.slot === "cpu")!;
    expect(line).toMatchObject({ status: "owned", price: 0, links: [] });
  });

  it("exports JSON without observations or image references", () => {
    const draft = createDraft("image", {
      parts: [cpu],
      imageContext: {
        referenceImageId: "ref-1",
        analysisId: "analysis-1",
        imageStored: false,
        observations: [],
        reviews: {},
        visualPriorities: [
          {
            id: "p1",
            category: "colorway",
            value: "white",
            observationId: "obs-1",
            sourceCategory: "case",
            locked: true,
          },
        ],
        plannedSelections: {},
      },
    });
    const json = shoppingPlanJson(buildShoppingPlan(draft), draft);
    expect(json.visualPriorities).toEqual([{ category: "colorway", value: "white", locked: true }]);
    const text = JSON.stringify(json);
    expect(text).not.toContain("ref-1");
    expect(text).not.toContain("obs-1");
  });
});

describe("rule checks that cannot run yet", () => {
  it("lists rules waiting on missing parts as not checked, not as warnings", () => {
    const plan = buildShoppingPlan(partialDraft());
    expect(plan.notChecked.length).toBeGreaterThan(0);
    expect(plan.notChecked.every((rule) => rule.waitingFor.length > 0)).toBe(true);
    const notCheckedLabels = new Set(plan.notChecked.map((rule) => rule.label));
    expect(plan.findings.some((finding) => notCheckedLabels.has(finding.label))).toBe(false);
    expect(shoppingPlanMarkdown(plan)).toContain("Not checked yet");
  });

  it("has nothing waiting once all eight slots are filled", () => {
    let draft = createDraft("blank");
    for (const slot of primarySlots) draft = selectPart(draft, slot, first(slotCategory[slot]));
    expect(buildShoppingPlan(draft).notChecked).toEqual([]);
  });
});

describe("photo drafts without a target budget", () => {
  const fixture = createGlassFrontFixture();
  const photo = proposeImageBuild(fixture, {}, null).candidate;

  it("keeps the budget unset instead of $0, and survives a save round trip", () => {
    expect(photo.budgetUnset).toBe(true);
    expect(budgetOf(photo)).toBeNull();
    const restored = fromLegacyBuild(toSavedBuildPayload(photo));
    expect(restored && budgetOf(restored)).toBeNull();
    // Describe and other drafts keep their number.
    expect(budgetOf(createDraft("describe", { budget: 1800 }))).toBe(1800);
  });

  it("reports the budget as Not set and makes no budget comparison", () => {
    const plan = buildShoppingPlan(photo);
    expect(plan.budget).toBeNull();
    const markdown = shoppingPlanMarkdown(plan);
    expect(markdown).toContain("Budget: Not set");
    // The parts subtotal may be $0 (unknown prices); no budget figure or comparison appears.
    expect(markdown).not.toMatch(/Budget: \$|over budget|under budget|exceed budget/);
    expect(shoppingPlanJson(plan, photo).budget).toBe("Not set");
  });
});

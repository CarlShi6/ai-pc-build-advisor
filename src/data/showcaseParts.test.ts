import { describe, expect, it } from "vitest";
import { seedParts } from "@/data/seedParts";
import { SHOWCASE_PRICE_LABEL, showcaseMeta, showcaseParts } from "@/data/showcaseParts";
import { calculateBuildTotal } from "@/lib/compatibility";
import { catalogForSlot, createDraft } from "@/lib/v3/build-document";
import { catalogPartById, priceCoverage } from "@/lib/v3/catalog";
import { buildShoppingPlan } from "@/lib/v3/shopping-plan";
import { optimizationOptions } from "@/lib/v3/visual-optimization";
import { replaceOptions } from "@/lib/v3/replace-options";

const manufacturerHosts: Record<string, string[]> = {
  "Lian Li": ["lian-li.com"],
  NZXT: ["nzxt.com"],
  Corsair: ["corsair.com"],
  MSI: ["msi.com"],
  ASUS: ["asus.com"],
};
const byId = (id: string) => showcaseParts.find((part) => part.id === id)!;
const host = (url: string) => new URL(url).hostname;
const onHost = (url: string, brand: string) =>
  manufacturerHosts[brand].some(
    (domain) => host(url) === domain || host(url).endsWith(`.${domain}`),
  );

describe("white showcase parts (demo track week 3)", () => {
  it("come only from each manufacturer's own pages, with a verification date", () => {
    expect(showcaseParts.length).toBeGreaterThanOrEqual(8);
    for (const part of showcaseParts) {
      expect(part.color).toBe("White");
      expect(onHost(part.productUrl!, part.brand)).toBe(true);
      if (part.priceSource) expect(onHost(part.priceSource.url, part.brand)).toBe(true);
      expect(showcaseMeta[part.id].verifiedAt).toBe("2026-10-25");
      expect(JSON.stringify(part).toLowerCase()).not.toContain("buildcores");
    }
    expect(new Set(showcaseParts.map((part) => part.partNumber)).size).toBe(showcaseParts.length);
  });

  it("never turns a missing price into $0", () => {
    const unknown = showcaseParts.filter((part) => part.priceStatus === "unknown");
    expect(unknown.map((part) => part.partNumber).sort()).toEqual(["CC-9011201-WW", "O11DEW"]);
    for (const part of showcaseParts)
      expect(!!part.priceSource !== (part.priceStatus === "unknown")).toBe(true);
    const parts = [byId("showcase-case-lianli-o11dew"), byId("showcase-gpu-msi-g507t-16gtcw")];
    expect(priceCoverage(parts)).toEqual({ known: 1249.99, unknown: 1 });
    expect(calculateBuildTotal(parts)).toBe(1249.99);
  });

  it("keeps published millimetre dimensions consistent with the printed text", () => {
    for (const [id, meta] of Object.entries(showcaseMeta)) {
      if (!meta.dimensions?.mm) continue;
      for (const value of Object.values(meta.dimensions.mm))
        expect(meta.dimensions.asPublished, id).toContain(String(value));
    }
    // Unitless or missing published sizes stay without millimetres.
    expect(showcaseMeta["showcase-cooler-corsair-cw-9061021-ww"].dimensions?.mm).toBeUndefined();
    expect(showcaseMeta["showcase-ram-corsair-cmh32gx5m2b6000c30w"].dimensions).toBeNull();
  });

  it("join the v3 catalog only, leaving the pre-v3 seed catalog unchanged", () => {
    expect(seedParts.some((part) => part.id.startsWith("showcase-"))).toBe(false);
    expect(catalogForSlot("case").map((part) => part.id)).toContain(
      "showcase-case-nzxt-cc-h52fw-01",
    );
    expect(catalogPartById("showcase-psu-corsair-cp-9020274-na")?.specs.wattageW).toBe(850);
  });
});

describe("white showcase build", () => {
  const cpu = seedParts.find((part) => part.id === "cpu-i7-14700k")!;
  const board = seedParts.find(
    (part) => part.category === "motherboard" && part.specs.socket === "LGA1700",
  )!;
  const storage = seedParts.find((part) => part.category === "ssd")!;
  const white = [
    "showcase-case-lianli-o11dew",
    "showcase-gpu-msi-g507t-16gtcw",
    "showcase-cooler-corsair-cw-9061021-ww",
    "showcase-ram-corsair-cmh32gx5m2b6000c30w",
    "showcase-psu-corsair-cp-9020274-na",
  ].map(byId);
  const draft = createDraft("describe", { parts: [cpu, board, storage, ...white] });

  it("checks rules from manufacturer clearances and leaves missing data as not checked", () => {
    const check = (id: string) =>
      draft.build.compatibilityChecks.find((item) => item.id === id)?.severity;
    expect(check("gpu-case-clearance")).toBe("pass"); // 338 mm card vs 426 mm clearance
    // The NZXT case has no radiator figure from its page, so the AIO check can't pass.
    const nzxt = createDraft("describe", {
      parts: [cpu, board, storage, ...white.slice(1), byId("showcase-case-nzxt-cc-h52fw-01")],
    });
    const aio = nzxt.build.compatibilityChecks.find((item) =>
      item.message.includes("radiator support data is missing"),
    );
    expect(aio?.severity).not.toBe("pass");
  });

  it("shows manufacturer prices with their source and unknown prices as unknown", () => {
    const plan = buildShoppingPlan(draft);
    const caseLine = plan.lines.find((line) => line.slot === "case")!;
    const gpuLine = plan.lines.find((line) => line.slot === "gpu")!;
    expect(caseLine.price).toBeNull();
    expect(caseLine.priceBasis).toBe("Price unknown");
    expect(gpuLine.price).toBe(1249.99);
    expect(gpuLine.priceBasis).toBe(SHOWCASE_PRICE_LABEL);
    expect(caseLine.links.find((link) => link.kind === "official")?.url).toBe(
      "https://lian-li.com/product/o11-dynamic-evo/",
    );
  });

  it("never ranks or diffs against an unknown price", () => {
    expect(optimizationOptions(draft, "case", "reduce_cost")).toEqual([]);
    const { options } = replaceOptions(draft, "case");
    expect(options.every((option) => option.priceDelta === null)).toBe(true);
    expect(options[0].totalAfter.unknown + options[0].totalAfter.known).toBeGreaterThan(0);
  });
});

describe("white showcase parts in photo review", () => {
  it("match a white case photo with manufacturer-sourced, appearance-only candidates", async () => {
    const { createImageAnalysisResult } = await import("@/lib/v3/image-contract");
    const { matchVisualCandidates } = await import("@/lib/v3/candidate-matcher");
    const analysis = createImageAnalysisResult(
      {
        summary: "White showcase PC",
        quality: "clear",
        qualityIssues: [],
        observations: [
          {
            category: "case",
            attribute: "color",
            value: "white",
            evidence: "White panels and frame.",
            origin: "observed",
            confidenceBand: "medium",
            visibleInImage: true,
            region: null,
          },
        ],
      },
      { mime: "image/png", width: 512, height: 512 },
    );
    const cases = matchVisualCandidates(analysis).find((set) => set.category === "case")!;
    expect(cases.status).toBe("candidates");
    for (const candidate of cases.candidates) {
      // Showcase and Step C parts, both from manufacturer pages.
      expect(candidate.partId).toMatch(/^(showcase|maker)-case-/);
      expect(candidate.identityEvidence).toBe("appearance_only");
      expect(candidate.catalogSourceUrl).toBe(catalogPartById(candidate.partId)?.productUrl);
    }
  });
});

describe("shopping plan summary with an unknown price", () => {
  it("doesn't claim every slot is priced", () => {
    const parts = ["showcase-case-lianli-o11dew", "showcase-gpu-msi-g507t-16gtcw"].map(byId);
    const plan = buildShoppingPlan(createDraft("describe", { parts }));
    expect(plan.unknownPriceCount).toBe(1);
    expect(plan.pricedCount).toBe(1);
  });
});

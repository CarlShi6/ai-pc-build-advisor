import { createDraft, type BuildDocumentV3, type SlotId } from "@/lib/v3/build-document";
import { catalogPartById } from "@/lib/v3/catalog";

/**
 * The white showcase sample (demo track week 3): one click to a complete eight-part Build.
 * White parts come from `showcaseParts` (manufacturer pages, verified 2026-10-25). The catalog has
 * no white motherboard, CPU or SSD, so those three are seed parts and the Studio says so.
 * It is an ordinary draft afterwards: nothing is saved until the user saves it.
 */
export const WHITE_SHOWCASE_SAMPLE: Record<SlotId, string> = {
  case: "showcase-case-lianli-o11dew",
  motherboard: "mobo-z790-hero",
  cpu: "cpu-i7-14700k",
  cooler: "showcase-cooler-corsair-cw-9061021-ww",
  gpu: "showcase-gpu-msi-g507t-16gtcw",
  memory: "showcase-ram-corsair-cmh32gx5m2b6000c30w",
  storage: "ssd-990-pro-2tb",
  psu: "showcase-psu-corsair-cp-9020274-na",
};

export const WHITE_SHOWCASE_NAME = "White showcase sample";

export function createWhiteShowcaseSample(): BuildDocumentV3 {
  const parts = Object.values(WHITE_SHOWCASE_SAMPLE).map((id) => {
    const part = catalogPartById(id);
    if (!part) throw new Error(`Showcase sample part ${id} is missing from the catalog.`);
    return part;
  });
  return createDraft("sample", {
    name: WHITE_SHOWCASE_NAME,
    budget: 4000,
    useCases: ["gaming"],
    parts,
  });
}

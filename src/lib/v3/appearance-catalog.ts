import { curatedFans } from "@/data/curatedFans";
import { caseAppearance, type FrontPanelMaterial } from "@/data/showcaseParts";
import { v3Catalog } from "@/lib/v3/catalog";
import type { Part, PartCategory } from "@/types/parts";

export const visibleCatalogCategories = [
  "case",
  "gpu",
  "cooler",
  "fan",
  "motherboard",
  "memory",
] as const;
export type VisibleCatalogCategory = (typeof visibleCatalogCategories)[number];

export interface AppearanceProfile {
  id: string;
  displayName: string;
  category: VisibleCatalogCategory;
  color: string | null;
  style: string | null;
  coolerType: string | null;
  /** Lighting type when the source states it (fans), otherwise null. */
  lighting: string | null;
  /** Cases only, from the manufacturer page (src/data/showcaseParts.ts); null = unknown. */
  frontPanel: FrontPanelMaterial | null;
  caseLayout: "dual-chamber" | null;
  appearanceVerifiedAt: string | null;
  identityText: string;
  specFieldCount: number;
  catalogSourceId: string;
  provenance: "local_seed_catalog" | "manufacturer_page";
  sourceUrl: string | null;
  verifiedAt: string | null;
}

/** The visible category each catalog part category is matched under (memory parts are "ram"). */
const visibleCategoryOf: Partial<Record<PartCategory, VisibleCatalogCategory>> = {
  case: "case",
  gpu: "gpu",
  cooler: "cooler",
  motherboard: "motherboard",
  ram: "memory",
};

/** Memory lighting: the stated lighting spec, or RGB when the model name says so. */
function memoryLighting(part: Part) {
  if (typeof part.specs.lighting === "string") return part.specs.lighting;
  return /\brgb\b/i.test(part.model) ? "RGB" : null;
}

const seedProfiles: AppearanceProfile[] = v3Catalog
  .filter((part) => visibleCategoryOf[part.category])
  .map((part) => {
    // Showcase and Step C parts come from manufacturer pages (src/data/showcaseParts.ts and
    // src/data/catalogExpansion.ts).
    const showcase = part.compatibilityTags.includes("white-showcase");
    const expansion = part.compatibilityTags.includes("maker-sourced");
    const category = visibleCategoryOf[part.category]!;
    return {
      id: part.id,
      displayName: part.displayName,
      category,
      color: part.color ?? (typeof part.specs.color === "string" ? part.specs.color : null),
      style: typeof part.specs.style === "string" ? part.specs.style : null,
      coolerType: typeof part.specs.coolerType === "string" ? part.specs.coolerType : null,
      lighting: category === "memory" ? memoryLighting(part) : null,
      frontPanel: caseAppearance[part.id]?.frontPanel ?? null,
      caseLayout: caseAppearance[part.id]?.layout ?? null,
      appearanceVerifiedAt: caseAppearance[part.id]?.verifiedAt ?? null,
      identityText: `${part.brand} ${part.model}`,
      specFieldCount: Object.keys(part.specs).length,
      catalogSourceId: `${showcase ? "showcaseParts" : expansion ? "catalogExpansion" : "seedParts"}:${part.id}`,
      provenance:
        showcase || expansion ? ("manufacturer_page" as const) : ("local_seed_catalog" as const),
      sourceUrl: showcase || expansion ? (part.productUrl ?? null) : null,
      verifiedAt: showcase || expansion ? (part.lastUpdated ?? null) : null,
    };
  });

const fanSpecFields = [
  "thicknessMm",
  "lightingConnector",
  "fanConnector",
  "maxRpm",
  "maxAirflowCfm",
  "maxNoiseDba",
] as const;

// Hand-curated from manufacturer pages (src/data/curatedFans.ts); fans are not Build slots.
const fanProfiles: AppearanceProfile[] = curatedFans.map((fan) => ({
  id: fan.id,
  displayName: fan.displayName,
  category: "fan",
  color: fan.color,
  style: null,
  coolerType: null,
  lighting: fan.lighting,
  frontPanel: null,
  caseLayout: null,
  appearanceVerifiedAt: null,
  identityText: `${fan.brand} ${fan.model} ${fan.partNumber}`,
  specFieldCount: 1 + fanSpecFields.filter((field) => fan[field] !== null).length,
  catalogSourceId: `curatedFans:${fan.id}`,
  provenance: "manufacturer_page",
  sourceUrl: fan.sourceUrl,
  verifiedAt: fan.verifiedAt,
}));

export const appearanceProfiles: AppearanceProfile[] = [...seedProfiles, ...fanProfiles];

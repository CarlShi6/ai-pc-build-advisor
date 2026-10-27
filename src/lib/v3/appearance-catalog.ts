import { curatedFans } from "@/data/curatedFans";
import { caseAppearance, type FrontPanelMaterial } from "@/data/showcaseParts";
import { v3Catalog } from "@/lib/v3/catalog";
import type { PartCategory } from "@/types/parts";

export const visibleCatalogCategories = ["case", "gpu", "cooler", "fan", "motherboard"] as const;
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

const allowed = new Set<PartCategory>(visibleCatalogCategories);

const seedProfiles: AppearanceProfile[] = v3Catalog
  .filter((part) => allowed.has(part.category))
  .map((part) => {
    // White showcase parts come from manufacturer pages (src/data/showcaseParts.ts).
    const showcase = part.compatibilityTags.includes("white-showcase");
    return {
      id: part.id,
      displayName: part.displayName,
      category: part.category as VisibleCatalogCategory,
      color: part.color ?? (typeof part.specs.color === "string" ? part.specs.color : null),
      style: typeof part.specs.style === "string" ? part.specs.style : null,
      coolerType: typeof part.specs.coolerType === "string" ? part.specs.coolerType : null,
      lighting: null,
      frontPanel: caseAppearance[part.id]?.frontPanel ?? null,
      caseLayout: caseAppearance[part.id]?.layout ?? null,
      appearanceVerifiedAt: caseAppearance[part.id]?.verifiedAt ?? null,
      identityText: `${part.brand} ${part.model}`,
      specFieldCount: Object.keys(part.specs).length,
      catalogSourceId: `${showcase ? "showcaseParts" : "seedParts"}:${part.id}`,
      provenance: showcase ? ("manufacturer_page" as const) : ("local_seed_catalog" as const),
      sourceUrl: showcase ? (part.productUrl ?? null) : null,
      verifiedAt: showcase ? (part.lastUpdated ?? null) : null,
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

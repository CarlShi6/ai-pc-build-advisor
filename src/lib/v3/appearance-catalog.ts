import { seedParts } from "@/data/seedParts";
import type { Part, PartCategory } from "@/types/parts";

export const visibleCatalogCategories = ["case", "gpu", "cooler", "fan", "motherboard"] as const;
export type VisibleCatalogCategory = (typeof visibleCatalogCategories)[number];

export interface AppearanceProfile {
  part: Part;
  category: VisibleCatalogCategory;
  color: string | null;
  style: string | null;
  coolerType: string | null;
  identityText: string;
  provenance: "local_seed_catalog";
}

const allowed = new Set<PartCategory>(visibleCatalogCategories);

export const appearanceProfiles: AppearanceProfile[] = seedParts
  .filter((part) => allowed.has(part.category))
  .map((part) => ({
    part,
    category: part.category as VisibleCatalogCategory,
    color: part.color ?? (typeof part.specs.color === "string" ? part.specs.color : null),
    style: typeof part.specs.style === "string" ? part.specs.style : null,
    coolerType: typeof part.specs.coolerType === "string" ? part.specs.coolerType : null,
    identityText: `${part.brand} ${part.model}`,
    provenance: "local_seed_catalog" as const,
  }));

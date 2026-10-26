import { seedParts } from "@/data/seedParts";
import { showcaseParts } from "@/data/showcaseParts";
import type { Part } from "@/types/parts";

/** The v3 catalog: the existing seed parts plus the manufacturer-sourced white showcase parts. */
export const v3Catalog: Part[] = [...seedParts, ...showcaseParts];

export function catalogPartById(id: string): Part | undefined {
  return v3Catalog.find((part) => part.id === id);
}

/** True when the catalog has no price for this part (it is excluded from totals). */
export function priceUnknown(part: Part): boolean {
  return part.priceStatus === "unknown" || !Number.isFinite(part.price) || part.price < 0;
}

/** Known total for parts still to buy, plus how many prices are unknown. */
export function priceCoverage(parts: Part[]) {
  let known = 0;
  let unknown = 0;
  for (const part of parts) {
    if (part.owned) continue;
    if (priceUnknown(part)) unknown += 1;
    else known += part.price;
  }
  return { known, unknown };
}

/** Where a part's price comes from, for labels next to the number. */
export function priceBasisLabel(part: Part): string {
  if (priceUnknown(part)) return "Price unknown";
  return part.priceSource?.label ?? "Seed price, not a live quote";
}

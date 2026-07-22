export type BestBuySkuMapping = Readonly<Record<string, string>>;

// Intentionally empty until each production SKU is manually verified against the exact
// canonical part variant. Tests inject deterministic fixture mappings.
export const VERIFIED_BEST_BUY_SKUS: BestBuySkuMapping = Object.freeze({});

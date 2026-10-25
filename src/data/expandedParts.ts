import type { Part } from "@/types/parts";

// Official specification URLs are stored with each entry. Prices are planning
// estimates, not current quotes. Board-partner dimensions must not be inferred.
const cpu = (id: string, model: string, cores: number, tdpW: number, price: number): Part => ({
  id, category: "cpu", brand: "AMD", model, displayName: `AMD ${model}`, price,
  source: "catalog", availability: "unknown",
  productUrl: `https://www.amd.com/en/products/processors/desktops/ryzen/9000-series/amd-${model.toLowerCase().replaceAll(' ', '-')}.html`,
  specs: { socket: "AM5", cores, threads: cores * 2, tdpW, priceBasis: "Planning estimate, not a retailer quote", biosCheck: "Verify board BIOS support for Ryzen 9000" },
  compatibilityTags: ["amd", "am5", "ddr5", "bios-verification-required"],
  recommendationReason: "AM5 option with manufacturer specifications. Verify motherboard BIOS support. Price is a planning estimate; current stock is unknown.",
});
const gpu = (id: string, model: string, vramGb: number, powerDrawW: number, recommendedPsuW: number, price: number, page: string, lengthMm?: number): Part => ({
  id, category: "gpu", brand: "NVIDIA", model,
  displayName: `NVIDIA GeForce ${model}${lengthMm ? " Founders Edition" : " (reference specifications)"}`,
  price, source: "catalog", availability: "unknown", productUrl: `https://www.nvidia.com/en-us/geforce/graphics-cards/50-series/${page}/`,
  specs: { vramGb, powerDrawW, recommendedPsuW, memoryType: "GDDR7", ...(lengthMm ? { lengthMm } : {}), priceBasis: "Planning estimate, not a retailer quote" },
  compatibilityTags: ["nvidia", "blackwell", "pcie", "verify-power-connector"],
  recommendationReason: "Blackwell option with manufacturer reference specifications. Check exact card dimensions, PSU cable support, retailer price and stock before buying.",
});
export const expandedParts: Part[] = [
  cpu("cpu-r5-9600x", "Ryzen 5 9600X", 6, 65, 279),
  cpu("cpu-r7-9700x", "Ryzen 7 9700X", 8, 65, 359),
  cpu("cpu-r7-9800x3d", "Ryzen 7 9800X3D", 8, 120, 479),
  cpu("cpu-r9-9900x", "Ryzen 9 9900X", 12, 120, 499),
  gpu("gpu-rtx-5070-fe", "RTX 5070", 12, 250, 650, 549, "rtx-5070-family", 242),
  gpu("gpu-rtx-5070-ti-reference", "RTX 5070 Ti", 16, 300, 750, 749, "rtx-5070-family"),
  gpu("gpu-rtx-5080-fe", "RTX 5080", 16, 360, 850, 999, "rtx-5080", 304),
  gpu("gpu-rtx-5090-fe", "RTX 5090", 32, 575, 1000, 1999, "rtx-5090", 304),
];

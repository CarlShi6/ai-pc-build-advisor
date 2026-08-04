import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle, ArrowDownRight, ArrowRight, BadgeCheck, Bot, Box, Check,
  CheckCircle2, ChevronRight, CircleDollarSign, ClipboardList, Cpu, Fan, Gauge,
  GitCompareArrows, HardDrive, ImageOff, Layers3, MemoryStick, MonitorCog,
  PackageCheck, PanelLeft, Power, Send, ShieldCheck, ShoppingBag,
  SlidersHorizontal, Sparkles, Target, X, Zap, Search, Copy, Download,
  ExternalLink, Store, Thermometer,
} from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type ComponentType, type KeyboardEvent } from "react";
import { seedParts, recommendedBuildPartIds, categoryLabels } from "@/data/seedParts";
import { getPartDecisionMetadata } from "@/lib/decision-metadata";
import {
  createSeedBuild, estimateBuildPower, getValidatedOfficialUrl, getValidatedPurchaseUrl,
  replaceBuildPartLocally, trustedAvailability, trustedPartPrice, trustForPart,
} from "@/lib/product-trust";
import type { Build, PartDecisionMetadata } from "@/types/build";
import type { Part as CanonicalPart, PartCategory } from "@/types/parts";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AI PC Build Advisor - Decision Workspace" },
      { name: "description", content: "A visual workspace for choosing, comparing, and purchasing a compatible custom PC build." },
    ],
  }),
  component: BuildWorkspace,
});

type Part = {
  id: string; category: string; eyebrow: string; name: string; price: number;
  retailer: string; stock: string; stockTone: "good" | "low"; specs: string[];
  reason: string; Icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  visual: string; compatibility: string; manufacturer?: string; officialUrl?: string;
};

function mockOfficialUrl(manufacturer: string, id: string) {
  void manufacturer;
  void id;
  return undefined;
}

const legacyPrototypeParts: Part[] = ([
  { id: "cpu", category: "Processor", eyebrow: "CPU", name: "AMD Ryzen 7 7800X3D", price: 369, retailer: "Newegg", stock: "In stock", stockTone: "good", specs: ["8 cores / 16 threads", "Up to 5.0 GHz", "96MB L3 cache", "120W TDP"], reason: "Best-in-class gaming performance without overspending on cores you won’t use.", Icon: Cpu, visual: "cpu", compatibility: "Fits AM5 platform" },
  { id: "gpu", category: "Graphics", eyebrow: "GPU", name: "NVIDIA GeForce RTX 4080 SUPER 16GB", price: 999, retailer: "Best Buy", stock: "In stock", stockTone: "good", specs: ["16GB GDDR6X", "10240 CUDA cores", "320W board power", "DLSS 3.5"], reason: "The strongest fit for 1440p high refresh and smooth 4K without 4090 pricing.", Icon: MonitorCog, visual: "gpu", compatibility: "Clearance verified" },
  { id: "motherboard", category: "Motherboard", eyebrow: "BOARD", name: "MSI MAG B650 Tomahawk WiFi", price: 219, retailer: "Amazon", stock: "In stock", stockTone: "good", specs: ["AM5 socket", "DDR5", "Wi‑Fi 6E", "3× M.2 slots"], reason: "Reliable power delivery and the connectivity you need, without enthusiast extras.", Icon: Cpu, visual: "board", compatibility: "BIOS ready" },
  { id: "ram", category: "Memory", eyebrow: "RAM", name: "G.Skill Flare X5 32GB DDR5-6000", price: 104, retailer: "Newegg", stock: "Low stock", stockTone: "low", specs: ["32GB (2×16GB)", "DDR5-6000", "CL30 latency", "AMD EXPO"], reason: "The AM5 sweet spot: enough capacity for gaming, streaming, and everyday creation.", Icon: MemoryStick, visual: "ram", compatibility: "EXPO profile supported" },
  { id: "ssd", category: "Storage", eyebrow: "SSD", name: "Samsung 990 PRO 2TB NVMe", price: 169, retailer: "Amazon", stock: "In stock", stockTone: "good", specs: ["2TB capacity", "7,450 MB/s read", "PCIe 4.0", "5-year warranty"], reason: "Fast enough for large game libraries and creator files with room to grow.", Icon: HardDrive, visual: "ssd", compatibility: "M.2 slot available" },
  { id: "cooler", category: "CPU Cooler", eyebrow: "COOLING", name: "Arctic Liquid Freezer III 360", price: 119, retailer: "Amazon", stock: "In stock", stockTone: "good", specs: ["360mm radiator", "3× 120mm fans", "AM5 ready", "PWM control"], reason: "Quiet thermal headroom keeps boost clocks stable during long sessions.", Icon: Fan, visual: "cooler", compatibility: "Top mount verified" },
  { id: "psu", category: "Power Supply", eyebrow: "PSU", name: "Corsair RM850x 850W 80+ Gold", price: 139, retailer: "Best Buy", stock: "In stock", stockTone: "good", specs: ["850W output", "80+ Gold", "Fully modular", "ATX 3.1"], reason: "Meets this build’s demand with efficient, quiet power and modern GPU support.", Icon: Power, visual: "psu", compatibility: "Review upgrade headroom" },
  { id: "case", category: "Case", eyebrow: "CHASSIS", name: "Fractal Design North XL", price: 179, retailer: "Newegg", stock: "In stock", stockTone: "good", specs: ["Full tower", "Mesh front", "GPU up to 413mm", "Tempered glass"], reason: "Excellent airflow with a refined look and effortless room for every selected part.", Icon: Box, visual: "case", compatibility: "All dimensions verified" },
] satisfies Part[]).map((part: Part) => {
  const manufacturer = part.manufacturer ?? part.name.split(" ")[0];
  return { ...part, manufacturer, officialUrl: mockOfficialUrl(manufacturer, part.id) };
});

const legacyPrototypeReplacement = { name: "NVIDIA GeForce RTX 4070 Ti SUPER 16GB", price: 799 };

type ComparisonProduct = {
  id: string;
  name: string;
  price: number;
  retailer: string;
  manufacturer?: string;
  officialUrl?: string;
  label: string;
  compatibility: string;
  gaming: string;
  productivity: string;
  value: string;
  vram: string;
  power: string;
  psu: string;
  length: string;
  resolution: string;
  performanceDelta: string;
  disabled?: boolean;
  availability?: string;
};

function legacyPrototypeComparisonCatalog(part: Part): ComparisonProduct[] {
  if (part.id === "gpu") {
    const gpuProducts: ComparisonProduct[] = [
      { id: "4080s", name: part.name, price: 999, retailer: "Best Buy", label: "CURRENT PICK", compatibility: "Fully compatible", gaming: "Excellent · 98/100", productivity: "Excellent · 94/100", value: "86/100", vram: "16GB GDDR6X", power: "320W", psu: "750W", length: "304mm", resolution: "1440p ultra / 4K", performanceDelta: "Baseline" },
      { id: "4070tis", name: "NVIDIA GeForce RTX 4070 Ti SUPER 16GB", price: 799, retailer: "Newegg", label: "AI PICK", compatibility: "Fully compatible", gaming: "Excellent · 91/100", productivity: "Excellent · 89/100", value: "94/100", vram: "16GB GDDR6X", power: "285W", psu: "700W", length: "285mm", resolution: "1440p ultra", performanceDelta: "−8% at 1440p" },
      { id: "7900xt", name: "AMD Radeon RX 7900 XT 20GB", price: 699, retailer: "Amazon", label: "BEST VALUE", compatibility: "Fully compatible", gaming: "Excellent · 93/100", productivity: "Strong · 80/100", value: "97/100", vram: "20GB GDDR6", power: "315W", psu: "750W", length: "276mm", resolution: "1440p ultra / 4K", performanceDelta: "−5% raster" },
      { id: "5070ti", name: "NVIDIA GeForce RTX 5070 Ti 16GB", price: 749, retailer: "Newegg", label: "USER CHOICE", compatibility: "Fully compatible", gaming: "Excellent · 94/100", productivity: "Excellent · 91/100", value: "95/100", vram: "16GB GDDR7", power: "300W", psu: "750W", length: "300mm", resolution: "1440p ultra / 4K", performanceDelta: "−3% at 1440p" },
      { id: "4070s", name: "NVIDIA GeForce RTX 4070 SUPER 12GB", price: 599, retailer: "Best Buy", label: "LOWER COST", compatibility: "Fully compatible", gaming: "Strong · 84/100", productivity: "Strong · 82/100", value: "96/100", vram: "12GB GDDR6X", power: "220W", psu: "650W", length: "267mm", resolution: "1440p high", performanceDelta: "−18% at 1440p" },
      { id: "4070", name: "NVIDIA GeForce RTX 4070 12GB", price: 529, retailer: "Amazon", label: "EFFICIENT PICK", compatibility: "Fully compatible", gaming: "Strong · 79/100", productivity: "Strong · 78/100", value: "91/100", vram: "12GB GDDR6X", power: "200W", psu: "650W", length: "244mm", resolution: "1440p high", performanceDelta: "−23% at 1440p" },
      { id: "7800xt", name: "AMD Radeon RX 7800 XT 16GB", price: 499, retailer: "Newegg", label: "VALUE PICK", compatibility: "Fully compatible", gaming: "Strong · 82/100", productivity: "Good · 73/100", value: "98/100", vram: "16GB GDDR6", power: "263W", psu: "700W", length: "267mm", resolution: "1440p high", performanceDelta: "−19% raster" },
      { id: "7900gre", name: "AMD Radeon RX 7900 GRE 16GB", price: 549, retailer: "Best Buy", label: "BALANCED PICK", compatibility: "Fully compatible", gaming: "Strong · 85/100", productivity: "Good · 76/100", value: "96/100", vram: "16GB GDDR6", power: "260W", psu: "700W", length: "280mm", resolution: "1440p ultra", performanceDelta: "−15% raster" },
      { id: "5060ti", name: "NVIDIA GeForce RTX 5060 Ti 16GB", price: 449, retailer: "Amazon", label: "ENTRY PICK", compatibility: "Fully compatible", gaming: "Good · 73/100", productivity: "Good · 76/100", value: "90/100", vram: "16GB GDDR7", power: "180W", psu: "600W", length: "242mm", resolution: "1440p", performanceDelta: "−29% at 1440p" },
      { id: "4090", name: "NVIDIA GeForce RTX 4090 24GB", price: 1799, retailer: "Unavailable", availability: "Currently unavailable", disabled: true, label: "FLAGSHIP", compatibility: "Requires PSU review", gaming: "Exceptional · 100/100", productivity: "Exceptional · 100/100", value: "61/100", vram: "24GB GDDR6X", power: "450W", psu: "1000W", length: "336mm", resolution: "4K ultra", performanceDelta: "+27% at 4K" },
    ];
    return gpuProducts.map((product) => {
      const manufacturer = product.name.startsWith("AMD") ? "AMD" : "NVIDIA";
      return { ...product, manufacturer, officialUrl: mockOfficialUrl(manufacturer, product.id) };
    });
  }

  const genericProducts: ComparisonProduct[] = [
    { id: `${part.id}-current`, name: part.name, price: part.price, retailer: part.retailer, label: "CURRENT PICK", compatibility: part.compatibility, gaming: "Excellent fit", productivity: "Strong fit", value: "89/100", vram: part.specs[0], power: part.specs[3] ?? "Optimized", psu: "No change", length: "Fit verified", resolution: "Build target met", performanceDelta: "Baseline" },
    { id: `${part.id}-ai`, name: `${part.category} Performance Alternative`, price: Math.max(79, part.price - 30), retailer: "Newegg", label: "AI PICK", compatibility: "Fully compatible", gaming: "Excellent fit", productivity: "Excellent fit", value: "94/100", vram: part.specs[0], power: "Lower draw", psu: "No change", length: "Fit verified", resolution: "Build target met", performanceDelta: "+3% target workload" },
    { id: `${part.id}-value`, name: `${part.category} Value Alternative`, price: Math.max(59, part.price - 65), retailer: "Amazon", label: "BEST VALUE", compatibility: "Fully compatible", gaming: "Strong fit", productivity: "Strong fit", value: "97/100", vram: part.specs[0], power: "Lower draw", psu: "No change", length: "Fit verified", resolution: "Build target met", performanceDelta: "−4% target workload" },
    { id: `${part.id}-user`, name: `${part.category} User-Selected Option`, price: part.price + 35, retailer: "Best Buy", label: "USER CHOICE", compatibility: "Compatible with note", gaming: "Excellent fit", productivity: "Excellent fit", value: "86/100", vram: part.specs[0], power: "Slightly higher", psu: "Review advised", length: "Fit verified", resolution: "Build target exceeded", performanceDelta: "+5% target workload" },
  ];
  const manufacturer = part.manufacturer ?? part.name.split(" ")[0];
  return genericProducts.map((product) => ({
    ...product,
    manufacturer,
    officialUrl: part.officialUrl ?? mockOfficialUrl(manufacturer, product.id),
  }));
}

type CanonicalViewPart = Part & {
  canonical: CanonicalPart;
  purchaseUrl?: string;
  trustLabel: string;
  trustDetail: string;
};

type CanonicalComparisonProduct = ComparisonProduct & {
  canonical: CanonicalPart;
  metadata: PartDecisionMetadata;
  priceTrustLabel: string;
};

const categoryIcons: Record<PartCategory, ComponentType<{ size?: number; strokeWidth?: number }>> = {
  cpu: Cpu, gpu: MonitorCog, motherboard: Cpu, ram: MemoryStick, ssd: HardDrive,
  psu: Power, case: Box, cooler: Fan, os: HardDrive, fan: Fan, accessory: Layers3,
};

const categoryVisuals: Record<PartCategory, string> = {
  cpu: "cpu", gpu: "gpu", motherboard: "board", ram: "ram", ssd: "ssd",
  psu: "psu", case: "case", cooler: "cooler", os: "ssd", fan: "cooler", accessory: "board",
};

function formatCanonicalSpec(key: string, value: string | number | boolean) {
  const units: Record<string, string> = {
    tdpW: "W TDP", powerDrawW: "W draw", wattageW: "W", lengthMm: "mm",
    capacityGb: "GB", capacityTb: "TB", speedMt: " MT/s", boostGHz: " GHz boost",
    vramGb: "GB VRAM", readMb: " MB/s read", radiatorMm: "mm radiator",
  };
  if (key in units) return `${value}${units[key]}`;
  return `${key.replace(/([A-Z])/g, " $1").toLowerCase()}: ${String(value)}`;
}

function adaptCanonicalPart(part: CanonicalPart, build: Build): CanonicalViewPart {
  const checks = build.compatibilityChecks.filter((check) => check.affectedPartIds.includes(part.id));
  const priorityCheck = checks.find((check) => check.severity === "fail")
    ?? checks.find((check) => check.severity === "warning");
  const availability = trustedAvailability(part).value ?? "unknown";
  const trust = trustForPart(part);
  return {
    canonical: part,
    id: part.id,
    category: categoryLabels[part.category],
    eyebrow: categoryLabels[part.category],
    name: part.displayName,
    price: trustedPartPrice(part).value ?? Number.NaN,
    retailer: part.retailer ?? "Retailer unavailable",
    stock: availability === "in_stock" ? "In stock" : availability === "low_stock" ? "Low stock" : availability === "out_of_stock" ? "Out of stock" : "Stock unknown",
    stockTone: availability === "in_stock" ? "good" : "low",
    specs: Object.entries(part.specs).slice(0, 4).map(([key, value]) => formatCanonicalSpec(key, value)),
    reason: part.recommendationReason ?? "Selection rationale unavailable in the current catalog.",
    Icon: categoryIcons[part.category],
    visual: categoryVisuals[part.category],
    compatibility: priorityCheck?.message ?? (checks.length ? `${checks.filter((check) => check.severity === "pass").length} applicable checks passed` : "Compatibility data incomplete"),
    manufacturer: part.brand,
    officialUrl: getValidatedOfficialUrl(part) ?? undefined,
    purchaseUrl: getValidatedPurchaseUrl(part) ?? undefined,
    trustLabel: trust.source === "seed" ? "Seed data" : trust.source,
    trustDetail: trust.disclosure ?? "Source details unavailable.",
  };
}

function getNumericSpec(part: CanonicalPart, key: string) {
  const value = part.specs[key];
  return typeof value === "number" ? value : null;
}

function getTextSpec(part: CanonicalPart, key: string) {
  const value = part.specs[key];
  return typeof value === "string" ? value : null;
}

function canonicalComparisonCatalog(part: CanonicalViewPart, build: Build): CanonicalComparisonProduct[] {
  const candidates = seedParts.filter((candidate) => candidate.category === part.canonical.category);
  const ordered = [part.canonical, ...candidates.filter((candidate) => candidate.id !== part.id)];
  const decisions = getPartDecisionMetadata(build, ordered, part.canonical);
  const baseline = decisions.find((decision) => decision.partId === part.id)?.performanceScore ?? null;
  return ordered.map((candidate, index) => {
    const metadata = decisions.find((decision) => decision.partId === candidate.id)!;
    const score = metadata.performanceScore;
    const performanceDelta = candidate.id === part.id ? "Baseline" : score !== null && baseline !== null ? `${score - baseline > 0 ? "+" : ""}${score - baseline} points` : "Unknown";
    const availability = trustedAvailability(candidate).value ?? "unknown";
    return {
      canonical: candidate,
      metadata,
      id: candidate.id,
      name: candidate.displayName,
      price: trustedPartPrice(candidate).value ?? Number.NaN,
      retailer: candidate.retailer ?? "Retailer unavailable",
      manufacturer: candidate.brand,
      officialUrl: getValidatedOfficialUrl(candidate) ?? undefined,
      label: candidate.id === part.id ? "CURRENT PICK" : metadata.bestValue ? "AI OPTION" : index === 2 ? "USER OPTION" : "CATALOG OPTION",
      compatibility: metadata.compatibilityImpact.summary,
      gaming: getNumericSpec(candidate, "gaming1440pScore") !== null ? `${getNumericSpec(candidate, "gaming1440pScore")}/100 · Seed spec` : score !== null ? `${score}/100 · Derived` : "Unknown",
      productivity: getNumericSpec(candidate, "productivityScore") !== null ? `${getNumericSpec(candidate, "productivityScore")}/100 · Seed spec` : "Unknown",
      value: `${metadata.valueScore}/100 · Derived`,
      vram: getNumericSpec(candidate, "vramGb") !== null ? `${getNumericSpec(candidate, "vramGb")}GB` : candidate.specSummary ?? "Unknown",
      power: getNumericSpec(candidate, "powerDrawW") !== null ? `${getNumericSpec(candidate, "powerDrawW")}W · Seed spec` : getNumericSpec(candidate, "tdpW") !== null ? `${getNumericSpec(candidate, "tdpW")}W · Seed spec` : "Unknown",
      psu: getNumericSpec(candidate, "recommendedPsuW") !== null ? `${getNumericSpec(candidate, "recommendedPsuW")}W` : "Unknown",
      length: getNumericSpec(candidate, "lengthMm") !== null ? `${getNumericSpec(candidate, "lengthMm")}mm` : "Unknown",
      resolution: getTextSpec(candidate, "performanceTier") ?? "Target not supplied",
      performanceDelta,
      disabled: availability === "out_of_stock",
      availability: `${availability.replaceAll("_", " ")} · Seed data`,
      priceTrustLabel: "Seed price · not live",
    };
  });
}

function BrandMark() {
  return <div className="brand-mark" aria-hidden="true"><span /></div>;
}

function semanticScoreClass(value: string) {
  const numericMatch = value.match(/(\d{2,3})(?:\/100)?/);
  const score = numericMatch
    ? Number(numericMatch[1])
    : /exceptional|excellent/i.test(value)
      ? 95
      : /strong/i.test(value)
        ? 82
        : /\bgood\b/i.test(value)
          ? 70
          : Number.NaN;
  if (!Number.isFinite(score)) return "";
  if (score >= 90) return "semantic-excellent";
  if (score >= 75) return "semantic-strong";
  if (score >= 60) return "semantic-caution";
  return "semantic-risk";
}

function comparisonValueClass(label: string, value: string) {
  if (["Gaming fit", "Productivity fit", "Value"].includes(label)) {
    return semanticScoreClass(value);
  }
  if (label === "Budget remaining") {
    return value.startsWith("-$") ? "semantic-risk" : "semantic-excellent";
  }
  if (label === "Compatibility impact") {
    return /note|review|requires|incompatible/i.test(value) ? "semantic-caution" : "semantic-excellent";
  }
  return "";
}

function workloadFit(part: Part) {
  const fits: Record<string, string> = {
    cpu: "Excellent for high-refresh gaming",
    gpu: "Excellent for 1440p ultra",
    motherboard: "Strong platform and upgrade fit",
    ram: "Strong for gaming and creator work",
    ssd: "Fast game and project storage",
    cooler: "Quiet sustained performance",
    psu: "Healthy load, limited flagship headroom",
    case: "High-airflow, low-noise fit",
  };
  return fits[(part as CanonicalViewPart).canonical?.category ?? part.id] ?? "Balanced for this build";
}

type ShoppingPart = Part & { purchaseUrl?: string };
type ShoppingPlanStatus = "ready" | "loading" | "error";

function purchaseUrlFor(part: Part) {
  return (part as ShoppingPart).purchaseUrl;
}

function formatPartPrice(price: number | null | undefined) {
  return typeof price === "number" && Number.isFinite(price)
    ? `$${price.toLocaleString()}`
    : "Price unavailable";
}

function formatSignedCurrency(value: number, explicitPlus = false) {
  if (!Number.isFinite(value)) return "Unknown";
  if (value === 0) return "$0";
  const formatted = `$${Math.abs(value).toLocaleString()}`;
  return value < 0 ? `-${formatted}` : explicitPlus ? `+${formatted}` : formatted;
}

function stockState(part: Part) {
  if (/out of stock|unavailable/i.test(part.stock)) return "risk";
  if (/low/i.test(part.stock)) return "caution";
  return "excellent";
}

function detailPowerThermal(part: Part) {
  const relevantSpecs = part.specs.filter((spec) => /w\b|tdp|radiator|fan|pwm|airflow|mesh/i.test(spec));
  return relevantSpecs.length ? relevantSpecs.join(" · ") : "No additional power or thermal data is provided by the current catalog.";
}

function relatedCompatibility(part: Part) {
  return part.compatibility;
}

function upgradeLimit(part: Part) {
  if ((part as CanonicalViewPart).canonical?.category === "psu") return "A future flagship GPU may require more PSU headroom.";
  return "No structured upgrade-limit data is provided by the current catalog.";
}

function ProductVisual({ part, failed, onFail }: { part: Part; failed: boolean; onFail: () => void }) {
  const Icon = part.Icon;
  return (
    <button className={`part-visual visual-${part.visual}`} onClick={(event) => { event.stopPropagation(); onFail(); }} aria-label={`Preview placeholder for ${part.category}. Click to test image failure.`}>
      {failed ? <span className="failed-visual"><ImageOff size={25} /><small>Preview unavailable</small><em>Category placeholder</em></span> : <>
        <span className="visual-grid" /><Icon size={47} strokeWidth={1.25} /><span className="visual-label">{part.eyebrow}</span>
      </>}
    </button>
  );
}

function SearchablePartCombobox({
  category,
  products,
  selected,
  slotIndex,
  onSelect,
}: {
  category: string;
  products: ComparisonProduct[];
  selected: ComparisonProduct;
  slotIndex: number;
  onSelect: (product: ComparisonProduct) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(selected.name);
  const [activeIndex, setActiveIndex] = useState(0);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return products;
    return products.filter((product) => {
      const manufacturer = product.manufacturer ?? product.name.split(" ")[0];
      const model = product.name.split(" ").slice(1).join(" ");
      const searchText = [
        product.name,
        manufacturer,
        model,
        category,
        product.vram,
        product.power,
        product.psu,
        product.resolution,
        product.retailer,
        product.availability,
      ].filter(Boolean).join(" ").toLowerCase();
      return searchText.includes(normalizedQuery);
    });
  }, [category, products, query]);

  useEffect(() => {
    if (!open) setQuery(selected.name);
  }, [open, selected.name]);

  useEffect(() => {
    const firstEnabled = filteredProducts.findIndex((product) => !product.disabled);
    setActiveIndex(firstEnabled >= 0 ? firstEnabled : 0);
  }, [query, open, filteredProducts]);

  useEffect(() => {
    if (!open) return;
    const activeProduct = filteredProducts[activeIndex];
    if (!activeProduct) return;
    document.getElementById(`${listboxId}-${activeProduct.id}`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, filteredProducts, listboxId, open]);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
      setQuery(selected.name);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [selected.name]);

  const openFullList = () => {
    if (!open) {
      setQuery("");
      setOpen(true);
      const selectedIndex = products.findIndex((product) => product.id === selected.id);
      setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    }
  };

  const commitSelection = (product: ComparisonProduct) => {
    if (product.disabled) return;
    onSelect(product);
    setQuery(product.name);
    setOpen(false);
    inputRef.current?.focus();
  };

  const moveActive = (direction: 1 | -1) => {
    if (!filteredProducts.length) return;
    let nextIndex = activeIndex;
    for (let step = 0; step < filteredProducts.length; step += 1) {
      nextIndex = (nextIndex + direction + filteredProducts.length) % filteredProducts.length;
      if (!filteredProducts[nextIndex]?.disabled) {
        setActiveIndex(nextIndex);
        return;
      }
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) openFullList();
      else moveActive(1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) openFullList();
      else moveActive(-1);
      return;
    }
    if (event.key === "Enter" && open) {
      event.preventDefault();
      const activeProduct = filteredProducts[activeIndex];
      if (activeProduct) commitSelection(activeProduct);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      setQuery(selected.name);
      return;
    }
    if (event.key === "Tab") {
      setOpen(false);
      setQuery(selected.name);
    }
  };

  return (
    <div className="catalog-combobox" ref={rootRef}>
      <label htmlFor={`${listboxId}-input`}><Search size={13} /> Search {category}</label>
      <div className="combobox-control">
        <input
          ref={inputRef}
          id={`${listboxId}-input`}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={open && filteredProducts[activeIndex] ? `${listboxId}-${filteredProducts[activeIndex].id}` : undefined}
          value={query}
          onFocus={openFullList}
          onClick={openFullList}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          aria-label={`Search ${category} catalog for comparison slot ${slotIndex + 1}`}
        />
        <ChevronRight className={open ? "combobox-chevron open" : "combobox-chevron"} size={15} aria-hidden="true" />
      </div>
      {open && (
        <div className="combobox-menu" id={listboxId} role="listbox" aria-label={`Compatible ${category} parts`}>
          {filteredProducts.length ? filteredProducts.map((product, index) => {
            const isSelected = product.id === selected.id;
            const isActive = index === activeIndex;
            return (
              <button
                type="button"
                id={`${listboxId}-${product.id}`}
                role="option"
                aria-selected={isSelected}
                aria-disabled={product.disabled || undefined}
                disabled={product.disabled}
                className={`combobox-option ${isSelected ? "selected" : ""} ${isActive ? "keyboard-active" : ""}`}
                onMouseMove={() => setActiveIndex(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => commitSelection(product)}
                key={product.id}
              >
                <span className="option-check">{isSelected && <Check size={14} />}</span>
                <span className="option-copy"><strong>{product.name}</strong><small>{product.vram} · {product.power} · {product.resolution}</small><em>{product.availability ?? `${product.retailer} · Available`}</em></span>
                <span className="option-price">{formatPartPrice(product.price)}</span>
              </button>
            );
          }) : (
            <div className="combobox-empty"><Search size={18} /><strong>No matching {category} parts</strong><span>Try a model, manufacturer, or specification.</span></div>
          )}
        </div>
      )}
    </div>
  );
}

function CompareWorkspace({
  part,
  build,
  buildTotal,
  budget,
  onClose,
  onReplace,
}: {
  part: CanonicalViewPart;
  build: Build;
  buildTotal: number;
  budget: number;
  onClose: () => void;
  onReplace: (part: CanonicalViewPart) => void;
}) {
  const catalog = useMemo(() => canonicalComparisonCatalog(part, build), [part, build]);
  const [slots, setSlots] = useState([catalog[0], catalog[1], catalog[2]]);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  const setSlotProduct = (slotIndex: number, product: CanonicalComparisonProduct) => {
    setSlots((current) => {
      const duplicateIndex = current.findIndex((slot, index) => index !== slotIndex && slot.id === product.id);
      if (duplicateIndex < 0) return current.map((slot, index) => index === slotIndex ? product : slot);
      const previous = current[slotIndex];
      return current.map((slot, index) => index === slotIndex ? product : index === duplicateIndex ? previous : slot);
    });
  };

  const selected = selectedSlot === null ? null : slots[selectedSlot];
  const selectedBuildTotal = selected && Number.isFinite(selected.price) ? buildTotal - part.price + selected.price : buildTotal;
  const budgetDelta = budget - selectedBuildTotal;
  const selectedValue = selected?.value ?? "Not selected";
  const selectedPower = selected?.power ?? "Not selected";
  const selectedPerformance = selected?.performanceDelta ?? "Not selected";
  const rows = [
    ["Price", ...slots.map((slot) => formatPartPrice(slot.price))],
    ["Gaming fit", ...slots.map((slot) => slot.gaming)],
    ["Productivity fit", ...slots.map((slot) => slot.productivity)],
    ["Value", ...slots.map((slot) => slot.value)],
    [part.canonical.category === "gpu" ? "VRAM" : "Primary specification", ...slots.map((slot) => slot.vram)],
    [part.canonical.category === "gpu" ? "Board power" : "Power / thermal", ...slots.map((slot) => slot.power)],
    ["Recommended PSU", ...slots.map((slot) => slot.psu)],
    [part.canonical.category === "gpu" ? "Physical length" : "Physical fit", ...slots.map((slot) => slot.length)],
    ["Target resolution", ...slots.map((slot) => slot.resolution)],
    ["New build total", ...slots.map((slot) => Number.isFinite(slot.price) ? formatPartPrice(buildTotal - part.price + slot.price) : "Unavailable")],
    ["Budget remaining", ...slots.map((slot) => Number.isFinite(slot.price) ? formatSignedCurrency(budget - (buildTotal - part.price + slot.price)) : "Unknown")],
    ["Compatibility impact", ...slots.map((slot) => slot.compatibility)],
  ];

  return (
    <section className="wide-compare-workspace" aria-label={`${part.category} comparison workspace`}>
      <div className="wide-compare-scroll">
        <header className="wide-compare-header">
          <div>
            <span className="section-kicker">COMPARE WORKSPACE</span>
            <h1>Compare {part.category} options</h1>
            <p>Three same-category choices with whole-build consequences aligned before you commit.</p>
          </div>
          <div className="compare-header-context" aria-label="Comparison context">
            <span><small>CURRENT PART</small><strong>{part.name}</strong></span>
            <span><small>BUILD TARGET</small><strong>1440p high refresh</strong></span>
            <span><small>OPTIONS</small><strong>3 same-category parts</strong></span>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close comparison"><X size={18} /></button>
        </header>

        <div className="compare-grid-frame">
        <div className="compare-slot-grid comparison-grid">
          <div className="comparison-label-spacer" aria-hidden="true">
            <span>Compared parts</span>
          </div>
          {slots.map((slot, slotIndex) => {
            const displayPart = { ...part, name: slot.name, price: slot.price, retailer: slot.retailer };
            const slotRole = ["CURRENT PICK", "AI OPTION", "USER OPTION"][slotIndex];
            const slotBuildTotal = Number.isFinite(slot.price) ? buildTotal - part.price + slot.price : Number.NaN;
            const slotBudgetDelta = budget - slotBuildTotal;
            return (
              <article className={`compare-slot ${selectedSlot === slotIndex ? "decision-selected" : ""}`} key={`${slot.id}-${slotIndex}`}>
                <SearchablePartCombobox
                  category={part.category}
                  products={catalog}
                  selected={slot}
                  slotIndex={slotIndex}
                  onSelect={(product) => setSlotProduct(slotIndex, product as CanonicalComparisonProduct)}
                />
                <ProductVisual part={displayPart} failed={false} onFail={() => {}} />
                <span className={`compare-label ${slotIndex === 1 ? "label-ai-pick" : slotIndex === 2 ? "label-user-choice" : ""}`}>{slotRole}</span>
                <h2>{slot.name}</h2>
                <div className="compare-price"><strong>{formatPartPrice(slot.price)}</strong><span>{slot.retailer === "Retailer unavailable" ? slot.retailer : `Seed listing at ${slot.retailer}`}</span><small className="data-trust-label">Seed price · not live</small></div>
                <span className={`slot-compatibility ${/note|review|requires/i.test(slot.compatibility) ? "warning" : ""}`}>
                  {/note|review|requires/i.test(slot.compatibility) ? <AlertTriangle size={13} /> : <CheckCircle2 size={13} />}
                  {slot.compatibility}
                </span>
                {slot.officialUrl && (
                  <a className="official-link" href={slot.officialUrl} target="_blank" rel="noreferrer" aria-label={`Open official page for ${slot.name} in a new tab`}>
                    Official page <span aria-hidden="true">↗</span>
                  </a>
                )}
                <dl className="slot-impact-summary">
                  <div><dt>Build total</dt><dd>{formatPartPrice(slotBuildTotal)}</dd></div>
                  <div><dt>Budget</dt><dd className={slotBudgetDelta >= 0 ? "semantic-excellent" : "semantic-risk"}>{Number.isFinite(slotBudgetDelta) ? (slotBudgetDelta >= 0 ? `${formatPartPrice(slotBudgetDelta)} left` : `${formatPartPrice(Math.abs(slotBudgetDelta))} over`) : "Unknown"}</dd></div>
                  <div><dt>Performance</dt><dd>{slot.performanceDelta}</dd></div>
                  <div><dt>Value</dt><dd className={semanticScoreClass(slot.value)}>{slot.value}</dd></div>
                  <div><dt>Power</dt><dd>{slot.power}</dd></div>
                </dl>
                <button className={selectedSlot === slotIndex ? "slot-action active" : "slot-action"} onClick={() => setSelectedSlot(slotIndex)}>
                  {selectedSlot === slotIndex ? <Check size={14} /> : <GitCompareArrows size={14} />}
                  {selectedSlot === slotIndex ? (slotIndex === 0 ? "Current build selected" : "Replacement selected") : (slotIndex === 0 ? "Keep current build" : "Choose this option")}
                </button>
              </article>
            );
          })}
        </div>

        <div className="aligned-comparison" role="table" aria-label="Aligned product comparison">
          {rows.map(([label, ...values], rowIndex) => (
            <div className={`comparison-row comparison-grid ${rowIndex >= 9 ? "whole-build-row" : ""}`} role="row" key={label}>
              <div className="comparison-metric" role="rowheader">{label}</div>
              {values.map((value, valueIndex) => (
                <div className={`${selectedSlot === valueIndex ? "selected-value" : ""} ${comparisonValueClass(label, value)}`.trim()} role="cell" key={`${label}-${valueIndex}`}>
                  {label === "Compatibility impact" && <ShieldCheck size={14} />}
                  {value}
                </div>
              ))}
            </div>
          ))}
        </div>
        </div>

        <section className="structured-differences comparison-grid">
          <div className="comparison-section-label"><span>Structured differences</span></div>
          <div className="structured-differences-content">
            <div className="structure-heading"><span className="section-kicker">STRUCTURED DIFFERENCES</span><h2>What changes in the whole build</h2></div>
            <div className="difference-grid">
              <div><CircleDollarSign size={17} /><span><small>PRICE DELTA</small><strong>{selected ? `${selected.price - part.price > 0 ? "+" : "−"}$${Math.abs(selected.price - part.price)}` : "Select an option"}</strong></span></div>
              <div><Gauge size={17} /><span><small>PERFORMANCE DELTA</small><strong>{selectedPerformance}</strong></span></div>
              <div><Target size={17} /><span><small>VALUE</small><strong>{selectedValue}</strong></span></div>
              <div><Zap size={17} /><span><small>POWER IMPACT</small><strong>{selectedPower}</strong></span></div>
            </div>
            <div className="impact-grid">
              <div><h3><CheckCircle2 size={15} /> Main gains</h3><p>{selected ? (selected as CanonicalComparisonProduct).metadata.recommendationReason : "Select a column to reveal the practical gains."}</p></div>
              <div><h3><AlertTriangle size={15} /> Main tradeoffs</h3><p>{selected ? (selected as CanonicalComparisonProduct).metadata.tradeOffSummary : "No tradeoff is assumed until you choose an option."}</p></div>
              <div><h3><ShieldCheck size={15} /> Whole-build impact</h3><p>{selected ? `${selected.compatibility}. New total: $${selectedBuildTotal.toLocaleString()}.` : "Build consequences will appear after an explicit selection."}</p></div>
            </div>
          </div>
        </section>

        <section className="compare-ai-recommendation comparison-grid">
          <div className="comparison-section-label"><span>AI recommendation</span></div>
          <div className="compare-ai-recommendation-content">
            <span><Sparkles size={18} /></span>
            <div><small>AI RECOMMENDATION</small><h2>{catalog[1]?.name ?? "No alternative available"}</h2><p>{catalog[1]?.metadata.recommendationReason ?? "The current seed catalog has no second option for this category."}</p></div>
          </div>
        </section>
      </div>

      <footer className="compare-decision-bar comparison-grid">
        <div className="decision-bar-label"><span>Decision</span></div>
        <div className="decision-bar-content">
          <div className="decision-product"><small>SELECTED DECISION</small><strong>{selected ? (selectedSlot === 0 ? "Keep current part" : selected.name) : "Choose a comparison column"}</strong></div>
          <div className="decision-metrics">
            <div><small>NEW BUILD TOTAL</small><strong>${selectedBuildTotal.toLocaleString()}</strong></div>
            <div><small>BUDGET</small><strong className={budgetDelta >= 0 ? "budget-positive-text" : "warning-text"}>{budgetDelta >= 0 ? `$${budgetDelta} left` : `$${Math.abs(budgetDelta)} over`}</strong></div>
            <div><small>COMPATIBILITY</small><strong className={selected ? comparisonValueClass("Compatibility impact", selected.compatibility) : ""}>{selected?.compatibility ?? "Not selected"}</strong></div>
            <div><small>PERFORMANCE</small><strong>{selectedPerformance}</strong></div>
            <div><small>VALUE</small><strong className={selected ? semanticScoreClass(selected.value) : ""}>{selectedValue}</strong></div>
            <div><small>POWER</small><strong>{selectedPower}</strong></div>
          </div>
          <div className="decision-actions"><button className="outline-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={!selected || selectedSlot === 0 || !Number.isFinite(selected.price)} onClick={() => selected && onReplace(adaptCanonicalPart((selected as CanonicalComparisonProduct).canonical, build))}>Review Replacement <ArrowRight size={15} /></button></div>
        </div>
      </footer>
    </section>
  );
}

function BuildWorkspace() {
  const [build, setBuild] = useState<Build>(() => createSeedBuild(Object.values(recommendedBuildPartIds).filter(Boolean).map((id) => seedParts.find((part) => part.id === id)!).filter(Boolean)));
  const parts = useMemo(() => build.parts.map((part) => adaptCanonicalPart(part, build)), [build]);
  const initialGpuId = build.parts.find((part) => part.category === "gpu")?.id ?? build.parts[0]?.id ?? "";
  const [selectedId, setSelectedId] = useState(initialGpuId);
  const [detailPart, setDetailPart] = useState<CanonicalViewPart | null>(null);
  const [comparePart, setComparePart] = useState<CanonicalViewPart | null>(null);
  const [replacementPart, setReplacementPart] = useState<CanonicalViewPart | null>(null);
  const [comparisonReplacement, setComparisonReplacement] = useState<{ current: CanonicalViewPart; next: CanonicalViewPart } | null>(null);
  const [replacementStatus, setReplacementStatus] = useState<"idle" | "pending" | "succeeded" | "failed">("idle");
  const [replacementFeedback, setReplacementFeedback] = useState("");
  const [shoppingOpen, setShoppingOpen] = useState(false);
  const [shoppingStatus] = useState<ShoppingPlanStatus>("ready");
  const [shoppingFeedback, setShoppingFeedback] = useState("");
  const [warningOpen, setWarningOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"needs" | "build" | "summary">("build");
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const [chatText, setChatText] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const detailCloseRef = useRef<HTMLButtonElement>(null);
  const shoppingCloseRef = useRef<HTMLButtonElement>(null);
  const total = build.totalPrice;
  const budget = build.budget;
  const delta = budget - total;
  const retailerGroups = useMemo(() => {
    const groups = new Map<string, CanonicalViewPart[]>();
    parts.forEach((part) => groups.set(part.retailer || "Retailer unavailable", [...(groups.get(part.retailer || "Retailer unavailable") ?? []), part]));
    return [...groups.entries()];
  }, [parts]);
  const compatibilityReviewCount = build.compatibilityChecks.filter((check) => check.severity !== "pass").length;
  const unresolvedPurchaseCount = parts.filter((part) => !part.purchaseUrl || !Number.isFinite(part.price) || part.stock === "Out of stock" || part.stock === "Stock unknown").length;
  const powerEstimate = estimateBuildPower(build);
  const psuWattage = build.parts.find((part) => part.category === "psu")?.specs.wattageW;
  const psuHeadroom = powerEstimate.value !== null && typeof psuWattage === "number" ? psuWattage - powerEstimate.value : null;
  const gpu = build.parts.find((part) => part.category === "gpu");
  const performanceScore = typeof gpu?.specs.gaming1440pScore === "number" ? gpu.specs.gaming1440pScore : gpu?.performanceScore ?? null;
  const valueScore = typeof gpu?.valueScore === "number" ? gpu.valueScore : null;
  const selectedPart = parts.find((part) => part.id === selectedId) ?? parts[1];
  const pendingCurrent = comparisonReplacement?.current ?? replacementPart;
  const pendingNext = comparisonReplacement?.next ?? (replacementPart
    ? canonicalComparisonCatalog(replacementPart, build).find((candidate) => candidate.id !== replacementPart.id && !candidate.disabled)
    : null);
  const pendingPreviewBuild = pendingCurrent && pendingNext
    ? (() => { try { return replaceBuildPartLocally(build, pendingCurrent.id, pendingNext.canonical); } catch { return build; } })()
    : build;
  const pendingNextPart = pendingNext ? adaptCanonicalPart(pendingNext.canonical, pendingPreviewBuild) : null;
  const pendingBuildTotal = pendingCurrent && pendingNextPart ? total - pendingCurrent.price + pendingNextPart.price : total;
  const pendingBudgetDelta = budget - pendingBuildTotal;
  const closeReplacement = () => {
    setReplacementPart(null);
    setComparisonReplacement(null);
  };
  const openCompare = (part: CanonicalViewPart) => {
    setDetailPart(null);
    setComparePart(part);
  };
  const confirmReplacement = () => {
    if (!pendingCurrent || !pendingNextPart) return;
    setReplacementStatus("pending");
    setReplacementFeedback("Recalculating build consequences…");
    try {
      const previousCompatibility = build.compatibilityStatus;
      const nextBuild = replaceBuildPartLocally(build, pendingCurrent.id, pendingNextPart.canonical);
      setBuild(nextBuild);
      setSelectedId(pendingNextPart.id);
      setReplacementStatus("succeeded");
      setReplacementFeedback(`${pendingNextPart.name} applied. Compatibility ${previousCompatibility === nextBuild.compatibilityStatus ? "is unchanged" : `changed from ${previousCompatibility} to ${nextBuild.compatibilityStatus}`}. Persistence is unavailable in this guest preview.`);
      closeReplacement();
    } catch (error) {
      setReplacementStatus("failed");
      setReplacementFeedback(error instanceof Error ? error.message : "Replacement could not be applied. The build is unchanged.");
    }
  };
  const toggleImageFailure = (id: string) => setFailedImages((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const sendMessage = () => {
    if (!chatText.trim()) return;
    setMessages((current) => [...current, chatText.trim()]);
    setChatText("");
  };

  useEffect(() => {
    const openDialog = detailPart || shoppingOpen;
    if (!openDialog) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (shoppingOpen) setShoppingOpen(false);
      else setDetailPart(null);
    };
    window.addEventListener("keydown", onKeyDown);
    window.requestAnimationFrame(() => (shoppingOpen ? shoppingCloseRef.current : detailCloseRef.current)?.focus());
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [detailPart, shoppingOpen]);

  const shoppingPlanText = () => {
    const budgetLine = delta >= 0 ? `${formatPartPrice(delta)} remaining` : `${formatPartPrice(Math.abs(delta))} over budget`;
    return [
      "1440p Performance Build purchase plan",
      `Build total: ${formatPartPrice(total)}`,
      `Budget: ${budgetLine}`,
      `Compatibility: ${compatibilityReviewCount ? `${compatibilityReviewCount} item requires review` : "No issues"}`,
      "",
      ...parts.map((part) => `${part.category}: ${part.name} | ${formatPartPrice(part.price)} (seed, not live) | ${part.retailer || "Retailer unavailable"} (seed listing) | ${part.stock} (seed) | ${purchaseUrlFor(part) ?? "Purchase reference unavailable"}`),
    ].join("\n");
  };

  const copyShoppingPlan = async () => {
    const text = shoppingPlanText();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    setShoppingFeedback("Purchase plan copied");
  };

  const exportShoppingPlan = () => {
    const escapeCsv = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const rows = [
      ["Category", "Product", "Price", "Price source", "Retailer", "Retailer source", "Availability", "Stock source", "Compatibility", "Compatibility source", "Purchase reference", "Official page"],
      ...parts.map((part) => [part.category, part.name, Number.isFinite(part.price) ? part.price : "Unavailable", "Seed catalog, not live", part.retailer, "Seed catalog", part.stock, "Seed catalog", part.compatibility, "Calculated", purchaseUrlFor(part) ?? "Unavailable", part.officialUrl ?? "Unavailable"]),
    ];
    const blob = new Blob([rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "1440p-performance-build-purchase-plan.csv";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setShoppingFeedback("Purchase plan exported");
  };

  return (
    <div className="advisor-shell">
      <header className="workspace-header">
        <div className="workspace-brand"><BrandMark /><span className="brand-name">AI装机助手</span><span className="brand-divider">/</span><span className="brand-subtitle">BUILD ADVISOR</span></div>
        <div className="build-context"><span className="context-dot" /><div><small>ACTIVE BUILD</small><strong>1440p Performance</strong></div><button aria-label="Open build menu"><ChevronRight size={16} /></button></div>
        <nav className="header-actions" aria-label="Account"><button>Saved Builds</button><button className="avatar-button" aria-label="Account menu">CG</button></nav>
      </header>

      <main className={`workspace-frame ${comparePart ? "compare-active" : ""}`}>
        <aside className={`requirements-rail ${mobilePanel === "needs" ? "mobile-active" : ""}`}>
          <div className="rail-scroll">
            <div className="rail-heading"><div><span className="section-kicker">YOUR BUILD BRIEF</span><h2>What matters most</h2></div><button className="icon-button" aria-label="Edit requirements"><SlidersHorizontal size={17} /></button></div>
            <section className="brief-card">
              <div className="brief-budget"><span>Target budget</span><strong>$2,500</strong><em>Flexible by $100</em></div>
              <div className="brief-meter"><span style={{ width: "91%" }} /></div>
              <div className="brief-grid">
                <div><Target size={15} /><span><small>PLAY AT</small>1440p / 165Hz</span></div>
                <div><Gauge size={15} /><span><small>PRIORITY</small>Performance</span></div>
                <div><Sparkles size={15} /><span><small>LOOK</small>Dark / minimal</span></div>
                <div><MonitorCog size={15} /><span><small>USE</small>Gaming + creator</span></div>
              </div>
              <div className="preference-tags"><span>NVIDIA preferred</span><span>Wi‑Fi required</span><span>Quiet build</span></div>
            </section>
            <section className="advisor-chat">
              <div className="chat-title"><span><Bot size={17} /> AI build guide</span></div>
              <div className="chat-thread">
                <div className="chat-message assistant"><div className="mini-avatar"><Sparkles size={13} /></div><p>I’ve balanced your build around high-refresh 1440p play, with enough memory and storage for creative work.</p></div>
                <div className="chat-message user"><p>Keep it quiet, and don’t sacrifice upgrade room.</p></div>
                <div className="chat-message assistant"><div className="mini-avatar"><Sparkles size={13} /></div><p>Done. The case and cooling are intentionally oversized for lower fan speeds.</p></div>
                {messages.map((message, index) => <div className="chat-message user" key={`${message}-${index}`}><p>{message}</p></div>)}
              </div>
              <div className="quick-prompts"><button onClick={() => openCompare(parts[1])}>Can I save $200?</button><button onClick={() => setWarningOpen(true)}>Check upgrade headroom</button></div>
            </section>
          </div>
          <div className="chat-composer"><input value={chatText} onChange={(event) => setChatText(event.target.value)} onKeyDown={(event) => event.key === "Enter" && sendMessage()} placeholder="Ask about this build…" aria-label="Ask the AI build guide" /><button onClick={sendMessage} aria-label="Send message"><Send size={16} /></button></div>
        </aside>

        {comparePart ? (
          <CompareWorkspace
            part={comparePart}
            build={build}
            buildTotal={total}
            budget={budget}
            onClose={() => setComparePart(null)}
            onReplace={(nextPart) => {
              const currentPart = comparePart;
              setComparePart(null);
              if (currentPart) setComparisonReplacement({ current: currentPart, next: nextPart });
            }}
          />
        ) : (<>
        <section className={`build-workspace ${mobilePanel === "build" ? "mobile-active" : ""}`}>
          <div className="workspace-scroll">
            <div className="workspace-intro">
              <div><h1>1440p Performance Build</h1><p>A balanced, quiet gaming system with creator-ready headroom.</p></div>
              <div className="workspace-tools"><button className="outline-button"><SlidersHorizontal size={15} /> Refine build</button></div>
            </div>
            <div className="parts-heading"><div><h2>Component decision ledger</h2><span>8 selected parts. Choose a row to inspect the decision.</span></div></div>
            <div className="component-list">
              {parts.map((part) => (
                <article key={part.id} className={`component-card ${selectedId === part.id ? "selected" : ""}`} onClick={() => setSelectedId(part.id)} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedId(part.id); } }}>
                  <ProductVisual part={part} failed={failedImages.includes(part.id)} onFail={() => toggleImageFailure(part.id)} />
                  <div className="part-main">
                    <div className="part-meta"><span>{part.category}</span><span className={`stock ${part.stockTone}`}>{part.stock}</span><span className="data-trust-label" title={part.trustDetail}>{part.trustLabel}</span></div>
                    <h3>{part.name}</h3>
                    <p className="workload-fit">{workloadFit(part)}</p>
                    <div className="spec-list">{part.specs.slice(0, 3).map((spec) => <span key={spec}>{spec}</span>)}</div>
                    <p className="selection-reason">{part.reason}</p>
                  </div>
                  <div className="part-actions">
                    <div className="price-block"><strong>{formatPartPrice(part.price)}</strong><span>{part.retailer === "Retailer unavailable" ? part.retailer : `Seed listing at ${part.retailer}`}</span></div>
                    <span className={`compat-status ${part.id === "psu" ? "warning" : ""}`}>{part.id === "psu" ? <AlertTriangle size={13} /> : <CheckCircle2 size={13} />}{part.compatibility}</span>
                    <div className="card-buttons">
                      <button onClick={(event) => { event.stopPropagation(); openCompare(part); }}><GitCompareArrows size={15} /> Compare</button>
                      <button onClick={(event) => { event.stopPropagation(); setReplacementPart(part); }}><Layers3 size={15} /> Replace</button>
                      <button className="detail-button" onClick={(event) => { event.stopPropagation(); setDetailPart(part); }} aria-label={`View details for ${part.name}`}>More <ChevronRight size={15} /></button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {comparePart && <div className="center-overlay compare-overlay" role="dialog" aria-modal="true" aria-label="Component comparison">
            <div className="overlay-header"><div><span className="section-kicker">SIDE-BY-SIDE DECISION</span><h2>Save $200 without losing the experience</h2></div><button className="icon-button" onClick={() => setComparePart(null)} aria-label="Close comparison"><X size={18} /></button></div>
            <div className="comparison-hero">
              <div className="compare-product current"><span className="choice-tag">CURRENT PICK</span><ProductVisual part={selectedPart} failed={false} onFail={() => {}} /><h3>{selectedPart.name}</h3><strong>${selectedPart.price}</strong></div>
              <div className="versus">VS</div>
              <div className="compare-product recommended"><span className="choice-tag"><BadgeCheck size={13} /> BEST VALUE</span><ProductVisual part={comparePart} failed={false} onFail={() => {}} /><h3>{legacyPrototypeReplacement.name}</h3><strong>${legacyPrototypeReplacement.price}</strong></div>
            </div>
            <div className="delta-grid">
              <div className="positive"><CircleDollarSign size={17} /><span><small>PRICE</small><strong>Save $200</strong></span></div>
              <div><Gauge size={17} /><span><small>PERFORMANCE</small><strong>−11% at 4K</strong></span></div>
              <div className="positive"><Target size={17} /><span><small>VALUE</small><strong>+8 points</strong></span></div>
              <div className="positive"><Zap size={17} /><span><small>POWER</small><strong>−35 watts</strong></span></div>
              <div className="positive"><ShieldCheck size={17} /><span><small>COMPATIBILITY</small><strong>No impact</strong></span></div>
            </div>
            <div className="tradeoff-grid"><div><h4><ArrowDownRight size={15} /> Main gains</h4><p>$200 back in budget, lower heat output, and nearly identical 1440p performance.</p></div><div><h4><AlertTriangle size={15} /> Main tradeoffs</h4><p>Less 4K headroom and slower ray tracing in the most demanding games.</p></div></div>
            <div className="recommendation-callout"><span><Sparkles size={18} /></span><div><small>AI RECOMMENDATION</small><strong>Choose the 4070 Ti SUPER if 1440p is your real priority.</strong></div><button onClick={() => { setComparePart(null); setReplacementPart(parts[1]); }}>Choose this option <ArrowRight size={15} /></button></div>
          </div>}

          {detailPart && <div className="center-overlay detail-overlay" role="dialog" aria-modal="true" aria-labelledby="product-detail-title">
            <div className="overlay-header detail-header"><div><span className="section-kicker">{detailPart.category} RESEARCH</span><h2 id="product-detail-title">{detailPart.name}</h2></div><button ref={detailCloseRef} className="icon-button" onClick={() => setDetailPart(null)} aria-label="Close product detail"><X size={18} /></button></div>
            <div className="detail-masthead">
              <ProductVisual part={detailPart} failed={failedImages.includes(detailPart.id)} onFail={() => toggleImageFailure(detailPart.id)} />
              <div className="detail-purchase-context">
                <span className="detail-price">{formatPartPrice(detailPart.price)}</span>
                <p><Store size={14} /> {detailPart.retailer || "Retailer unavailable"} <span aria-hidden="true">·</span> <span className={`semantic-${stockState(detailPart)}`}>{detailPart.stock}</span></p>
                <p className="data-trust-detail"><span className="data-trust-label">{detailPart.trustLabel}</span>{detailPart.trustDetail}</p>
                <p className={detailPart.canonical.category === "psu" && build.compatibilityStatus !== "pass" ? "semantic-caution" : "semantic-excellent"}>{detailPart.canonical.category === "psu" && build.compatibilityStatus !== "pass" ? <AlertTriangle size={14} /> : <ShieldCheck size={14} />}{detailPart.compatibility}</p>
                {detailPart.officialUrl && <a className="official-link detail-official-link" href={detailPart.officialUrl} target="_blank" rel="noreferrer" aria-label={`Open official page for ${detailPart.name} in a new tab`}>Official page <ExternalLink size={13} /></a>}
              </div>
            </div>
            <div className="detail-sections">
              <section className="detail-rationale"><span className="detail-section-label">WHY IT WAS SELECTED</span><p>{detailPart.reason}</p></section>
              <section><span className="detail-section-label">WORKLOAD FIT</span><strong>{workloadFit(detailPart)}</strong><p>This selection supports the current 1440p gaming and creator brief.</p></section>
              <section><span className="detail-section-label">IMPORTANT SPECIFICATIONS</span><dl className="detail-specs">{detailPart.specs.map((spec, index) => <div key={spec}><dt>Specification {index + 1}</dt><dd>{spec}</dd></div>)}</dl></section>
              <section><span className="detail-section-label">COMPATIBILITY RELATIONSHIPS</span><p>{relatedCompatibility(detailPart)}</p></section>
              <section><span className="detail-section-label">POWER AND THERMALS</span><p><Thermometer size={14} />{detailPowerThermal(detailPart)}</p></section>
              <section><span className="detail-section-label">UPGRADE LIMITS</span><p>{upgradeLimit(detailPart)}</p></section>
            </div>
            <div className="detail-footer"><button className="outline-button" onClick={() => { const part = detailPart; setDetailPart(null); setReplacementPart(part); }}><Layers3 size={15} /> Replace</button><button className="primary-button" onClick={() => openCompare(detailPart)}><GitCompareArrows size={15} /> Compare alternatives</button></div>
          </div>}
        </section>

        <aside className={`summary-rail ${mobilePanel === "summary" ? "mobile-active" : ""}`}>
          <div className="summary-top"><div className="summary-heading"><span className="section-kicker">DECISION RECEIPT</span></div><div className="total-price"><span>Estimated build total</span><strong>{formatPartPrice(total)}</strong><small>{parts.length} selected components · Seed prices</small></div><div className="budget-status"><div><span>Target budget</span><strong>{formatPartPrice(budget)}</strong></div><div><span>{delta >= 0 ? "Remaining" : "Over budget"}</span><strong className={delta >= 0 ? "semantic-excellent" : "semantic-risk"}>{formatPartPrice(Math.abs(delta))}</strong></div><p className={delta >= 0 ? "semantic-excellent" : "semantic-risk"}>{delta >= 0 ? `${Math.round((delta / budget) * 100)}% below your target` : "Budget adjustment required"}</p></div></div>
          <div className="receipt-metrics">
            <button className="receipt-row receipt-warning" onClick={() => setWarningOpen(!warningOpen)}><span>Compatibility<small>{build.compatibilityChecks.length} rules evaluated · calculated</small></span><strong className={build.compatibilityStatus === "pass" ? "semantic-excellent" : build.compatibilityStatus === "warning" ? "semantic-caution" : "semantic-risk"}>{compatibilityReviewCount ? `${compatibilityReviewCount} ${compatibilityReviewCount === 1 ? "note" : "notes"} to review` : "All checks passed"}</strong><ChevronRight size={15} /></button>
            {warningOpen && <div className="warning-detail"><strong>{build.compatibilityWarnings[0]?.severity === "fail" ? "Compatibility issue" : "Compatibility review"}</strong><p>{build.compatibilityWarnings[0]?.message ?? "All evaluated compatibility rules currently pass."}</p>{parts.find((part) => part.canonical.category === "psu") && <button onClick={() => setReplacementPart(parts.find((part) => part.canonical.category === "psu")!)}>Review PSU options</button>}</div>}
            <div className="receipt-row"><span>Target performance<small>GPU workload score · seed specification</small></span><strong className={performanceScore === null ? "" : semanticScoreClass(`${performanceScore}`)}>{performanceScore ?? "Unknown"}</strong></div>
            <div className="receipt-row"><span>Value<small>Catalog score provenance required</small></span><strong className={valueScore === null ? "" : semanticScoreClass(`${valueScore}`)}>{valueScore ?? "Unknown"}</strong></div>
            <div className="receipt-row"><span>Estimated power<small>{powerEstimate.trust.disclosure}</small></span><strong className="semantic-strong">{powerEstimate.value === null ? "Unknown" : `${powerEstimate.value}W`}</strong></div>
            <div className="receipt-row"><span>PSU headroom<small>Derived from selected PSU and estimated draw</small></span><strong className={psuHeadroom !== null && psuHeadroom < 100 ? "semantic-caution" : "semantic-strong"}>{psuHeadroom === null ? "Unknown" : `${psuHeadroom}W`}</strong></div>
          </div>
          <p className="receipt-insight"><strong>Well balanced.</strong> The GPU carries the target resolution while the CPU protects high-frame-rate responsiveness.</p>
          <div className="summary-footer"><button className="primary-button shopping-button" onClick={() => setShoppingOpen(true)}><ShoppingBag size={17} /> Preview shopping list <ArrowRight size={16} /></button><button className="save-button"><ClipboardList size={15} /> Save or export build</button><p><ShieldCheck size={12} /> {build.compatibilityChecks.length} rules evaluated · calculated result</p></div>
        </aside>
        </>)}
      </main>

      <nav className={`mobile-tabs ${comparePart ? "compare-open" : ""}`} aria-label="Workspace sections"><button className={mobilePanel === "needs" ? "active" : ""} onClick={() => setMobilePanel("needs")}><PanelLeft size={18} />Needs</button><button className={mobilePanel === "build" ? "active" : ""} onClick={() => setMobilePanel("build")}><Cpu size={18} />Build</button><button className={mobilePanel === "summary" ? "active" : ""} onClick={() => setMobilePanel("summary")}><ClipboardList size={18} />Summary</button></nav>

      {replacementFeedback && <div className={`replacement-feedback ${replacementStatus}`} role="status" aria-live="polite">{replacementFeedback}</div>}
      {pendingCurrent && pendingNextPart && <div className="modal-scrim" role="dialog" aria-modal="true" aria-label="Confirm replacement"><div className="confirm-modal consequence-confirmation">
        <div className="confirm-icon"><GitCompareArrows size={22} /></div><span className="section-kicker">REPLACEMENT CONSEQUENCES</span><h2>Replace {pendingCurrent.category}?</h2><p>Review the part and whole-build changes before confirming this decision.</p>
        <div className="replacement-summary"><div><span>Current part</span><strong>{pendingCurrent.name}</strong><small>{formatPartPrice(pendingCurrent.price)} · Seed data</small></div><ArrowRight size={18} /><div><span>Selected replacement</span><strong>{pendingNextPart.name}</strong><small>{formatPartPrice(pendingNextPart.price)} · Seed data</small></div></div>
        <dl className="confirmation-impact-grid">
          <div><dt>Part price</dt><dd className={pendingNextPart.price <= pendingCurrent.price ? "semantic-excellent" : "semantic-caution"}>{formatSignedCurrency(pendingNextPart.price - pendingCurrent.price, true)}</dd></div>
          <div><dt>New build total</dt><dd>${pendingBuildTotal.toLocaleString()}</dd></div>
          <div><dt>Budget</dt><dd className={pendingBudgetDelta >= 0 ? "semantic-excellent" : "semantic-risk"}>{pendingBudgetDelta >= 0 ? `$${pendingBudgetDelta} remaining` : `$${Math.abs(pendingBudgetDelta)} over`}</dd></div>
          <div><dt>Compatibility</dt><dd className={comparisonValueClass("Compatibility impact", pendingNextPart.compatibility)}>{pendingNextPart.compatibility}</dd></div>
          <div><dt>Performance</dt><dd>{canonicalComparisonCatalog(pendingCurrent, build).find((item) => item.id === pendingNextPart.id)?.performanceDelta ?? "Unknown"}</dd></div>
          <div><dt>Power</dt><dd>{canonicalComparisonCatalog(pendingCurrent, build).find((item) => item.id === pendingNextPart.id)?.power ?? "Unknown"}</dd></div>
        </dl>
        <div className="confirmation-note"><ShieldCheck size={15} /><span><strong>Compatibility preview calculated.</strong> Confirming reruns every rule against the updated build.</span></div>
        <div className="confirm-actions"><button className="outline-button" onClick={closeReplacement}>Keep current part</button><button className="primary-button" disabled={replacementStatus === "pending"} onClick={confirmReplacement}><Check size={15} /> {replacementStatus === "pending" ? "Applying…" : "Confirm replacement"}</button></div>
      </div></div>}

      {shoppingOpen && <div className="modal-scrim" role="dialog" aria-modal="true" aria-labelledby="shopping-plan-title"><div className="shopping-modal">
        <div className="overlay-header shopping-header"><div><span className="section-kicker">PURCHASE EXECUTION</span><h2 id="shopping-plan-title">Shopping plan</h2><p>Retailer references and unresolved purchase details for this build.</p></div><button ref={shoppingCloseRef} className="icon-button" onClick={() => setShoppingOpen(false)} aria-label="Close shopping plan"><X size={18} /></button></div>
        <div className="shopping-summary" aria-label="Shopping plan summary">
          <div className="shopping-total"><span>Build total</span><strong>{formatPartPrice(total)}</strong><small>{parts.length} selected components</small></div>
          <dl>
            <div><dt>Budget</dt><dd className={delta >= 0 ? "semantic-excellent" : "semantic-risk"}>{delta >= 0 ? `${formatPartPrice(delta)} remaining` : `${formatPartPrice(Math.abs(delta))} over`}</dd></div>
            <div><dt>Compatibility</dt><dd className={compatibilityReviewCount ? "semantic-caution" : "semantic-excellent"}>{compatibilityReviewCount ? `${compatibilityReviewCount} review required` : "Ready"}</dd></div>
            <div><dt>Unresolved purchase items</dt><dd className={unresolvedPurchaseCount ? "semantic-caution" : "semantic-excellent"}>{unresolvedPurchaseCount}</dd></div>
            <div><dt>Build completeness</dt><dd className={parts.length === 8 ? "semantic-excellent" : "semantic-risk"}>{parts.length === 8 ? "Complete" : `${8 - parts.length} parts missing`}</dd></div>
          </dl>
        </div>
        <div className="shopping-plan-body">
          {shoppingStatus === "loading" && <div className="shopping-state" role="status"><PackageCheck size={22} /><strong>Loading purchase references</strong><p>Checking the current build plan.</p></div>}
          {shoppingStatus === "error" && <div className="shopping-state semantic-risk" role="alert"><AlertTriangle size={22} /><strong>Purchase references could not be loaded</strong><p>The selected build is unchanged. Try opening the plan again.</p></div>}
          {shoppingStatus === "ready" && parts.length === 0 && <div className="shopping-state"><ShoppingBag size={22} /><strong>This build has no selected parts</strong><p>Complete the build before creating a shopping plan.</p></div>}
          {shoppingStatus === "ready" && parts.length > 0 && <div className="retailer-groups">{retailerGroups.map(([retailer, retailerParts]) => {
            const groupHasReferences = retailerParts.some((part) => Boolean(purchaseUrlFor(part)));
            return <section className="retailer-group" key={retailer}>
              <header><div><Store size={15} /><strong>{retailer}</strong><span>{retailerParts.length} {retailerParts.length === 1 ? "item" : "items"} · seed catalog</span></div><small className={groupHasReferences ? "semantic-excellent" : "semantic-caution"}>{groupHasReferences ? "Retailer search references available" : "Purchase references needed"}</small></header>
              <div className="purchase-ledger">{retailerParts.map((part) => {
                const purchaseUrl = purchaseUrlFor(part);
                const priceAvailable = Number.isFinite(part.price);
                const needsReview = /review|warning|issue|required/i.test(part.compatibility);
                return <article className="purchase-row" key={part.id}>
                  <span className="shop-icon"><part.Icon size={16} /></span>
                  <div className="purchase-product"><span>{part.category}</span><strong>{part.name}</strong><small className={`semantic-${stockState(part)}`}>{part.stock}</small></div>
                  <div className="purchase-price"><strong className={priceAvailable ? "" : "semantic-caution"}>{formatPartPrice(part.price)}</strong><span>{part.retailer || "Retailer unavailable"}</span><small className="data-trust-label">Seed price · not live</small></div>
                  <div className={`purchase-review ${needsReview ? "semantic-caution" : "semantic-excellent"}`}>{needsReview ? <AlertTriangle size={13} /> : <ShieldCheck size={13} />}<span>{needsReview ? "Review required" : "Compatibility checked"}</span></div>
                  <div className="purchase-actions">
                    {purchaseUrl ? <a className="purchase-reference" href={purchaseUrl} target="_blank" rel="noreferrer">Purchase reference <ExternalLink size={12} /></a> : <button className="purchase-reference unavailable" disabled>Purchase link unavailable</button>}
                    {part.officialUrl && <a className="official-link" href={part.officialUrl} target="_blank" rel="noreferrer">Official page <ExternalLink size={11} /></a>}
                    <button onClick={() => { setShoppingOpen(false); openCompare(part); }}>Compare</button>
                    <button onClick={() => { setShoppingOpen(false); setReplacementPart(part); }}>Replace</button>
                  </div>
                </article>;
              })}</div>
            </section>;
          })}</div>}
        </div>
        <div className="shopping-actions"><span role="status" aria-live="polite">{shoppingFeedback}</span><button className="outline-button" onClick={copyShoppingPlan}><Copy size={14} /> Copy plan</button><button className="outline-button" onClick={exportShoppingPlan}><Download size={14} /> Export CSV</button><button className="primary-button" onClick={() => setShoppingOpen(false)}>Done</button></div>
      </div></div>}
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle, ArrowDownRight, ArrowRight, BadgeCheck, Bot, Box, Check,
  CheckCircle2, ChevronRight, CircleDollarSign, ClipboardList, Cpu, Fan, Gauge,
  GitCompareArrows, HardDrive, ImageOff, Layers3, MemoryStick, MonitorCog,
  PackageCheck, PanelLeft, Power, Send, ShieldCheck, ShoppingBag,
  SlidersHorizontal, Sparkles, Target, X, Zap, Search,
} from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type ComponentType, type KeyboardEvent } from "react";

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
  return `https://example.com/${manufacturer.toLowerCase().replaceAll(" ", "-")}/products/${id}`;
}

const parts: Part[] = ([
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

const replacement = { name: "NVIDIA GeForce RTX 4070 Ti SUPER 16GB", price: 799 };

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

function comparisonCatalog(part: Part): ComparisonProduct[] {
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
  return fits[part.id] ?? "Balanced for this build";
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
                <span className="option-price">${product.price.toLocaleString()}</span>
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
  buildTotal,
  budget,
  onClose,
  onReplace,
}: {
  part: Part;
  buildTotal: number;
  budget: number;
  onClose: () => void;
  onReplace: (part: Part) => void;
}) {
  const catalog = useMemo(() => comparisonCatalog(part), [part]);
  const [slots, setSlots] = useState([catalog[0], catalog[1], catalog[3] ?? catalog[2]]);
  const [selectedSlot, setSelectedSlot] = useState(1);

  const setSlotProduct = (slotIndex: number, product: ComparisonProduct) => {
    setSlots((current) => current.map((slot, index) => index === slotIndex ? product : slot));
  };

  const selected = slots[selectedSlot];
  const selectedBuildTotal = buildTotal - part.price + selected.price;
  const budgetDelta = budget - selectedBuildTotal;
  const rows = [
    ["Price", ...slots.map((slot) => `$${slot.price.toLocaleString()}`)],
    ["Gaming fit", ...slots.map((slot) => slot.gaming)],
    ["Productivity fit", ...slots.map((slot) => slot.productivity)],
    ["Value", ...slots.map((slot) => slot.value)],
    [part.id === "gpu" ? "VRAM" : "Primary specification", ...slots.map((slot) => slot.vram)],
    [part.id === "gpu" ? "Board power" : "Power / thermal", ...slots.map((slot) => slot.power)],
    ["Recommended PSU", ...slots.map((slot) => slot.psu)],
    [part.id === "gpu" ? "Physical length" : "Physical fit", ...slots.map((slot) => slot.length)],
    ["Target resolution", ...slots.map((slot) => slot.resolution)],
    ["New build total", ...slots.map((slot) => `$${(buildTotal - part.price + slot.price).toLocaleString()}`)],
    ["Budget remaining", ...slots.map((slot) => `$${(budget - (buildTotal - part.price + slot.price)).toLocaleString()}`)],
    ["Compatibility impact", ...slots.map((slot) => slot.compatibility)],
  ];

  return (
    <section className="wide-compare-workspace" aria-label={`${part.category} comparison workspace`}>
      <div className="wide-compare-scroll">
        <header className="wide-compare-header">
          <div>
            <span className="section-kicker">{part.category.toUpperCase()} COMPARISON</span>
            <h1>Compare three. Choose with confidence.</h1>
            <p>Every slot is locked to {part.category}. Whole-build effects are calculated below.</p>
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
            const recommendationClass = slot.label === "AI PICK" ? "ai-recommendation" : "";
            const userChoiceClass = slot.label === "USER CHOICE" ? "user-choice" : "";
            return (
              <article className={`compare-slot ${recommendationClass} ${userChoiceClass} ${selectedSlot === slotIndex ? "decision-selected" : ""}`} key={`${slot.id}-${slotIndex}`}>
                <SearchablePartCombobox
                  category={part.category}
                  products={catalog}
                  selected={slot}
                  slotIndex={slotIndex}
                  onSelect={(product) => setSlotProduct(slotIndex, product)}
                />
                <ProductVisual part={displayPart} failed={false} onFail={() => {}} />
                <span className={`compare-label label-${slot.label.toLowerCase().replaceAll(" ", "-")}`}>{slot.label}</span>
                <h2>{slot.name}</h2>
                <div className="compare-price"><strong>${slot.price}</strong><span>at {slot.retailer}</span></div>
                <span className={`slot-compatibility ${/note|review|requires/i.test(slot.compatibility) ? "warning" : ""}`}>
                  {/note|review|requires/i.test(slot.compatibility) ? <AlertTriangle size={13} /> : <CheckCircle2 size={13} />}
                  {slot.compatibility}
                </span>
                {slot.officialUrl && (
                  <a className="official-link" href={slot.officialUrl} target="_blank" rel="noreferrer" aria-label={`Open official page for ${slot.name} in a new tab`}>
                    Official page <span aria-hidden="true">↗</span>
                  </a>
                )}
                <button className={selectedSlot === slotIndex ? "slot-action active" : "slot-action"} onClick={() => setSelectedSlot(slotIndex)}>
                  {selectedSlot === slotIndex ? <Check size={14} /> : <GitCompareArrows size={14} />}
                  {slotIndex === 0 ? "Keep current" : selectedSlot === slotIndex ? "Selected replacement" : "Replace with this"}
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
                <div className={`${selectedSlot === valueIndex ? `selected-value ${slots[valueIndex].label === "AI PICK" ? "selected-ai" : slots[valueIndex].label === "USER CHOICE" ? "selected-user" : ""}` : ""} ${comparisonValueClass(label, value)}`.trim()} role="cell" key={`${label}-${valueIndex}`}>
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
              <div><CircleDollarSign size={17} /><span><small>PRICE DELTA</small><strong>{selected.price - part.price > 0 ? "+" : "−"}${Math.abs(selected.price - part.price)}</strong></span></div>
              <div><Gauge size={17} /><span><small>PERFORMANCE DELTA</small><strong>{selected.performanceDelta}</strong></span></div>
              <div><Target size={17} /><span><small>VALUE DELTA</small><strong>{selected.id === catalog[0].id ? "Baseline" : "+8 points"}</strong></span></div>
              <div><Zap size={17} /><span><small>POWER DELTA</small><strong>{selected.power === catalog[0].power ? "No change" : selected.power}</strong></span></div>
            </div>
            <div className="impact-grid">
              <div><h3><CheckCircle2 size={15} /> Main gains</h3><p>More budget flexibility, excellent 1440p performance, and lower sustained heat for quieter gaming.</p></div>
              <div><h3><AlertTriangle size={15} /> Main tradeoffs</h3><p>Less 4K headroom and a smaller ray-tracing margin in the most demanding titles.</p></div>
              <div><h3><ShieldCheck size={15} /> Whole-build impact</h3><p>No cross-category replacements required. Case clearance, platform, and power connections remain compatible.</p></div>
            </div>
          </div>
        </section>

        <section className="compare-ai-recommendation comparison-grid">
          <div className="comparison-section-label"><span>AI recommendation</span></div>
          <div className="compare-ai-recommendation-content">
            <span><Sparkles size={18} /></span>
            <div><small>AI RECOMMENDATION</small><h2>The {catalog[1].name} is the smartest match for your actual target.</h2><p>It preserves the high-refresh 1440p experience while returning meaningful budget and thermal headroom to the whole build.</p></div>
          </div>
        </section>
      </div>

      <footer className="compare-decision-bar comparison-grid">
        <div className="decision-bar-label"><span>Decision</span></div>
        <div className="decision-bar-content">
          <div className="decision-product"><small>SELECTED REPLACEMENT</small><strong>{selectedSlot === 0 ? "Keep current part" : selected.name}</strong></div>
          <div><small>NEW BUILD TOTAL</small><strong>${selectedBuildTotal.toLocaleString()}</strong></div>
          <div><small>BUDGET DELTA</small><strong className={budgetDelta >= 0 ? "budget-positive-text" : "warning-text"}>{budgetDelta >= 0 ? `$${budgetDelta} remaining` : `$${Math.abs(budgetDelta)} over`}</strong></div>
          <div><small>COMPATIBILITY</small><strong className="positive-text"><ShieldCheck size={14} /> {selected.compatibility}</strong></div>
          <div className="decision-actions"><button className="outline-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={selectedSlot === 0} onClick={() => onReplace({ ...part, name: selected.name, price: selected.price, retailer: selected.retailer })}>Replace Current Part <ArrowRight size={15} /></button></div>
        </div>
      </footer>
    </section>
  );
}

function BuildWorkspace() {
  const [selectedId, setSelectedId] = useState("gpu");
  const [detailPart, setDetailPart] = useState<Part | null>(null);
  const [comparePart, setComparePart] = useState<Part | null>(null);
  const [replacementPart, setReplacementPart] = useState<Part | null>(null);
  const [shoppingOpen, setShoppingOpen] = useState(false);
  const [warningOpen, setWarningOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"needs" | "build" | "summary">("build");
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const [chatText, setChatText] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const total = useMemo(() => parts.reduce((sum, part) => sum + part.price, 0), []);
  const budget = 2500;
  const delta = budget - total;
  const selectedPart = parts.find((part) => part.id === selectedId) ?? parts[1];
  const openCompare = (part: Part) => {
    setDetailPart(null);
    setComparePart(part);
  };
  const toggleImageFailure = (id: string) => setFailedImages((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const sendMessage = () => {
    if (!chatText.trim()) return;
    setMessages((current) => [...current, chatText.trim()]);
    setChatText("");
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
            buildTotal={total}
            budget={budget}
            onClose={() => setComparePart(null)}
            onReplace={(nextPart) => {
              setComparePart(null);
              setReplacementPart(nextPart);
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
                    <div className="part-meta"><span>{part.category}</span><span className={`stock ${part.stockTone}`}>{part.stock}</span></div>
                    <h3>{part.name}</h3>
                    <p className="workload-fit">{workloadFit(part)}</p>
                    <div className="spec-list">{part.specs.slice(0, 3).map((spec) => <span key={spec}>{spec}</span>)}</div>
                    <p className="selection-reason">{part.reason}</p>
                  </div>
                  <div className="part-actions">
                    <div className="price-block"><strong>${part.price.toLocaleString()}</strong><span>at {part.retailer}</span></div>
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
              <div className="compare-product recommended"><span className="choice-tag"><BadgeCheck size={13} /> BEST VALUE</span><ProductVisual part={comparePart} failed={false} onFail={() => {}} /><h3>{replacement.name}</h3><strong>${replacement.price}</strong></div>
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

          {detailPart && <div className="center-overlay detail-overlay" role="dialog" aria-modal="true" aria-label="Component details">
            <div className="overlay-header"><div><span className="section-kicker">{detailPart.category}</span><h2>{detailPart.name}</h2></div><button className="icon-button" onClick={() => setDetailPart(null)} aria-label="Close details"><X size={18} /></button></div>
            <div className="detail-layout"><ProductVisual part={detailPart} failed={failedImages.includes(detailPart.id)} onFail={() => toggleImageFailure(detailPart.id)} /><div><span className="detail-price">${detailPart.price} <small>at {detailPart.retailer}</small></span>{detailPart.officialUrl && <a className="official-link detail-official-link" href={detailPart.officialUrl} target="_blank" rel="noreferrer" aria-label={`Open official page for ${detailPart.name} in a new tab`}>Official page <span aria-hidden="true">↗</span></a>}<p>{detailPart.reason}</p><h4>What you need to know</h4><ul>{detailPart.specs.map((spec) => <li key={spec}><Check size={14} /> {spec}</li>)}<li><ShieldCheck size={14} /> {detailPart.compatibility}</li></ul></div></div>
            <div className="detail-footer"><button className="outline-button" onClick={() => toggleImageFailure(detailPart.id)}><ImageOff size={15} /> Toggle image failure</button><button className="primary-button" onClick={() => openCompare(detailPart)}>Compare alternatives <ArrowRight size={15} /></button></div>
          </div>}
        </section>

        <aside className={`summary-rail ${mobilePanel === "summary" ? "mobile-active" : ""}`}>
          <div className="summary-top"><div className="summary-heading"><span className="section-kicker">DECISION RECEIPT</span></div><div className="total-price"><span>Estimated build total</span><strong>${total.toLocaleString()}</strong><small>8 selected components</small></div><div className="budget-status"><div><span>Target budget</span><strong>${budget.toLocaleString()}</strong></div><div><span>{delta >= 0 ? "Remaining" : "Over budget"}</span><strong className={delta >= 0 ? "semantic-excellent" : "semantic-risk"}>${Math.abs(delta)}</strong></div><p className={delta >= 0 ? "semantic-excellent" : "semantic-risk"}>{delta >= 0 ? "9% below your target" : "Budget adjustment required"}</p></div></div>
          <div className="receipt-metrics">
            <button className="receipt-row receipt-warning" onClick={() => setWarningOpen(!warningOpen)}><span>Compatibility</span><strong className="semantic-caution">1 note to review</strong><ChevronRight size={15} /></button>
            {warningOpen && <div className="warning-detail"><strong>Power headroom is tight</strong><p>The 850W PSU is safe for this build, but leaves limited room for a future flagship GPU.</p><button onClick={() => setReplacementPart(parts[6])}>Review PSU options</button></div>}
            <div className="receipt-row"><span>Target performance<small>1440p high refresh</small></span><strong className="semantic-excellent">94</strong></div>
            <div className="receipt-row"><span>Value<small>Strong price-to-performance</small></span><strong className="semantic-strong">89</strong></div>
            <div className="receipt-row"><span>Estimated power<small>72% of PSU capacity</small></span><strong className="semantic-strong">612W</strong></div>
            <div className="receipt-row"><span>PSU headroom<small>Safe now, tighter for a flagship upgrade</small></span><strong className="semantic-caution">238W</strong></div>
          </div>
          <p className="receipt-insight"><strong>Well balanced.</strong> The GPU carries the target resolution while the CPU protects high-frame-rate responsiveness.</p>
          <div className="summary-footer"><button className="primary-button shopping-button" onClick={() => setShoppingOpen(true)}><ShoppingBag size={17} /> Preview shopping list <ArrowRight size={16} /></button><button className="save-button"><ClipboardList size={15} /> Save or export build</button><p><ShieldCheck size={12} /> Compatibility checked across 14 rules</p></div>
        </aside>
        </>)}
      </main>

      <nav className={`mobile-tabs ${comparePart ? "compare-open" : ""}`} aria-label="Workspace sections"><button className={mobilePanel === "needs" ? "active" : ""} onClick={() => setMobilePanel("needs")}><PanelLeft size={18} />Needs</button><button className={mobilePanel === "build" ? "active" : ""} onClick={() => setMobilePanel("build")}><Cpu size={18} />Build</button><button className={mobilePanel === "summary" ? "active" : ""} onClick={() => setMobilePanel("summary")}><ClipboardList size={18} />Summary</button></nav>

      {replacementPart && <div className="modal-scrim" role="dialog" aria-modal="true" aria-label="Confirm replacement"><div className="confirm-modal">
        <div className="confirm-icon"><GitCompareArrows size={22} /></div><span className="section-kicker">PREVIEW CHANGE</span><h2>Replace {replacementPart.category}?</h2><p>This prototype will preview the lower-cost alternative. Your current selection is preserved until you confirm.</p>
        <div className="replacement-summary"><div><span>Current</span><strong>{replacementPart.name}</strong><small>${replacementPart.price}</small></div><ArrowRight size={18} /><div><span>Alternative</span><strong>{replacementPart.id === "gpu" ? replacement.name : `Recommended ${replacementPart.category} alternative`}</strong><small>${Math.max(79, replacementPart.price - 40)}</small></div></div>
        <div className="confirm-actions"><button className="outline-button" onClick={() => setReplacementPart(null)}>Keep current part</button><button className="primary-button" onClick={() => setReplacementPart(null)}><Check size={15} /> Confirm replacement</button></div>
      </div></div>}

      {shoppingOpen && <div className="modal-scrim" role="dialog" aria-modal="true" aria-label="Shopping list preview"><div className="shopping-modal">
        <div className="overlay-header"><div><span className="section-kicker">PURCHASE PLAN</span><h2>Shopping list preview</h2></div><button className="icon-button" onClick={() => setShoppingOpen(false)} aria-label="Close shopping list"><X size={18} /></button></div>
        <div className="shopping-summary"><PackageCheck size={21} /><div><strong>8 parts from 3 retailers</strong><span>All prices are reference estimates</span></div><strong>${total.toLocaleString()}</strong></div>
        <div className="shopping-list">{parts.map((part) => <div key={part.id}><span className="shop-icon"><part.Icon size={16} /></span><p><strong>{part.name}</strong><small>{part.retailer} · {part.stock}</small></p><strong>${part.price}</strong></div>)}</div>
        <div className="shopping-actions"><button className="outline-button" onClick={() => setShoppingOpen(false)}>Back to build</button><button className="primary-button"><ShoppingBag size={15} /> Open purchase references</button></div>
      </div></div>}
    </div>
  );
}

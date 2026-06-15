export type MetricDir = "higher" | "lower" | "neutral";

export type Metric = {
  key: string;
  label: string;
  dir: MetricDir;
  /** customer-facing one-liner */
  hint?: string;
  /** raw numeric for comparison; if absent we compare formatted string equality */
  value: (o: ComparableOption) => number | null;
  /** display string */
  format: (o: ComparableOption) => string;
};

export type ComparableOption = {
  id: string;
  name: string;
  category: string;
  price: number;
  perfScore: number;
  vramGb?: number;
  powerW: number;
  fps4k?: number;
  renderScore?: number;
  thermal: "Cool" | "Warm" | "Hot";
  stock: "Ready" | "Low" | "Out";
  compatible: boolean;
  reason: string;
  salesNote: string;
  beginnerNote: string;
  tag?: "current" | "budget" | "alt";
};

export const GPU_OPTIONS: ComparableOption[] = [
  {
    id: "rtx-4080s",
    category: "GPU",
    name: "NVIDIA RTX 4080 Super 16GB",
    price: 999,
    perfScore: 92,
    vramGb: 16,
    powerW: 320,
    fps4k: 85,
    renderScore: 88,
    thermal: "Warm",
    stock: "Ready",
    compatible: true,
    reason: "Balanced pick for 4K editing + AAA gaming at $1k",
    salesNote: "Best if your creative apps benefit from CUDA acceleration.",
    beginnerNote: "Smooth 4K gaming and fast video editing without overspending.",
    tag: "current",
  },
  {
    id: "rtx-4070tis",
    category: "GPU",
    name: "NVIDIA RTX 4070 Ti Super 16GB",
    price: 799,
    perfScore: 82,
    vramGb: 16,
    powerW: 285,
    fps4k: 68,
    renderScore: 78,
    thermal: "Cool",
    stock: "Ready",
    compatible: true,
    reason: "Best value if you do not need max 4K FPS",
    salesNote: "Good fit for 1440p gaming while leaving budget for a better monitor.",
    beginnerNote: "Saves $200, still great for 1440p gaming and editing.",
    tag: "budget",
  },
  {
    id: "rtx-4090",
    category: "GPU",
    name: "NVIDIA RTX 4090 24GB",
    price: 1799,
    perfScore: 100,
    vramGb: 24,
    powerW: 450,
    fps4k: 110,
    renderScore: 100,
    thermal: "Hot",
    stock: "Low",
    compatible: true,
    reason: "Max performance for 8K timelines and pro 3D work",
    salesNote: "Requires a 1000W PSU upgrade, so check compatibility before choosing it.",
    beginnerNote: "Overkill for most builds. Consider it only if budget is flexible.",
    tag: "alt",
  },
];

export const CPU_OPTIONS: ComparableOption[] = [
  {
    id: "i7-14700k",
    category: "CPU",
    name: "Intel Core i7-14700K",
    price: 409,
    perfScore: 84,
    powerW: 253,
    renderScore: 80,
    thermal: "Warm",
    stock: "Ready",
    compatible: true,
    reason: "Strong value for editing + gaming without the i9 premium",
    salesNote: "Pairs well with a value air cooler if you want to save money.",
    beginnerNote: "Saves ~$180, still excellent for 4K editing and gaming.",
    tag: "budget",
  },
  {
    id: "i9-14900k",
    category: "CPU",
    name: "Intel Core i9-14900K",
    price: 589,
    perfScore: 95,
    powerW: 320,
    renderScore: 92,
    thermal: "Hot",
    stock: "Ready",
    compatible: true,
    reason: "Balanced flagship for heavy multi-track editing",
    salesNote: "The 24-core layout helps with Premiere and DaVinci exports.",
    beginnerNote: "Best balanced choice for 4K editing and gaming.",
    tag: "current",
  },
  {
    id: "r9-7950x3d",
    category: "CPU",
    name: "AMD Ryzen 9 7950X3D",
    price: 649,
    perfScore: 97,
    powerW: 280,
    renderScore: 94,
    thermal: "Warm",
    stock: "Low",
    compatible: false,
    reason: "Highest gaming CPU but requires AM5 motherboard swap",
    salesNote: "Choose this only if you want an AMD platform, because it needs an AM5 board.",
    beginnerNote: "Top-tier gaming, but switching to AMD adds cost.",
    tag: "alt",
  },
];

export const CPU_METRICS: Metric[] = [
  {
    key: "price",
    label: "Price",
    dir: "lower",
    hint: "Lower price helps the budget.",
    value: (o) => o.price,
    format: (o) => `$${o.price.toLocaleString()}`,
  },
  {
    key: "perf",
    label: "Performance Score",
    dir: "higher",
    hint: "Higher = faster overall.",
    value: (o) => o.perfScore,
    format: (o) => `${o.perfScore} / 100`,
  },
  {
    key: "render",
    label: "Editing / Rendering",
    dir: "higher",
    hint: "Higher = faster Premiere / DaVinci exports.",
    value: (o) => o.renderScore ?? null,
    format: (o) => (o.renderScore ? `${o.renderScore} / 100` : "—"),
  },
  {
    key: "power",
    label: "Power Draw",
    dir: "lower",
    hint: "Lower wattage = cheaper PSU and less heat.",
    value: (o) => o.powerW,
    format: (o) => `${o.powerW} W`,
  },
  {
    key: "thermal",
    label: "Thermal Requirement",
    dir: "neutral",
    hint: "Hotter CPUs need stronger cooling.",
    value: (o) => ({ Cool: 1, Warm: 2, Hot: 3 })[o.thermal],
    format: (o) => o.thermal,
  },
  {
    key: "stock",
    label: "Stock",
    dir: "neutral",
    hint: "Mock availability in this demo.",
    value: (o) => ({ Ready: 3, Low: 2, Out: 1 })[o.stock],
    format: (o) => o.stock,
  },
  {
    key: "compat",
    label: "Compatibility",
    dir: "neutral",
    hint: "Fits the current motherboard without swaps.",
    value: (o) => (o.compatible ? 1 : 0),
    format: (o) => (o.compatible ? "Compatible" : "Needs board swap"),
  },
];


export const GPU_METRICS: Metric[] = [
  {
    key: "price",
    label: "Price",
    dir: "lower",
    hint: "Lower price is better for your budget.",
    value: (o) => o.price,
    format: (o) => `$${o.price.toLocaleString()}`,
  },
  {
    key: "perfScore",
    label: "Performance Score",
    dir: "higher",
    hint: "Higher is faster overall.",
    value: (o) => o.perfScore,
    format: (o) => `${o.perfScore} / 100`,
  },
  {
    key: "vram",
    label: "VRAM",
    dir: "higher",
    hint: "More VRAM = bigger video timelines and 4K textures.",
    value: (o) => o.vramGb ?? null,
    format: (o) => (o.vramGb ? `${o.vramGb} GB` : "—"),
  },
  {
    key: "power",
    label: "Power Draw",
    dir: "lower",
    hint: "Lower wattage means cheaper PSU and less heat.",
    value: (o) => o.powerW,
    format: (o) => `${o.powerW} W`,
  },
  {
    key: "fps4k",
    label: "Est. 4K FPS",
    dir: "higher",
    hint: "Frames per second in modern AAA titles.",
    value: (o) => o.fps4k ?? null,
    format: (o) => (o.fps4k ? `${o.fps4k} FPS` : "—"),
  },
  {
    key: "render",
    label: "Editing / Rendering",
    dir: "higher",
    hint: "Higher = faster Premiere / DaVinci exports.",
    value: (o) => o.renderScore ?? null,
    format: (o) => (o.renderScore ? `${o.renderScore} / 100` : "—"),
  },
  {
    key: "thermal",
    label: "Thermal Requirement",
    dir: "neutral",
    hint: "Hotter cards need stronger case airflow.",
    value: (o) => ({ Cool: 1, Warm: 2, Hot: 3 })[o.thermal],
    format: (o) => o.thermal,
  },
  {
    key: "stock",
    label: "Stock",
    dir: "neutral",
    hint: "Mock availability in this demo.",
    value: (o) => ({ Ready: 3, Low: 2, Out: 1 })[o.stock],
    format: (o) => o.stock,
  },
];

export type Verdict = "better" | "worse" | "similar";

export function verdict(metric: Metric, options: ComparableOption[], current: ComparableOption): Verdict {
  if (metric.dir === "neutral") return "similar";
  const vals = options.map((o) => metric.value(o)).filter((v): v is number => v !== null);
  if (vals.length < 2) return "similar";
  const best = metric.dir === "higher" ? Math.max(...vals) : Math.min(...vals);
  const worst = metric.dir === "higher" ? Math.min(...vals) : Math.max(...vals);
  const v = metric.value(current);
  if (v === null) return "similar";
  if (v === best && best !== worst) return "better";
  if (v === worst && best !== worst) return "worse";
  return "similar";
}
export const COMPARE_DATA: Record<
  string,
  { options: ComparableOption[]; metrics: Metric[]; originalId: string; goal: string }
> = {
  GPU: {
    options: GPU_OPTIONS,
    metrics: GPU_METRICS,
    originalId: "rtx-4080s",
    goal: "4K video editing + casual gaming",
  },
  CPU: {
    options: CPU_OPTIONS,
    metrics: CPU_METRICS,
    originalId: "i9-14900k",
    goal: "Heavy multi-track editing + gaming",
  },
};

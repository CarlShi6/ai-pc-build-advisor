import { categoryLabels } from "@/data/seedParts";
import { getPartSummarySpecs } from "@/lib/build-advisor";
import { cn } from "@/lib/utils";
import type { Build } from "@/types/build";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowRightLeft, CheckCircle2, Eye, GitCompare, Layers, XCircle } from "lucide-react";

export type LegacyBuildPart = {
  category: string;
  name: string;
  price: number;
};

export const SAMPLE_BUILD: LegacyBuildPart[] = [
  { category: "CPU", name: "Intel Core i9-14900K 24-Core Processor", price: 589.99 },
  { category: "GPU", name: "NVIDIA GeForce RTX 4080 Super 16GB Founders Edition", price: 999.0 },
  { category: "RAM", name: "Corsair Vengeance RGB 64GB (2x32GB) DDR5-6400", price: 214.99 },
  { category: "MOBO", name: "ASUS ROG Maximus Z790 Hero WiFi", price: 489.99 },
  { category: "SSD", name: "Samsung 990 PRO 2TB NVMe PCIe 4.0", price: 179.99 },
  { category: "PSU", name: "Corsair RM850x 850W 80+ Gold Modular", price: 149.99 },
  { category: "CASE", name: "Lian Li O11 Dynamic EVO Black", price: 159.99 },
];

type BuildCardRow = {
  id: string;
  category: string;
  categoryLabel: string;
  name: string;
  price: number;
  specs: string[];
};

type BuildCardProps = {
  build?: Build;
  parts?: LegacyBuildPart[];
  focusedCategory?: string;
  onFocus?: (category: string) => void;
  onCompare?: (category: string) => void;
  compact?: boolean;
};

function formatMoney(value: number) {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function normalizeRows(build?: Build, parts?: LegacyBuildPart[]) {
  if (build) {
    return build.parts.map((part) => ({
      id: part.id,
      category: part.category,
      categoryLabel: categoryLabels[part.category],
      name: part.displayName,
      price: part.price,
      specs: getPartSummarySpecs(part),
    }));
  }

  return (parts ?? SAMPLE_BUILD).map((part) => ({
    id: part.category,
    category: part.category,
    categoryLabel: part.category,
    name: part.name,
    price: part.price,
    specs: [],
  }));
}

export function PerfStat({
  label,
  value,
  pct,
  tone = "primary",
}: {
  label: string;
  value: string;
  pct: number;
  tone?: "primary" | "success";
}) {
  const bar = tone === "success" ? "bg-success" : "bg-primary";
  return (
    <div className="flex flex-col items-center rounded-2xl border border-border bg-card p-4 text-center">
      <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <div className="text-2xl font-bold">{value}</div>
      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-secondary">
        <div className={`h-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function BuildCard({
  build,
  parts = SAMPLE_BUILD,
  focusedCategory,
  onFocus,
  onCompare,
  compact = false,
}: BuildCardProps) {
  return (
    <BuildCardInner
      build={build}
      parts={parts}
      focusedCategory={focusedCategory}
      onFocus={onFocus}
      onCompare={onCompare}
      compact={compact}
    />
  );
}

export function BuildCardInner({
  build,
  parts = SAMPLE_BUILD,
  focusedCategory,
  onFocus,
  onCompare,
  compact = false,
}: BuildCardProps) {
  const rows = normalizeRows(build, parts);
  const total = build?.totalPrice ?? rows.reduce((sum, part) => sum + part.price, 0);
  const status = build?.compatibilityStatus ?? "pass";
  const warningCount = build?.compatibilityWarnings.length ?? 0;
  const statusMeta =
    status === "pass"
      ? {
          icon: CheckCircle2,
          pillClass: "bg-success/15 text-success",
          dotClass: "bg-success",
          label: "All parts compatible",
        }
      : status === "warning"
        ? {
            icon: AlertTriangle,
            pillClass: "bg-warning/15 text-warning",
            dotClass: "bg-warning",
            label: `${warningCount} compatibility warning${warningCount === 1 ? "" : "s"}`,
          }
        : {
            icon: XCircle,
            pillClass: "bg-destructive/15 text-destructive",
            dotClass: "bg-destructive",
            label: `${warningCount} compatibility issue${warningCount === 1 ? "" : "s"}`,
          };
  const StatusIcon = statusMeta.icon;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Badge className="mb-3 rounded-md bg-primary/10 text-primary">
            {build ? "Live Mock Recommendation" : "Build #A7-22"}
          </Badge>
          <h2 className="text-4xl font-bold tracking-tight">
            {build?.name ?? "Production Master Pro"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {build
              ? `${build.targetUseCase.join(" + ")}. Click any part to compare alternatives.`
              : "Tuned for 4K editing and high-FPS gaming. Updated 2 mins ago."}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Estimated Total</p>
          <p className="font-mono text-5xl font-bold text-primary">{formatMoney(total)}</p>
        </div>
      </div>

      {!compact && (
        <div className="grid grid-cols-3 gap-4">
          <PerfStat label="Budget Use" value={`${Math.round((total / (build?.budget ?? 2800)) * 100)}%`} pct={Math.min(Math.round((total / (build?.budget ?? 2800)) * 100), 100)} />
          <PerfStat label="Compatibility" value={status === "pass" ? "Ready" : status === "warning" ? "Review" : "Needs review"} pct={status === "pass" ? 100 : status === "warning" ? 72 : 38} tone={status === "fail" ? "primary" : "success"} />
          <PerfStat label="Parts Selected" value={`${rows.length}`} pct={Math.min(rows.length * 12, 100)} />
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border bg-secondary/40 p-4">
          <div>
            <h3 className="text-base font-semibold">Components</h3>
            <p className="text-xs text-muted-foreground">
              Click any row to view alternatives, or use the action buttons.
            </p>
          </div>
          <div className={cn("flex items-center gap-2 rounded-full px-3 py-1 text-xs", statusMeta.pillClass)}>
            <span className={cn("size-2 rounded-full", statusMeta.dotClass)} />
            <StatusIcon className="size-3.5" />
            <span>{statusMeta.label}</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-6 py-4 font-medium">Category</th>
                <th className="px-6 py-4 font-medium">Part Name</th>
                <th className="px-6 py-4 text-right font-medium">Price</th>
                {(onFocus || onCompare) && <th className="px-6 py-4 text-right font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {rows.map((part) => (
                <tr
                  key={part.id}
                  onClick={() => onFocus?.(part.category)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onFocus?.(part.category);
                    }
                  }}
                  role={onFocus ? "button" : undefined}
                  tabIndex={onFocus ? 0 : undefined}
                  aria-label={`Compare or replace ${part.categoryLabel}`}
                  className={cn(
                    "group transition-colors",
                    onFocus &&
                      "cursor-pointer hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    focusedCategory === part.category &&
                      "bg-primary/10 outline outline-1 -outline-offset-1 outline-primary/50",
                  )}
                >
                  <td className="px-6 py-4 font-mono text-xs">
                    <span
                      className={cn(
                        "rounded-md px-2 py-0.5",
                        focusedCategory === part.category ? "bg-primary/20 text-primary" : "text-muted-foreground",
                      )}
                    >
                      {part.categoryLabel}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{part.name}</span>
                        {focusedCategory === part.category && (
                          <Badge className="rounded-md bg-primary/15 text-[10px] text-primary">
                            <Eye className="mr-1 size-3" /> Currently Viewing
                          </Badge>
                        )}
                      </div>
                      {(onFocus || onCompare) && (
                        <div className="inline-flex w-fit items-center gap-2 rounded-lg border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                          <ArrowRightLeft className="size-3" />
                          Compare or replace this {part.categoryLabel.toLowerCase()}
                        </div>
                      )}
                      {part.specs.length > 0 && (
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {part.specs.map((spec) => (
                            <span key={spec} className="rounded-md border border-border bg-background/60 px-2 py-1">
                              {spec}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right font-mono">{formatMoney(part.price)}</td>
                  {(onFocus || onCompare) && (
                    <td className="px-6 py-4 text-right">
                      <RowActions category={part.category} categoryLabel={part.categoryLabel} onCompare={onCompare} onFocus={onFocus} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {!compact && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6">
          <div className="grid gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <h4 className="text-lg font-bold text-primary">Build Insight</h4>
              <p className="mt-1 text-sm text-muted-foreground">
                {build
                  ? "This build updates from mock data, so replacements flow through pricing, warnings, and purchase references."
                  : "Compare a lower-cost GPU or a stronger PSU before finalizing the parts list."}
              </p>
            </div>
            <div className="flex gap-8">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Budget</p>
                <p className="font-mono text-lg font-bold">
                  {build ? formatMoney(build.budget - total) : "$342.10"}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Status</p>
                <p className={cn("text-lg font-bold", status === "pass" ? "text-success" : status === "warning" ? "text-warning" : "text-destructive")}>
                  {status === "pass" ? "READY" : status === "warning" ? "REVIEW" : "FIX"}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-6 flex gap-4">
            <Button variant="secondary" className="flex-1 rounded-xl py-6 font-semibold">
              Save Draft
            </Button>
            <Button className="flex-1 rounded-xl py-6 font-semibold shadow-glow">
              View Purchase References
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function RowActions({
  category,
  categoryLabel,
  onCompare,
  onFocus,
}: {
  category: string;
  categoryLabel: string;
  onCompare?: (category: string) => void;
  onFocus?: (category: string) => void;
}) {
  const isPrimary =
    category === "gpu" || category === "cpu" || category === "GPU" || category === "CPU";
  const compareLabel = isPrimary ? "Compare / Replace" : "Replace";

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button
        size="sm"
        variant={isPrimary ? "default" : "secondary"}
        className="h-9 rounded-md px-3 text-xs font-semibold"
        onClick={(event) => {
          event.stopPropagation();
          (onCompare ?? onFocus)?.(category);
        }}
      >
        {isPrimary ? (
          <GitCompare className="mr-1 size-3" />
        ) : (
          <Layers className="mr-1 size-3" />
        )}
        {compareLabel}
      </Button>
      <span className="hidden items-center gap-1 text-xs text-muted-foreground xl:inline-flex">
        <ArrowRightLeft className="size-3" /> Open {categoryLabel.toLowerCase()} drawer
      </span>
    </div>
  );
}

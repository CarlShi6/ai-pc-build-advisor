import { categoryLabels } from "@/data/seedParts";
import {
  getCategoryComparisonFields,
  getCompatibilityNotesForPart,
  getPartPowerRequirement,
  getPartSummarySpecs,
} from "@/lib/build-advisor";
import { calculateBuildTotal, deriveCompatibilityStatus, evaluateCompatibility } from "@/lib/compatibility";
import { cn } from "@/lib/utils";
import type { Build } from "@/types/build";
import type { Part, PartCategory } from "@/types/parts";
import { useEffect, useMemo, useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowRightLeft, Check, GitCompare, LoaderCircle, Sparkles } from "lucide-react";

function formatMoney(value: number) {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function buildCandidate(build: Build, replacement: Part) {
  const parts = build.parts.map((part) => (part.category === replacement.category ? replacement : part));
  const candidate: Build = {
    ...build,
    parts,
    totalPrice: calculateBuildTotal(parts),
    compatibilityWarnings: [],
    compatibilityStatus: "pass",
  };
  const warnings = evaluateCompatibility(candidate);

  return {
    ...candidate,
    compatibilityWarnings: warnings,
    compatibilityStatus: deriveCompatibilityStatus(warnings),
  };
}

function formatSpecValue(value: string | number | boolean | undefined, suffix?: string) {
  if (value === undefined) {
    return "N/A";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return `${value}${suffix ?? ""}`;
}

function getPerformanceFit(part: Part) {
  if (typeof part.performanceScore === "number") {
    return part.performanceScore;
  }

  const score =
    part.specs.gaming4kScore ??
    part.specs.gaming1440pScore ??
    part.specs.productivityScore ??
    part.specs.gamingScore;

  return typeof score === "number" ? score : null;
}

function getValueRating(part: Part) {
  if (typeof part.valueScore === "number") {
    return part.valueScore;
  }

  const fit = getPerformanceFit(part);

  if (fit !== null) {
    return Math.max(1, Math.min(100, Math.round((fit / part.price) * 700)));
  }

  return Math.max(1, Math.min(100, Math.round((250 / part.price) * 40)));
}

function sortParts(parts: Part[], selectedPart: Part, mode: string) {
  return [...parts].sort((left, right) => {
    if (left.id === selectedPart.id) {
      return -1;
    }

    if (right.id === selectedPart.id) {
      return 1;
    }

    if (mode === "performance") {
      return (getPerformanceFit(right) ?? 0) - (getPerformanceFit(left) ?? 0) || right.price - left.price;
    }

    if (mode === "value") {
      return getValueRating(right) - getValueRating(left) || left.price - right.price;
    }

    return left.price - right.price;
  });
}

export function CompareDrawer({
  build,
  category,
  parts,
  open,
  isLoading,
  isReplacing,
  errorMessage,
  recommendedReplacementId,
  onOpenChange,
  onReplace,
}: {
  build: Build | null;
  category: string | null;
  parts: Part[];
  open: boolean;
  isLoading?: boolean;
  isReplacing?: boolean;
  errorMessage?: string | null;
  recommendedReplacementId?: string | null;
  onOpenChange: (open: boolean) => void;
  onReplace: (part: Part) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState("price");

  const selectedPart = build?.parts.find((part) => part.category === category);
  const sectionTitle = selectedPart ? categoryLabels[selectedPart.category] : "Part";

  const sameCategoryParts = useMemo(() => {
    if (!selectedPart) {
      return [];
    }

    const byId = new Map<string, Part>();
    [selectedPart, ...parts.filter((part) => part.category === selectedPart.category)].forEach((part) => {
      byId.set(part.id, part);
    });

    return sortParts(Array.from(byId.values()), selectedPart, sortMode);
  }, [parts, selectedPart, sortMode]);

  useEffect(() => {
    if (!open || !selectedPart) {
      return;
    }

    const recommendedIds = [selectedPart.id, recommendedReplacementId].filter(
      (id): id is string => Boolean(id),
    );
    const fallbackIds = sameCategoryParts.slice(0, 4).map((part) => part.id);
    const nextIds = Array.from(new Set([...recommendedIds, ...fallbackIds])).slice(0, 4);

    setSelectedIds(nextIds.length >= 2 ? nextIds : sameCategoryParts.map((part) => part.id).slice(0, 4));
  }, [open, recommendedReplacementId, sameCategoryParts, selectedPart]);

  if (!build || !category || !selectedPart) {
    return null;
  }

  const alternatives = sameCategoryParts.filter((part) => part.id !== selectedPart.id);
  const comparisonParts = selectedIds
    .map((id) => sameCategoryParts.find((part) => part.id === id))
    .filter((part): part is Part => Boolean(part));
  const comparisonFields = getCategoryComparisonFields(selectedPart.category as PartCategory);

  function toggleComparePart(part: Part) {
    setSelectedIds((current) => {
      if (part.id === selectedPart.id) {
        return current.includes(part.id) ? current : [part.id, ...current].slice(0, 4);
      }

      if (current.includes(part.id)) {
        const next = current.filter((id) => id !== part.id);
        return next.includes(selectedPart.id) ? next : [selectedPart.id, ...next].slice(0, 4);
      }

      if (current.length >= 4) {
        return current;
      }

      return [...current, part.id];
    });
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto flex max-h-[90vh] w-full max-w-7xl flex-col rounded-t-[28px] border-primary/20 bg-background">
        <DrawerHeader className="border-b border-border px-6 pb-5 pt-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <Badge className="w-fit rounded-md border border-primary/30 bg-primary/10 text-primary">
                <GitCompare className="mr-1 size-3" /> Part Compare Drawer
              </Badge>
              <div>
                <DrawerTitle className="text-2xl">Compare {sectionTitle} options</DrawerTitle>
                <DrawerDescription className="mt-1 max-w-2xl">
                  Select 2 to 4 same-category parts, review the fields that matter for this category,
                  then replace the current pick when you find the better fit.
                </DrawerDescription>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Current total</p>
              <p className="font-mono text-2xl font-bold text-primary">{formatMoney(build.totalPrice)}</p>
            </div>
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-4 pt-6">
          <section className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Current Selection</p>
                <h3 className="mt-1 text-xl font-bold">{selectedPart.displayName}</h3>
              </div>
              <Badge className="rounded-md border border-primary/30 bg-primary/15 text-primary">
                <Check className="mr-1 size-3" /> In build now
              </Badge>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.1fr_1.4fr]">
              <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
                <InfoRow label="Price" value={formatMoney(selectedPart.price)} />
                <InfoRow label="Power requirement" value={getPartPowerRequirement(selectedPart)} />
                <InfoRow
                  label="Recommendation reason"
                  value={selectedPart.recommendationReason ?? "Chosen for balance in this mock build."}
                />
              </div>
              <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Key specs</p>
                <div className="flex flex-wrap gap-2">
                  {getPartSummarySpecs(selectedPart).map((spec) => (
                    <span key={spec} className="rounded-md border border-border bg-background/60 px-2.5 py-1 text-xs">
                      {spec}
                    </span>
                  ))}
                </div>
                <div className="space-y-2">
                  {getCompatibilityNotesForPart(build, selectedPart).map((note) => (
                    <p key={note} className="rounded-xl border border-border bg-background/60 px-3 py-2 text-sm text-muted-foreground">
                      {note}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="mt-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold">Choose parts to compare</h3>
                <p className="text-sm text-muted-foreground">
                  The current part stays available for context. Pick up to four columns.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {["price", "value", "performance"].map((mode) => (
                  <Button
                    key={mode}
                    size="sm"
                    variant={sortMode === mode ? "default" : "secondary"}
                    className="rounded-md capitalize"
                    onClick={() => setSortMode(mode)}
                  >
                    {mode}
                  </Button>
                ))}
                <Badge variant="secondary" className="rounded-md">
                  {alternatives.length} alternatives
                </Badge>
              </div>
            </div>

            {recommendedReplacementId && (
              <div className="rounded-2xl border border-success/25 bg-success/10 px-4 py-3 text-sm text-success">
                A recommended fix is highlighted because it resolves the selected compatibility warning.
              </div>
            )}

            {isLoading ? (
              <div className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 p-8 text-sm text-muted-foreground">
                <LoaderCircle className="mr-2 size-4 animate-spin" />
                Loading {sectionTitle.toLowerCase()} alternatives
              </div>
            ) : errorMessage ? (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
                {errorMessage}
              </div>
            ) : sameCategoryParts.length < 2 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-sm text-muted-foreground">
                This category needs at least two mock parts before comparison is useful.
              </div>
            ) : (
              <>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {sameCategoryParts.map((part) => {
                    const checked = selectedIds.includes(part.id);
                    const isCurrent = part.id === selectedPart.id;
                    const isRecommendedFix = part.id === recommendedReplacementId;
                    const delta = part.price - selectedPart.price;

                    return (
                      <button
                        key={part.id}
                        type="button"
                        className={cn(
                          "min-h-44 rounded-2xl border p-4 text-left transition-colors",
                          checked ? "border-primary/50 bg-primary/10" : "border-border bg-card hover:border-primary/30",
                          isRecommendedFix && "border-success/50 bg-success/[0.07]",
                        )}
                        onClick={() => toggleComparePart(part)}
                        aria-pressed={checked}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-2">
                            <div className="flex flex-wrap gap-2">
                              {isCurrent && <Badge className="rounded-md bg-primary/15 text-primary">Current</Badge>}
                              {isRecommendedFix && (
                                <Badge className="rounded-md border border-success/30 bg-success/15 text-success">
                                  <Sparkles className="mr-1 size-3" /> Fix
                                </Badge>
                              )}
                            </div>
                            <h4 className="font-bold leading-snug">{part.displayName}</h4>
                          </div>
                          <span
                            className={cn(
                              "flex size-5 shrink-0 items-center justify-center rounded-md border text-[10px]",
                              checked ? "border-primary bg-primary text-primary-foreground" : "border-border",
                            )}
                          >
                            {checked ? "✓" : ""}
                          </span>
                        </div>
                        <p className="mt-3 font-mono text-xl font-bold">{formatMoney(part.price)}</p>
                        <p className={cn("mt-1 text-xs", delta <= 0 ? "text-success" : "text-warning")}>
                          {isCurrent
                            ? "Baseline"
                            : delta < 0
                              ? `${formatMoney(Math.abs(delta))} cheaper`
                              : `+${formatMoney(delta)}`}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {getPartSummarySpecs(part).slice(0, 3).map((spec) => (
                            <span key={spec} className="rounded-md border border-border bg-background/60 px-2 py-1 text-[11px] text-muted-foreground">
                              {spec}
                            </span>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {selectedIds.length >= 4 && (
                  <p className="text-xs text-muted-foreground">Four parts are already selected. Deselect one to add another.</p>
                )}

                <ComparisonTable
                  build={build}
                  fields={comparisonFields}
                  parts={comparisonParts}
                  selectedPart={selectedPart}
                  isReplacing={isReplacing}
                  onReplace={onReplace}
                />
              </>
            )}
          </section>
        </div>

        <DrawerFooter className="border-t border-border px-6 py-4 sm:flex-row sm:justify-end">
          <Button variant="ghost" className="rounded-xl" onClick={() => onOpenChange(false)}>
            Close compare drawer
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

function ComparisonTable({
  build,
  fields,
  parts,
  selectedPart,
  isReplacing,
  onReplace,
}: {
  build: Build;
  fields: ReturnType<typeof getCategoryComparisonFields>;
  parts: Part[];
  selectedPart: Part;
  isReplacing?: boolean;
  onReplace: (part: Part) => void;
}) {
  if (parts.length < 2) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-sm text-muted-foreground">
        Select at least two parts to show a side-by-side comparison.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="border-b border-border bg-secondary/40 px-4 py-3">
        <h3 className="text-base font-semibold">Side-by-side comparison</h3>
        <p className="text-xs text-muted-foreground">Mock pricing and availability only. Check retailer listings before buying.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
              <th className="w-48 px-4 py-3 font-medium">Field</th>
              {parts.map((part) => (
                <th key={part.id} className="min-w-56 px-4 py-3 align-top font-medium">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="normal-case tracking-normal text-foreground">{part.displayName}</span>
                      {part.id === selectedPart.id && <Badge className="rounded-md bg-primary/15 text-primary">Current</Badge>}
                    </div>
                    <p className="font-mono text-lg font-bold text-primary">{formatMoney(part.price)}</p>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <tr>
              <td className="px-4 py-3 text-muted-foreground">Price difference</td>
              {parts.map((part) => {
                const delta = part.price - selectedPart.price;
                return (
                  <td key={part.id} className={cn("px-4 py-3 font-medium", delta <= 0 ? "text-success" : "text-warning")}>
                    {part.id === selectedPart.id
                      ? "Baseline"
                      : delta < 0
                        ? `-${formatMoney(Math.abs(delta))}`
                        : `+${formatMoney(delta)}`}
                  </td>
                );
              })}
            </tr>
            {fields.map((field) => (
              <tr key={field.key}>
                <td className="px-4 py-3 text-muted-foreground">{field.label}</td>
                {parts.map((part) => (
                  <td key={part.id} className="px-4 py-3">
                    {formatSpecValue(part.specs[field.key], field.suffix)}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td className="px-4 py-3 text-muted-foreground">Value rating</td>
              {parts.map((part) => (
                <td key={part.id} className="px-4 py-3">{getValueRating(part)}/100</td>
              ))}
            </tr>
            <tr>
              <td className="px-4 py-3 text-muted-foreground">Performance fit</td>
              {parts.map((part) => (
                <td key={part.id} className="px-4 py-3">
                  {getPerformanceFit(part) !== null ? `${getPerformanceFit(part)}/100` : "Category fit"}
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-4 py-3 text-muted-foreground">Compatibility impact</td>
              {parts.map((part) => {
                const candidateBuild = buildCandidate(build, part);
                return (
                  <td key={part.id} className="px-4 py-3">
                    <CompatibilityBadge build={candidateBuild} />
                    {candidateBuild.compatibilityWarnings.length > 0 && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {candidateBuild.compatibilityWarnings.length} item
                        {candidateBuild.compatibilityWarnings.length === 1 ? "" : "s"} need review.
                      </p>
                    )}
                  </td>
                );
              })}
            </tr>
            <tr>
              <td className="px-4 py-3 text-muted-foreground">Build total after replace</td>
              {parts.map((part) => (
                <td key={part.id} className="px-4 py-3 font-mono font-semibold">
                  {formatMoney(buildCandidate(build, part).totalPrice)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-4 py-3 text-muted-foreground">Recommendation reason</td>
              {parts.map((part) => (
                <td key={part.id} className="px-4 py-3 text-muted-foreground">
                  {part.recommendationReason ?? "Configured in the local mock catalog."}
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-4 py-3 text-muted-foreground">Action</td>
              {parts.map((part) => (
                <td key={part.id} className="px-4 py-3">
                  <Button
                    className="rounded-xl"
                    variant={part.id === selectedPart.id ? "secondary" : "default"}
                    disabled={part.id === selectedPart.id || Boolean(isReplacing)}
                    onClick={() => onReplace(part)}
                  >
                    {part.id === selectedPart.id
                      ? "Currently selected"
                      : isReplacing
                        ? "Replacing..."
                        : "Replace with this part"}
                  </Button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CompatibilityBadge({ build }: { build: Build }) {
  if (build.compatibilityStatus === "pass") {
    return <Badge className="rounded-md bg-success/15 text-success">Pass</Badge>;
  }

  if (build.compatibilityStatus === "warning") {
    return <Badge className="rounded-md bg-warning/15 text-warning">Warning</Badge>;
  }

  return (
    <Badge className="rounded-md bg-destructive/15 text-destructive">
      <AlertTriangle className="mr-1 size-3" /> Fix needed
    </Badge>
  );
}

function InfoRow({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background/60 px-3 py-3">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-sm font-medium", valueClass)}>{value}</p>
    </div>
  );
}

import { categoryLabels } from "@/data/seedParts";
import {
  getCategoryComparisonFields,
  getCompatibilityNotesForPart,
  getPartPowerRequirement,
  getPartSummarySpecs,
} from "@/lib/build-advisor";
import { calculateBuildTotal, deriveCompatibilityStatus, evaluateCompatibility } from "@/lib/compatibility";
import { canUseFeature } from "@/lib/monetization";
import { trackAffiliateClick } from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import type { Build } from "@/types/build";
import type { AffiliateLink, PlanType } from "@/types/monetization";
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
import { AffiliateDisclosure } from "@/components/AffiliateDisclosure";
import { ProFeatureLock } from "@/components/ProFeatureLock";
import {
  AlertTriangle,
  ArrowRightLeft,
  Check,
  CheckCircle2,
  GitCompare,
  LoaderCircle,
  Search,
  ShoppingBag,
  Sparkles,
  X,
} from "lucide-react";

type ExplorerTab = "recommended" | "search" | "compare";

const CATEGORY_ICONS: Partial<Record<PartCategory, string>> = {
  cpu: "CPU",
  gpu: "GPU",
  motherboard: "MB",
  ram: "RAM",
  ssd: "SSD",
  psu: "PSU",
  case: "CASE",
  cooler: "FAN",
};

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

function partMatchesSearch(part: Part, query: string) {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return true;
  }

  const haystack = [
    part.brand,
    part.model,
    part.displayName,
    part.retailer,
    ...part.compatibilityTags,
    ...Object.entries(part.specs).flatMap(([key, value]) => [key, String(value)]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalized);
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
  plan = "free",
  onUpgraded,
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
  plan?: PlanType;
  onUpgraded?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<ExplorerTab>("recommended");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState("value");
  const [searchQuery, setSearchQuery] = useState("");
  const [previewPart, setPreviewPart] = useState<Part | null>(null);

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

    setActiveTab("recommended");
    setSearchQuery("");
    setPreviewPart(null);
    setSelectedIds([selectedPart.id]);
  }, [open, selectedPart]);

  if (!build || !category || !selectedPart) {
    return null;
  }

  const currentBuild = build;
  const currentSelectedPart = selectedPart;
  const hasAdvancedCompare = canUseFeature(plan, "advanced_compare");
  const selectedCompareParts = selectedIds
    .map((id) => sameCategoryParts.find((part) => part.id === id))
    .filter((part): part is Part => Boolean(part));
  const recommendedParts = sameCategoryParts
    .filter((part, index) => index < 6 || part.id === recommendedReplacementId)
    .slice(0, 8);
  const searchedParts = sameCategoryParts.filter((part) => partMatchesSearch(part, searchQuery));

  function toggleComparePart(part: Part) {
    setSelectedIds((current) => {
      if (current.includes(part.id)) {
        return current.filter((id) => id !== part.id);
      }

      if (current.length >= 4) {
        return current;
      }

      return [...current, part.id];
    });
  }

  function clearSelection() {
    setSelectedIds([currentSelectedPart.id]);
    setActiveTab("recommended");
  }

  async function handleAffiliateClick(part: Part, link: AffiliateLink) {
    await trackAffiliateClick({
      partId: part.id,
      merchant: link.merchant,
      url: link.url,
      buildId: currentBuild.id,
    });
    window.open(link.url, "_blank", "noopener,noreferrer");
  }

  function confirmPreviewSwap() {
    if (!previewPart || previewPart.id === currentSelectedPart.id) {
      return;
    }

    onReplace(previewPart);
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto flex max-h-[92vh] w-full max-w-7xl flex-col rounded-t-[28px] border-primary/20 bg-background">
        <DrawerHeader className="border-b border-border px-6 pb-5 pt-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <Badge className="w-fit rounded-md border border-primary/30 bg-primary/10 text-primary">
                <GitCompare className="mr-1 size-3" /> Part Explorer Drawer
              </Badge>
              <div>
                <DrawerTitle className="text-2xl">Explore {sectionTitle} options</DrawerTitle>
                <DrawerDescription className="mt-1 max-w-2xl">
                  Review recommended alternatives, search the local mock catalog, then preview a swap before changing your build.
                </DrawerDescription>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Current total</p>
              <p className="font-mono text-2xl font-bold text-primary">{formatMoney(build.totalPrice)}</p>
            </div>
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-32 pt-6">
          <CurrentSelection build={build} part={selectedPart} plan={plan} onUpgraded={onUpgraded} />

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex rounded-full border border-border bg-card p-1">
              {[
                { key: "recommended", label: "Recommended", icon: Sparkles },
                { key: "search", label: "Search", icon: Search },
                { key: "compare", label: "Compare", icon: GitCompare },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                    activeTab === key
                      ? "bg-primary text-primary-foreground shadow-glow"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setActiveTab(key as ExplorerTab)}
                >
                  <Icon className="size-4" />
                  {label}
                </button>
              ))}
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
                {Math.max(0, sameCategoryParts.length - 1)} alternatives
              </Badge>
            </div>
          </div>

          {recommendedReplacementId && (
            <div className="mt-4 rounded-2xl border border-success/25 bg-success/10 px-4 py-3 text-sm text-success">
              A recommended fix is highlighted because it resolves the selected compatibility warning.
            </div>
          )}

          <div className="mt-5">
            {isLoading ? (
              <LoadingState title={`Loading ${sectionTitle.toLowerCase()} options`} />
            ) : errorMessage ? (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
                {errorMessage}
              </div>
            ) : sameCategoryParts.length < 2 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-sm text-muted-foreground">
                This category needs at least two mock parts before exploration is useful.
              </div>
            ) : activeTab === "recommended" ? (
              <PartCardGrid
                build={build}
                parts={recommendedParts}
                selectedPart={selectedPart}
                selectedIds={selectedIds}
                recommendedReplacementId={recommendedReplacementId}
                onToggleCompare={toggleComparePart}
                onPreviewSwap={setPreviewPart}
                onAffiliateClick={handleAffiliateClick}
              />
            ) : activeTab === "search" ? (
              <section className="space-y-4">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="w-full rounded-2xl border border-border bg-card py-4 pl-11 pr-4 text-sm outline-none transition-all focus:ring-2 focus:ring-primary/25"
                    placeholder="Search brand, model, name, socket, wattage, VRAM, RAM type..."
                  />
                </div>
                <PartCardGrid
                  build={build}
                  parts={searchedParts}
                  selectedPart={selectedPart}
                  selectedIds={selectedIds}
                  recommendedReplacementId={recommendedReplacementId}
                  onToggleCompare={toggleComparePart}
                  onPreviewSwap={setPreviewPart}
                  onAffiliateClick={handleAffiliateClick}
                  emptyMessage="No local mock parts match that search."
                />
              </section>
            ) : (
              <CompareTab
                build={build}
                parts={selectedCompareParts}
                selectedPart={selectedPart}
                plan={plan}
                isReplacing={isReplacing}
                onPreviewSwap={setPreviewPart}
                onUpgraded={onUpgraded}
              />
            )}
          </div>

          {previewPart && (
            <PreviewSwapPanel
              build={build}
              currentPart={selectedPart}
              previewPart={previewPart}
              plan={plan}
              isReplacing={isReplacing}
              onCancel={() => setPreviewPart(null)}
              onConfirm={confirmPreviewSwap}
              onUpgraded={onUpgraded}
            />
          )}
        </div>

        <CompareTray
          parts={selectedCompareParts}
          selectedPart={selectedPart}
          onRemove={(part) => setSelectedIds((current) => current.filter((id) => id !== part.id))}
          onClear={clearSelection}
          onCompare={() => setActiveTab("compare")}
        />

        <DrawerFooter className="border-t border-border px-6 py-4 sm:flex-row sm:justify-end">
          <Button variant="ghost" className="rounded-xl" onClick={() => onOpenChange(false)}>
            Close part explorer
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

function CurrentSelection({
  build,
  part,
  plan,
  onUpgraded,
}: {
  build: Build;
  part: Part;
  plan: PlanType;
  onUpgraded?: () => void;
}) {
  const hasAdvancedCompare = canUseFeature(plan, "advanced_compare");

  return (
    <section className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
      <div className="grid gap-4 lg:grid-cols-[160px_1fr_320px]">
        <PartVisual part={part} featured />
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge className="rounded-md border border-primary/30 bg-primary/15 text-primary">
              <Check className="mr-1 size-3" /> In build now
            </Badge>
            <CompatibilityBadge build={build} />
          </div>
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Current Selection</p>
          <h3 className="mt-1 text-xl font-bold">{part.displayName}</h3>
          <p className="mt-2 font-mono text-2xl font-bold text-primary">{formatMoney(part.price)}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {getPartSummarySpecs(part).map((spec) => (
              <span key={spec} className="rounded-md border border-border bg-background/60 px-2.5 py-1 text-xs">
                {spec}
              </span>
            ))}
          </div>
        </div>
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
          <InfoRow label="Power requirement" value={getPartPowerRequirement(part)} />
          {hasAdvancedCompare ? (
            <InfoRow
              label="AI recommendation reason"
              value={part.recommendationReason ?? "Chosen for balance in this mock build."}
            />
          ) : (
            <ProFeatureLock
              feature="ai_reasoning"
              label="AI recommendation reason"
              onUpgraded={onUpgraded}
            />
          )}
        </div>
      </div>
    </section>
  );
}

function PartCardGrid({
  build,
  parts,
  selectedPart,
  selectedIds,
  recommendedReplacementId,
  onToggleCompare,
  onPreviewSwap,
  onAffiliateClick,
  emptyMessage = "No parts are available in this category yet.",
}: {
  build: Build;
  parts: Part[];
  selectedPart: Part;
  selectedIds: string[];
  recommendedReplacementId?: string | null;
  onToggleCompare: (part: Part) => void;
  onPreviewSwap: (part: Part) => void;
  onAffiliateClick: (part: Part, link: AffiliateLink) => void;
  emptyMessage?: string;
}) {
  if (parts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {parts.map((part) => (
        <PartCard
          key={part.id}
          build={build}
          part={part}
          selectedPart={selectedPart}
          isSelected={selectedIds.includes(part.id)}
          isRecommendedFix={part.id === recommendedReplacementId}
          compareDisabled={!selectedIds.includes(part.id) && selectedIds.length >= 4}
          onToggleCompare={() => onToggleCompare(part)}
          onPreviewSwap={() => onPreviewSwap(part)}
          onAffiliateClick={(link) => onAffiliateClick(part, link)}
        />
      ))}
    </div>
  );
}

function PartCard({
  build,
  part,
  selectedPart,
  isSelected,
  isRecommendedFix,
  compareDisabled,
  onToggleCompare,
  onPreviewSwap,
  onAffiliateClick,
}: {
  build: Build;
  part: Part;
  selectedPart: Part;
  isSelected: boolean;
  isRecommendedFix: boolean;
  compareDisabled: boolean;
  onToggleCompare: () => void;
  onPreviewSwap: () => void;
  onAffiliateClick: (link: AffiliateLink) => void;
}) {
  const isCurrent = part.id === selectedPart.id;
  const delta = part.price - selectedPart.price;
  const candidateBuild = buildCandidate(build, part);
  const link = part.affiliateLinks?.[0];

  return (
    <article
      className={cn(
        "flex min-h-[360px] flex-col rounded-2xl border bg-card p-4 transition-colors",
        isSelected ? "border-primary/50 bg-primary/10" : "border-border hover:border-primary/30",
        isRecommendedFix && "border-success/50 bg-success/[0.07]",
      )}
    >
      <div className="flex items-start gap-4">
        <PartVisual part={part} />
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap gap-2">
            {isCurrent && <Badge className="rounded-md bg-primary/15 text-primary">Current</Badge>}
            {isRecommendedFix && (
              <Badge className="rounded-md border border-success/30 bg-success/15 text-success">
                <Sparkles className="mr-1 size-3" /> Fix
              </Badge>
            )}
            <CompatibilityBadge build={candidateBuild} />
          </div>
          <h4 className="font-bold leading-snug">{part.displayName}</h4>
          <p className="mt-2 font-mono text-2xl font-bold">{formatMoney(part.price)}</p>
          <p className={cn("mt-1 text-xs", delta <= 0 ? "text-success" : "text-warning")}>
            {isCurrent
              ? "Current baseline"
              : delta < 0
                ? `${formatMoney(Math.abs(delta))} cheaper`
                : `+${formatMoney(delta)}`}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {getPartSummarySpecs(part).slice(0, 4).map((spec) => (
          <span key={spec} className="rounded-md border border-border bg-background/60 px-2 py-1 text-[11px] text-muted-foreground">
            {spec}
          </span>
        ))}
      </div>

      <div className="mt-4 space-y-2 text-xs text-muted-foreground">
        {getCompatibilityNotesForPart(candidateBuild, part).slice(0, 2).map((note) => (
          <p key={note} className="rounded-xl border border-border bg-background/50 px-3 py-2">
            {note}
          </p>
        ))}
      </div>

      <div className="mt-auto pt-4">
        <AffiliateDisclosure />
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Button
            variant={isSelected ? "default" : "secondary"}
            className="rounded-xl"
            disabled={compareDisabled}
            onClick={onToggleCompare}
          >
            {isSelected ? (
              <>
                <Check className="mr-2 size-4" /> Selected
              </>
            ) : (
              <>
                <GitCompare className="mr-2 size-4" /> Compare
              </>
            )}
          </Button>
          <Button
            className="rounded-xl"
            disabled={isCurrent}
            onClick={onPreviewSwap}
          >
            <ArrowRightLeft className="mr-2 size-4" />
            Preview swap
          </Button>
          {link && (
            <Button
              variant="ghost"
              className="rounded-xl sm:col-span-2"
              onClick={() => onAffiliateClick(link)}
            >
              <ShoppingBag className="mr-2 size-4" />
              {link.label ?? "Check price"}
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

function CompareTab({
  build,
  parts,
  selectedPart,
  plan,
  isReplacing,
  onPreviewSwap,
  onUpgraded,
}: {
  build: Build;
  parts: Part[];
  selectedPart: Part;
  plan: PlanType;
  isReplacing?: boolean;
  onPreviewSwap: (part: Part) => void;
  onUpgraded?: () => void;
}) {
  if (parts.length < 2) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-sm text-muted-foreground">
        Select 2 to 4 parts from Recommended or Search to unlock the comparison table.
      </div>
    );
  }

  return (
    <ComparisonTable
      build={build}
      fields={getCategoryComparisonFields(selectedPart.category)}
      parts={parts}
      selectedPart={selectedPart}
      plan={plan}
      isReplacing={isReplacing}
      onPreviewSwap={onPreviewSwap}
      onUpgraded={onUpgraded}
    />
  );
}

function ComparisonTable({
  build,
  fields,
  parts,
  selectedPart,
  plan,
  isReplacing,
  onPreviewSwap,
  onUpgraded,
}: {
  build: Build;
  fields: ReturnType<typeof getCategoryComparisonFields>;
  parts: Part[];
  selectedPart: Part;
  plan: PlanType;
  isReplacing?: boolean;
  onPreviewSwap: (part: Part) => void;
  onUpgraded?: () => void;
}) {
  const hasAdvancedCompare = canUseFeature(plan, "advanced_compare");

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="border-b border-border bg-secondary/40 px-4 py-3">
        <h3 className="text-base font-semibold">Side-by-side comparison</h3>
        <p className="text-xs text-muted-foreground">Basic fields stay visible. Build Pro unlocks deeper reasoning.</p>
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
            <AdvancedRow
              label="Value analysis"
              unlocked={hasAdvancedCompare}
              featureLabel="Value analysis"
              onUpgraded={onUpgraded}
              values={parts.map((part) => `${getValueRating(part)}/100 value score`)}
            />
            <AdvancedRow
              label="Performance fit"
              unlocked={hasAdvancedCompare}
              featureLabel="Performance fit"
              onUpgraded={onUpgraded}
              values={parts.map((part) =>
                getPerformanceFit(part) !== null ? `${getPerformanceFit(part)}/100` : "Category fit",
              )}
            />
            <tr>
              <td className="px-4 py-3 text-muted-foreground">Compatibility impact</td>
              {parts.map((part) => {
                const candidateBuild = buildCandidate(build, part);
                return (
                  <td key={part.id} className="px-4 py-3">
                    {hasAdvancedCompare ? (
                      <>
                        <CompatibilityBadge build={candidateBuild} />
                        {candidateBuild.compatibilityWarnings.length > 0 && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            {candidateBuild.compatibilityWarnings.length} item
                            {candidateBuild.compatibilityWarnings.length === 1 ? "" : "s"} need review.
                          </p>
                        )}
                      </>
                    ) : (
                      <ProFeatureLock
                        feature="advanced_compare"
                        label="Compatibility impact"
                        showUpgrade={false}
                        onUpgraded={onUpgraded}
                      />
                    )}
                  </td>
                );
              })}
            </tr>
            <tr>
              <td className="px-4 py-3 text-muted-foreground">AI recommendation reason</td>
              {parts.map((part) => (
                <td key={part.id} className="px-4 py-3 text-muted-foreground">
                  {hasAdvancedCompare ? (
                    part.recommendationReason ?? "Configured in the local mock catalog."
                  ) : (
                    <ProFeatureLock feature="ai_reasoning" label="AI reasoning" showUpgrade={false} onUpgraded={onUpgraded} />
                  )}
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-4 py-3 text-muted-foreground">Final recommendation</td>
              {parts.map((part) => (
                <td key={part.id} className="px-4 py-3">
                  {hasAdvancedCompare ? (
                    part.id === selectedPart.id ? "Keep as the balanced baseline." : "Preview the swap before replacing."
                  ) : (
                    <ProFeatureLock
                      feature="advanced_compare"
                      label="Final recommendation"
                      showUpgrade={false}
                      onUpgraded={onUpgraded}
                    />
                  )}
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
                    onClick={() => onPreviewSwap(part)}
                  >
                    {part.id === selectedPart.id ? "Currently selected" : "Preview swap"}
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

function AdvancedRow({
  label,
  values,
  unlocked,
  featureLabel,
  onUpgraded,
}: {
  label: string;
  values: string[];
  unlocked: boolean;
  featureLabel: string;
  onUpgraded?: () => void;
}) {
  return (
    <tr>
      <td className="px-4 py-3 text-muted-foreground">{label}</td>
      {values.map((value, index) => (
        <td key={`${label}-${index}`} className="px-4 py-3">
          {unlocked ? (
            value
          ) : (
            <ProFeatureLock
              feature="advanced_compare"
              label={featureLabel}
              showUpgrade={false}
              onUpgraded={onUpgraded}
            />
          )}
        </td>
      ))}
    </tr>
  );
}

function PreviewSwapPanel({
  build,
  currentPart,
  previewPart,
  plan,
  isReplacing,
  onCancel,
  onConfirm,
  onUpgraded,
}: {
  build: Build;
  currentPart: Part;
  previewPart: Part;
  plan: PlanType;
  isReplacing?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onUpgraded?: () => void;
}) {
  const candidateBuild = buildCandidate(build, previewPart);
  const delta = previewPart.price - currentPart.price;
  const hasAdvancedCompare = canUseFeature(plan, "advanced_compare");

  return (
    <section className="mt-6 rounded-2xl border border-primary/25 bg-primary/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge className="mb-3 rounded-md border border-primary/30 bg-primary/15 text-primary">
            <ArrowRightLeft className="mr-1 size-3" /> Preview Swap
          </Badge>
          <h3 className="text-xl font-bold">{previewPart.displayName}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Review the price and compatibility impact before replacing the current {categoryLabels[currentPart.category].toLowerCase()}.
          </p>
        </div>
        <button
          type="button"
          className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
          onClick={onCancel}
          aria-label="Close preview"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-4">
        <InfoRow label="Price change" value={delta < 0 ? `-${formatMoney(Math.abs(delta))}` : `+${formatMoney(delta)}`} valueClass={delta <= 0 ? "text-success" : "text-warning"} />
        <InfoRow label="New build total" value={formatMoney(candidateBuild.totalPrice)} />
        <div className="rounded-xl border border-border bg-background/60 px-3 py-3">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Compatibility</p>
          <div className="mt-2">
            <CompatibilityBadge build={candidateBuild} />
          </div>
        </div>
        <InfoRow label="Power requirement" value={getPartPowerRequirement(previewPart)} />
      </div>

      <div className="mt-4">
        {hasAdvancedCompare ? (
          <div className="rounded-xl border border-border bg-background/60 p-4 text-sm text-muted-foreground">
            {delta < 0
              ? "This swap lowers cost. Check the listed specs and compatibility status to decide whether the savings are worth the tradeoff."
              : "This swap raises the build total. Choose it if the added performance or fit matters for your target workload."}
          </div>
        ) : (
          <ProFeatureLock
            feature="unlimited_swaps"
            label="Upgrade/downgrade explanation"
            onUpgraded={onUpgraded}
          />
        )}
      </div>

      {candidateBuild.compatibilityWarnings.length > 0 && (
        <div className="mt-4 space-y-2">
          {candidateBuild.compatibilityWarnings.slice(0, 3).map((warning) => (
            <div key={warning.id} className="rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
              {warning.message}
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 flex flex-wrap justify-end gap-3">
        <Button variant="secondary" className="rounded-xl" onClick={onCancel}>
          Keep current part
        </Button>
        <Button className="rounded-xl shadow-glow" disabled={isReplacing} onClick={onConfirm}>
          {isReplacing ? (
            <>
              <LoaderCircle className="mr-2 size-4 animate-spin" /> Replacing
            </>
          ) : (
            "Replace with this part"
          )}
        </Button>
      </div>
    </section>
  );
}

function CompareTray({
  parts,
  selectedPart,
  onRemove,
  onClear,
  onCompare,
}: {
  parts: Part[];
  selectedPart: Part;
  onRemove: (part: Part) => void;
  onClear: () => void;
  onCompare: () => void;
}) {
  return (
    <div className="sticky bottom-0 z-10 border-t border-border bg-background/95 px-6 py-3 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <Badge className="rounded-md border border-primary/30 bg-primary/10 text-primary">
            <GitCompare className="mr-1 size-3" /> {parts.length}/4 selected
          </Badge>
          {parts.length === 0 ? (
            <span className="text-sm text-muted-foreground">Select 2 to 4 parts to compare.</span>
          ) : (
            parts.map((part) => (
              <button
                key={part.id}
                type="button"
                className="inline-flex max-w-[220px] items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs"
                onClick={() => onRemove(part)}
              >
                <span className="truncate">{part.id === selectedPart.id ? "Current: " : ""}{part.displayName}</span>
                <X className="size-3 shrink-0 text-muted-foreground" />
              </button>
            ))
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" className="rounded-md" onClick={onClear}>
            Reset
          </Button>
          <Button size="sm" className="rounded-md" disabled={parts.length < 2} onClick={onCompare}>
            Compare selected
          </Button>
        </div>
      </div>
    </div>
  );
}

function PartVisual({ part, featured = false }: { part: Part; featured?: boolean }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-primary/20 bg-primary/10 text-primary",
        featured ? "size-36" : "size-20",
      )}
    >
      {part.imageUrl ? (
        <img src={part.imageUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className={cn("font-mono font-bold", featured ? "text-2xl" : "text-base")}>
          {CATEGORY_ICONS[part.category] ?? part.category.slice(0, 3).toUpperCase()}
        </span>
      )}
    </div>
  );
}

function CompatibilityBadge({ build }: { build: Build }) {
  if (build.compatibilityStatus === "pass") {
    return <Badge className="rounded-md bg-success/15 text-success"><CheckCircle2 className="mr-1 size-3" /> Pass</Badge>;
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

function LoadingState({ title }: { title: string }) {
  return (
    <div className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 p-8 text-sm text-muted-foreground">
      <LoaderCircle className="mr-2 size-4 animate-spin" />
      {title}
    </div>
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

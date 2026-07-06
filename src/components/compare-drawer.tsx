import { categoryLabels, seedParts } from "@/data/seedParts";
import {
  getCategoryComparisonFields,
  getPartPowerRequirement,
  getPartSummarySpecs,
} from "@/lib/build-advisor";
import { getPartDecisionMetadata } from "@/lib/decision-metadata";
import {
  calculateBuildConfidenceScore,
  calculateBuildTotal,
  deriveCompatibilityStatus,
  evaluateCompatibilityRules,
  getCompatibilityWarnings,
} from "@/lib/compatibility";
import { canUseFeature } from "@/lib/monetization";
import { searchProducts as searchProductsApi, trackAffiliateClick } from "@/lib/apiClient";
import { productSearchResultToPart } from "@/lib/product-search/search-service";
import { cn } from "@/lib/utils";
import type { Build, PartDecisionMetadata, SubstitutionSuggestion } from "@/types/build";
import type { AffiliateLink, PlanType, UsageStatus } from "@/types/monetization";
import type { Part, PartCategory } from "@/types/parts";
import type { ProductSearchResult } from "@/lib/product-search/types";
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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

const CATEGORY_VISUALS: Partial<Record<PartCategory, string>> = {
  cpu: "from-sky-500/20 via-primary/10 to-cyan-500/10",
  gpu: "from-emerald-500/20 via-primary/10 to-lime-500/10",
  motherboard: "from-violet-500/20 via-primary/10 to-fuchsia-500/10",
  ram: "from-amber-500/20 via-primary/10 to-yellow-500/10",
  ssd: "from-teal-500/20 via-primary/10 to-cyan-500/10",
  psu: "from-rose-500/20 via-primary/10 to-orange-500/10",
  case: "from-slate-500/20 via-primary/10 to-zinc-500/10",
  cooler: "from-blue-500/20 via-primary/10 to-indigo-500/10",
};

function formatMoney(value: number) {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatSignedMoney(value: number) {
  if (value < 0) {
    return `-${formatMoney(Math.abs(value))}`;
  }

  if (value > 0) {
    return `+${formatMoney(value)}`;
  }

  return "$0.00";
}

function getSubstitutionLabel(type: SubstitutionSuggestion["substitutionType"]) {
  const labels: Record<SubstitutionSuggestion["substitutionType"], string> = {
    budgetAlternative: "Budget Alternative",
    performanceUpgrade: "Performance Upgrade",
    sameTierSubstitute: "Same-Tier Substitute",
    beginnerSafeSubstitute: "Beginner-Safe Substitute",
    compatibilitySafeSubstitute: "Compatibility-Safe Substitute",
  };

  return labels[type];
}

function formatRetailerName(value: string) {
  const labels: Record<string, string> = {
    amazon: "Amazon",
    newegg: "Newegg",
    microcenter: "Micro Center",
    bestbuy: "Best Buy",
    bhphoto: "B&H Photo",
    partner_mock: "Partner preview",
    other: "Retailer",
  };

  return labels[value] ?? value;
}

function formatStockStatus(value: ProductSearchResult["stockStatus"]) {
  if (value === "in_stock") {
    return "Demo in stock";
  }

  if (value === "low_stock") {
    return "Demo low stock";
  }

  if (value === "out_of_stock") {
    return "Demo out of stock";
  }

  return "Stock unknown";
}

function buildCandidate(build: Build, replacement: Part) {
  const parts = build.parts.map((part) =>
    part.category === replacement.category ? replacement : part,
  );
  const candidate: Build = {
    ...build,
    parts,
    totalPrice: calculateBuildTotal(parts),
    compatibilityWarnings: [],
    compatibilityChecks: [],
    compatibilityStatus: "pass",
    confidenceScore: {
      score: 0,
      label: "Low",
      summary: "Compatibility rules have not run yet.",
      passCount: 0,
      warningCount: 0,
      failCount: 0,
    },
  };
  const compatibilityChecks = evaluateCompatibilityRules(candidate);
  const compatibilityWarnings = getCompatibilityWarnings(compatibilityChecks);

  return {
    ...candidate,
    compatibilityChecks,
    compatibilityWarnings,
    compatibilityStatus: deriveCompatibilityStatus(compatibilityChecks),
    confidenceScore: calculateBuildConfidenceScore(compatibilityChecks),
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

function getNumberSpec(part: Part, keys: string[]) {
  for (const key of keys) {
    const value = part.specs[key];

    if (typeof value === "number") {
      return value;
    }
  }

  return null;
}

function getDisplayPrice(part: Part) {
  return part.owned ? 0 : part.price;
}

function formatSignedNumber(value: number) {
  return value > 0 ? `+${value}` : `${value}`;
}

function getComparisonDeltaBadges(build: Build, part: Part, selectedPart: Part) {
  const badges: Array<{ label: string; tone: "success" | "warning" | "neutral" }> = [];
  const priceDelta = getDisplayPrice(part) - getDisplayPrice(selectedPart);
  const gamingDelta =
    getNumberSpec(part, ["gaming4kScore", "gaming1440pScore", "gamingScore"]) ?? null;
  const selectedGaming =
    getNumberSpec(selectedPart, ["gaming4kScore", "gaming1440pScore", "gamingScore"]) ?? null;
  const productivityDelta = getNumberSpec(part, ["productivityScore"]);
  const selectedProductivity = getNumberSpec(selectedPart, ["productivityScore"]);
  const powerDelta = getNumberSpec(part, ["powerDrawW", "tdpW", "wattageW"]);
  const selectedPower = getNumberSpec(selectedPart, ["powerDrawW", "tdpW", "wattageW"]);
  const capacityDelta = getNumberSpec(part, ["vramGb", "capacityGb", "capacityTb"]);
  const selectedCapacity = getNumberSpec(selectedPart, ["vramGb", "capacityGb", "capacityTb"]);
  const partColor = String(part.color ?? part.specs.color ?? "");
  const selectedColor = String(selectedPart.color ?? selectedPart.specs.color ?? "");

  if (part.id === selectedPart.id) {
    badges.push({ label: "Current baseline", tone: "neutral" });
  } else if (priceDelta < 0) {
    badges.push({ label: `Cheaper by ${formatMoney(Math.abs(priceDelta))}`, tone: "success" });
  } else if (priceDelta > 0) {
    badges.push({ label: `Adds ${formatMoney(priceDelta)}`, tone: "warning" });
  } else {
    badges.push({ label: "Same price", tone: "neutral" });
  }

  if (gamingDelta !== null && selectedGaming !== null && gamingDelta !== selectedGaming) {
    badges.push({
      label: `Gaming ${formatSignedNumber(gamingDelta - selectedGaming)}`,
      tone: gamingDelta >= selectedGaming ? "success" : "warning",
    });
  }

  if (
    productivityDelta !== null &&
    selectedProductivity !== null &&
    productivityDelta !== selectedProductivity
  ) {
    badges.push({
      label: `Productivity ${formatSignedNumber(productivityDelta - selectedProductivity)}`,
      tone: productivityDelta >= selectedProductivity ? "success" : "warning",
    });
  }

  if (powerDelta !== null && selectedPower !== null && powerDelta !== selectedPower) {
    badges.push({
      label: `Power ${formatSignedNumber(powerDelta - selectedPower)}W`,
      tone: powerDelta <= selectedPower ? "success" : "warning",
    });
  }

  if (capacityDelta !== null && selectedCapacity !== null && capacityDelta !== selectedCapacity) {
    badges.push({
      label: `Capacity ${formatSignedNumber(capacityDelta - selectedCapacity)}`,
      tone: capacityDelta >= selectedCapacity ? "success" : "warning",
    });
  }

  if (partColor && selectedColor) {
    badges.push({
      label:
        partColor.toLowerCase() === selectedColor.toLowerCase()
          ? `Color match: ${partColor}`
          : `Color differs: ${partColor}`,
      tone: partColor.toLowerCase() === selectedColor.toLowerCase() ? "success" : "neutral",
    });
  }

  badges.push({
    label: `Total ${formatMoney(buildCandidate(build, part).totalPrice)}`,
    tone: "neutral",
  });

  return badges.slice(0, 6);
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
      return (
        (getPerformanceFit(right) ?? 0) - (getPerformanceFit(left) ?? 0) || right.price - left.price
      );
    }

    if (mode === "value") {
      return getValueRating(right) - getValueRating(left) || left.price - right.price;
    }

    return left.price - right.price;
  });
}

function partMatchesSearch(part: Part, query: string) {
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
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

  return tokens.some((token) => haystack.includes(token));
}

export function ComparePanel({
  build,
  category,
  parts,
  open,
  isLoading,
  isReplacing,
  errorMessage,
  recommendedReplacementId,
  substitutionSuggestions = [],
  onOpenChange,
  onReplace,
  plan = "free",
  usageStatus,
  startWithOwnedPartForm = false,
  ownedPartHint,
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
  substitutionSuggestions?: SubstitutionSuggestion[];
  onOpenChange: (open: boolean) => void;
  onReplace: (part: Part) => void;
  plan?: PlanType;
  usageStatus?: UsageStatus | null;
  startWithOwnedPartForm?: boolean;
  ownedPartHint?: string | null;
  onUpgraded?: () => void;
}) {
  const [activeTab, setActiveTab] = useState<ExplorerTab>("recommended");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState("value");
  const [searchQuery, setSearchQuery] = useState("");
  const [previewPart, setPreviewPart] = useState<Part | null>(null);
  const [customParts, setCustomParts] = useState<Part[]>([]);
  const [showCustomPartForm, setShowCustomPartForm] = useState(false);
  const [includeRetailerResults, setIncludeRetailerResults] = useState(false);
  const [retailerResults, setRetailerResults] = useState<ProductSearchResult[]>([]);
  const [productSearchDisclaimer, setProductSearchDisclaimer] = useState(
    "Retailer results are mock data in this preview. Prices and stock may change. External live search coming later.",
  );
  const [isProductSearching, setIsProductSearching] = useState(false);
  const [productSearchError, setProductSearchError] = useState<string | null>(null);
  const [isPreviewPanelHighlighted, setIsPreviewPanelHighlighted] = useState(false);
  const drawerBodyRef = useRef<HTMLDivElement | null>(null);
  const compareTrayRef = useRef<HTMLDivElement | null>(null);
  const previewPanelRef = useRef<HTMLElement | null>(null);

  const selectedPart = build?.parts.find((part) => part.category === category);
  const sectionTitle = selectedPart ? categoryLabels[selectedPart.category] : "Part";

  const baseCategoryParts = useMemo(() => {
    if (!selectedPart) {
      return [];
    }

    const byId = new Map<string, Part>();
    [
      selectedPart,
      ...parts.filter((part) => part.category === selectedPart.category),
      ...customParts.filter((part) => part.category === selectedPart.category),
    ].forEach((part) => {
      byId.set(part.id, part);
    });

    return sortParts(Array.from(byId.values()), selectedPart, sortMode);
  }, [customParts, parts, selectedPart, sortMode]);

  const retailerPreviewParts = useMemo(
    () => retailerResults.map((result) => productSearchResultToPart(result)),
    [retailerResults],
  );

  const sameCategoryParts = useMemo(() => {
    if (!selectedPart) {
      return [];
    }

    const byId = new Map<string, Part>();
    [...baseCategoryParts, ...retailerPreviewParts].forEach((part) => {
      if (part.category === selectedPart.category) {
        byId.set(part.id, part);
      }
    });

    return sortParts(Array.from(byId.values()), selectedPart, sortMode);
  }, [baseCategoryParts, retailerPreviewParts, selectedPart, sortMode]);

  useEffect(() => {
    if (!open || !selectedPart) {
      return;
    }

    setActiveTab(startWithOwnedPartForm ? "search" : "recommended");
    setSearchQuery(ownedPartHint ?? "");
    setPreviewPart(null);
    setShowCustomPartForm(startWithOwnedPartForm);
    setSelectedIds([selectedPart.id]);
    setRetailerResults([]);
    setProductSearchError(null);
  }, [open, ownedPartHint, selectedPart, startWithOwnedPartForm]);

  useEffect(() => {
    if (!open || !selectedPart || activeTab !== "search" || !includeRetailerResults) {
      setIsProductSearching(false);
      return;
    }

    let cancelled = false;
    setIsProductSearching(true);
    setProductSearchError(null);

    const timer = window.setTimeout(() => {
      void searchProductsApi({
        query: searchQuery,
        category: selectedPart.category,
        includeExternal: true,
        onlyCompatible: false,
        currentBuild: build,
      })
        .then((response) => {
          if (cancelled) {
            return;
          }

          setRetailerResults(response.mockRetailerResults);
          setProductSearchDisclaimer(response.disclaimer);
        })
        .catch(() => {
          if (cancelled) {
            return;
          }

          setRetailerResults([]);
          setProductSearchError("Retailer preview results are unavailable right now.");
        })
        .finally(() => {
          if (!cancelled) {
            setIsProductSearching(false);
          }
        });
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activeTab, build, includeRetailerResults, open, searchQuery, selectedPart]);

  useEffect(() => {
    if (!previewPart) {
      setIsPreviewPanelHighlighted(false);
      return;
    }

    setIsPreviewPanelHighlighted(true);

    const scrollFrame = window.requestAnimationFrame(() => {
      const drawerBody = drawerBodyRef.current;
      const previewPanel = previewPanelRef.current;

      if (!drawerBody || !previewPanel) {
        return;
      }

      const drawerBodyRect = drawerBody.getBoundingClientRect();
      const compareTrayHeight = compareTrayRef.current?.getBoundingClientRect().height ?? 0;
      const stickyHeaderOffset = 0;
      const panelTopWithinBody =
        previewPanel.getBoundingClientRect().top - drawerBodyRect.top + drawerBody.scrollTop;
      const panelBottomWithinBody = panelTopWithinBody + previewPanel.offsetHeight;
      const topPadding = 16;
      const bottomPadding = compareTrayHeight + 16;
      const maxScrollTop = Math.max(0, drawerBody.scrollHeight - drawerBody.clientHeight);
      const targetScrollTop = Math.min(
        maxScrollTop,
        Math.max(0, panelTopWithinBody - stickyHeaderOffset - topPadding),
      );
      const bottomSafeScrollTop = Math.min(
        maxScrollTop,
        Math.max(0, panelBottomWithinBody - drawerBody.clientHeight + bottomPadding),
      );

      drawerBody.scrollTo({
        top: Math.max(targetScrollTop, bottomSafeScrollTop),
        behavior: "smooth",
      });
    });
    const highlightTimer = window.setTimeout(() => {
      setIsPreviewPanelHighlighted(false);
    }, 1400);

    return () => {
      window.cancelAnimationFrame(scrollFrame);
      window.clearTimeout(highlightTimer);
    };
  }, [previewPart]);

  if (!open || !build || !category || !selectedPart) {
    return null;
  }

  const currentSelectedPart = selectedPart;
  const selectedCompareParts = selectedIds
    .map((id) => sameCategoryParts.find((part) => part.id === id))
    .filter((part): part is Part => Boolean(part));
  const recommendedSubstitution = useMemo(() => {
    if (!selectedPart) {
      return null;
    }

    return (
      substitutionSuggestions.find(
        (suggestion) =>
          suggestion.category === selectedPart.category &&
          suggestion.originalPartId === selectedPart.id,
      ) ?? null
    );
  }, [selectedPart, substitutionSuggestions]);
  const recommendedSubstitutePart = recommendedSubstitution
    ? (sameCategoryParts.find((part) => part.id === recommendedSubstitution.substitutePartId) ??
      seedParts.find((part) => part.id === recommendedSubstitution.substitutePartId) ??
      null)
    : null;
  const recommendedParts = baseCategoryParts
    .filter(
      (part, index) =>
        index < 6 ||
        part.id === recommendedReplacementId ||
        part.id === recommendedSubstitution?.substitutePartId,
    )
    .slice(0, 8);
  const searchedParts = baseCategoryParts.filter((part) => partMatchesSearch(part, searchQuery));
  const visibleTabs = [
    { key: "recommended", label: "Recommended", icon: Sparkles },
    { key: "search", label: "Search", icon: Search },
    ...(selectedCompareParts.length >= 2
      ? [{ key: "compare" as const, label: "Compare", icon: GitCompare }]
      : []),
  ];
  const displayedTab =
    activeTab === "compare" && selectedCompareParts.length < 2 ? "recommended" : activeTab;
  const canReplacePart = usageStatus?.canReplacePart ?? true;

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

  function previewSwap(part: Part) {
    setPreviewPart(part);
  }

  function confirmPreviewSwap() {
    if (!previewPart || previewPart.id === currentSelectedPart.id) {
      return;
    }

    onReplace(previewPart);
  }

  return (
    <aside className="order-2 flex min-h-[70vh] min-w-0 flex-col overflow-hidden border-y border-primary/20 bg-background lg:h-full lg:min-h-0 lg:border-x lg:border-y-0">
      <div className="sticky top-0 z-20 border-b border-border bg-background/95 px-4 pb-4 pt-5 backdrop-blur xl:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-3">
            <Badge className="w-fit rounded-md border border-primary/30 bg-primary/10 text-primary">
              <Sparkles className="mr-1 size-3" /> AI-assisted Compare
            </Badge>
            <div>
              <h2 className="text-xl font-semibold leading-tight">
                Compare {sectionTitle} decisions
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                See which option best fits your budget, performance needs, compatibility, and
                beginner risk while the advisor chat stays open.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <div className="rounded-xl border border-border bg-card px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Current total
              </p>
              <p className="font-mono text-2xl font-bold text-primary">
                {formatMoney(build.totalPrice)}
              </p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="rounded-md"
              aria-label="Close compare panel"
              onClick={() => onOpenChange(false)}
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex rounded-full border border-border bg-card p-1">
            {visibleTabs.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  displayedTab === key
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
      </div>

      <div ref={drawerBodyRef} className="min-h-0 flex-1 overflow-y-auto px-4 pb-20 pt-4 xl:px-6">
        <CurrentSelection build={build} part={selectedPart} plan={plan} onUpgraded={onUpgraded} />

        {recommendedReplacementId && (
          <div className="mt-4 rounded-xl border border-success/25 bg-success/10 px-4 py-3 text-sm text-success">
            A recommended review option is highlighted because it may address the selected
            compatibility warning.
          </div>
        )}

        {recommendedSubstitution && recommendedSubstitutePart && (
          <RecommendedSwapPanel
            suggestion={recommendedSubstitution}
            substitute={recommendedSubstitutePart}
            canReplacePart={canReplacePart}
            isReplacing={isReplacing}
            onPreview={() => previewSwap(recommendedSubstitutePart)}
            onApply={() => onReplace(recommendedSubstitutePart)}
          />
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
              This category needs at least two demo parts before exploration is useful.
            </div>
          ) : displayedTab === "recommended" ? (
            <PartCardGrid
              build={build}
              parts={recommendedParts}
              selectedPart={selectedPart}
              selectedIds={selectedIds}
              recommendedReplacementId={recommendedReplacementId}
              onToggleCompare={toggleComparePart}
              onPreviewSwap={previewSwap}
            />
          ) : displayedTab === "search" ? (
            <section className="space-y-4">
              <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="w-full rounded-2xl border border-border bg-card py-4 pl-11 pr-4 text-sm outline-none transition-all focus:ring-2 focus:ring-primary/25"
                    placeholder="Search brand, model, name, socket, wattage, VRAM, RAM type..."
                  />
                </div>
                <div className="flex flex-wrap items-center justify-end gap-3">
                  <label className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm">
                    <Switch
                      checked={includeRetailerResults}
                      onCheckedChange={setIncludeRetailerResults}
                      aria-label="Include retailer results"
                    />
                    <span>Include retailer results</span>
                  </label>
                  <Button
                    variant="secondary"
                    className="rounded-xl"
                    onClick={() => setShowCustomPartForm((current) => !current)}
                  >
                    Add part I already own
                  </Button>
                </div>
              </div>

              {showCustomPartForm && (
                <CustomPartForm
                  category={selectedPart.category}
                  selectedPart={selectedPart}
                  initialName={searchQuery}
                  onAdd={(part) => {
                    setCustomParts((current) => [part, ...current]);
                    setSearchQuery(part.displayName);
                    setShowCustomPartForm(false);
                  }}
                />
              )}

              <SearchSection
                title="In your catalog"
                description="Local seed parts remain available without live retailer calls."
              >
                <PartCardGrid
                  build={build}
                  parts={searchedParts}
                  selectedPart={selectedPart}
                  selectedIds={selectedIds}
                  recommendedReplacementId={recommendedReplacementId}
                  onToggleCompare={toggleComparePart}
                  onPreviewSwap={previewSwap}
                  emptyMessage="No local demo parts match that search."
                  isSearchEmpty={searchQuery.trim().length > 0}
                  onAddCustom={() => setShowCustomPartForm(true)}
                />
              </SearchSection>

              <SearchSection
                title="Retailer results preview"
                description="Retailer results are mock data in this preview. Prices and stock may change."
                action={<AffiliateDisclosure />}
              >
                {!includeRetailerResults ? (
                  <div className="rounded-xl border border-dashed border-border bg-card/50 p-6 text-sm text-muted-foreground">
                    Turn on retailer results to preview demo retailer matches.
                  </div>
                ) : productSearchError ? (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
                    {productSearchError}
                  </div>
                ) : isProductSearching ? (
                  <LoadingState title="Loading retailer preview results" />
                ) : retailerResults.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border bg-card/50 p-6 text-sm text-muted-foreground">
                    No demo retailer results match that search yet.
                  </div>
                ) : (
                  <RetailerResultGrid
                    build={build}
                    results={retailerResults}
                    selectedPart={selectedPart}
                    selectedIds={selectedIds}
                    compareDisabled={selectedIds.length >= 4}
                    onToggleCompare={toggleComparePart}
                    onPreviewSwap={previewSwap}
                  />
                )}
              </SearchSection>

              <SearchSection
                title="External search coming later"
                description={productSearchDisclaimer}
              >
                <div className="rounded-xl border border-dashed border-border bg-card/50 p-5 text-sm text-muted-foreground">
                  External live search coming later. No retailer websites are scraped in this
                  preview.
                </div>
              </SearchSection>
            </section>
          ) : (
            <CompareTab
              build={build}
              parts={selectedCompareParts}
              selectedPart={selectedPart}
              plan={plan}
              isReplacing={isReplacing}
              onPreviewSwap={previewSwap}
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
            isHighlighted={isPreviewPanelHighlighted}
            panelRef={previewPanelRef}
            onCancel={() => setPreviewPart(null)}
            onConfirm={confirmPreviewSwap}
            canReplacePart={canReplacePart}
            onUpgraded={onUpgraded}
          />
        )}
      </div>

      <CompareTray
        trayRef={compareTrayRef}
        parts={selectedCompareParts}
        selectedPart={selectedPart}
        onRemove={(part) => setSelectedIds((current) => current.filter((id) => id !== part.id))}
        onClear={clearSelection}
        onCompare={() => setActiveTab("compare")}
      />
    </aside>
  );
}

export const CompareDrawer = ComparePanel;

function RecommendedSwapPanel({
  suggestion,
  substitute,
  canReplacePart,
  isReplacing,
  onPreview,
  onApply,
}: {
  suggestion: SubstitutionSuggestion;
  substitute: Part;
  canReplacePart: boolean;
  isReplacing?: boolean;
  onPreview: () => void;
  onApply: () => void;
}) {
  return (
    <section className="mt-4 rounded-xl border border-primary/25 bg-primary/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Badge className="mb-3 rounded-md border border-primary/30 bg-primary/15 text-primary">
            <Sparkles className="mr-1 size-3" /> Recommended Swap
          </Badge>
          <h3 className="text-lg font-bold">{substitute.displayName}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {getSubstitutionLabel(suggestion.substitutionType)} based on the current build total,
            compatibility checks, confidence score, power, and beginner risk.
          </p>
        </div>
        <div className="grid min-w-64 grid-cols-3 gap-2 text-xs">
          <div className="rounded-md border border-border bg-background/70 px-2 py-2">
            <p className="text-muted-foreground">Price</p>
            <p
              className={cn(
                "font-mono font-semibold",
                suggestion.priceDelta <= 0 ? "text-success" : "text-warning",
              )}
            >
              {formatSignedMoney(suggestion.priceDelta)}
            </p>
          </div>
          <div className="rounded-md border border-border bg-background/70 px-2 py-2">
            <p className="text-muted-foreground">Total</p>
            <p className="font-mono font-semibold">{formatMoney(suggestion.totalAfterSwap)}</p>
          </div>
          <div className="rounded-md border border-border bg-background/70 px-2 py-2">
            <p className="text-muted-foreground">Confidence</p>
            <p className="font-mono font-semibold">{suggestion.confidenceScoreAfterSwap}/100</p>
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-background/60 p-3 text-sm">
          <p className="font-medium">{suggestion.recommendationReason}</p>
          <p className="mt-1 text-xs text-muted-foreground">{suggestion.tradeOffSummary}</p>
        </div>
        <div className="rounded-xl border border-border bg-background/60 p-3 text-xs text-muted-foreground">
          <p>{suggestion.compatibilityImpact.summary}</p>
          <p className="mt-1">{suggestion.budgetImpact.summary}</p>
          <p className="mt-1">{suggestion.beginnerRiskImpact.summary}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap justify-end gap-3">
        <Button variant="secondary" className="rounded-xl" onClick={onPreview}>
          Preview swap
        </Button>
        <Button
          className="rounded-xl shadow-glow"
          disabled={!canReplacePart || isReplacing}
          onClick={onApply}
        >
          {isReplacing ? (
            <>
              <LoaderCircle className="mr-2 size-4 animate-spin" /> Replacing
            </>
          ) : (
            "Apply recommended swap"
          )}
        </Button>
      </div>
    </section>
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
    <section className="rounded-xl border border-primary/20 bg-primary/5 p-4">
      <div className="grid gap-4 lg:grid-cols-[72px_1fr_280px] lg:items-center">
        <PartVisual part={part} />
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge className="rounded-md border border-primary/30 bg-primary/15 text-primary">
              <Check className="mr-1 size-3" /> In build now
            </Badge>
            <CompatibilityBadge build={build} />
          </div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            Current selection
          </p>
          <h3 className="mt-1 truncate text-lg font-bold">{part.displayName}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <p className="font-mono text-xl font-bold text-primary">{formatMoney(part.price)}</p>
            {getPartSummarySpecs(part)
              .slice(0, 3)
              .map((spec) => (
                <span
                  key={spec}
                  className="rounded-md border border-border bg-background/60 px-2.5 py-1 text-xs"
                >
                  {spec}
                </span>
              ))}
          </div>
        </div>
        <div className="space-y-2 rounded-xl border border-border bg-card p-3">
          {hasAdvancedCompare ? (
            <InfoRow
              label="Why this part"
              value={part.recommendationReason ?? "Chosen for balance in this mock build."}
            />
          ) : (
            <ProFeatureLock
              feature="ai_reasoning"
              label="Why this part"
              showUpgrade={false}
              onUpgraded={onUpgraded}
            />
          )}
        </div>
      </div>
    </section>
  );
}

function SearchSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function RetailerResultGrid({
  build,
  results,
  selectedPart,
  selectedIds,
  compareDisabled,
  onToggleCompare,
  onPreviewSwap,
}: {
  build: Build;
  results: ProductSearchResult[];
  selectedPart: Part;
  selectedIds: string[];
  compareDisabled: boolean;
  onToggleCompare: (part: Part) => void;
  onPreviewSwap: (part: Part) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {results.map((result) => {
        const part = productSearchResultToPart(result);
        return (
          <RetailerResultCard
            key={result.id}
            build={build}
            result={result}
            part={part}
            selectedPart={selectedPart}
            isSelected={selectedIds.includes(part.id)}
            compareDisabled={compareDisabled && !selectedIds.includes(part.id)}
            onToggleCompare={() => onToggleCompare(part)}
            onPreviewSwap={() => onPreviewSwap(part)}
          />
        );
      })}
    </div>
  );
}

function RetailerResultCard({
  build,
  result,
  part,
  selectedPart,
  isSelected,
  compareDisabled,
  onToggleCompare,
  onPreviewSwap,
}: {
  build: Build;
  result: ProductSearchResult;
  part: Part;
  selectedPart: Part;
  isSelected: boolean;
  compareDisabled: boolean;
  onToggleCompare: () => void;
  onPreviewSwap: () => void;
}) {
  const isCurrent = part.id === selectedPart.id;
  const candidateBuild = buildCandidate(build, part);
  const priceLabel = result.price === null ? "Price unknown" : formatMoney(result.price);
  const affiliateLink = part.affiliateLinks?.[0];
  const [dealMessage, setDealMessage] = useState<string | null>(null);

  async function handleCheckPrice() {
    const url = result.affiliateUrl ?? result.productUrl;

    if (!url) {
      setDealMessage("We do not have a deal link for this demo result yet.");
      return;
    }

    const openedWindow = window.open("about:blank", "_blank");

    if (!openedWindow) {
      setDealMessage(
        "Your browser blocked the new tab. Please allow popups for this site and try again.",
      );
      return;
    }

    openedWindow.opener = null;
    if (affiliateLink) {
      await trackAffiliateClick({
        partId: part.id,
        merchant: affiliateLink.merchant,
        url,
        buildId: build.id,
      });
    }

    openedWindow.location.href = url;
    setDealMessage(null);
  }

  return (
    <article
      className={cn(
        "flex min-h-[330px] flex-col rounded-xl border bg-card p-4 transition-colors",
        isSelected ? "border-primary/50 bg-primary/10" : "border-border hover:border-primary/30",
      )}
    >
      <div className="flex items-start gap-4">
        <PartVisual part={part} />
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap gap-2">
            <Badge className="rounded-md border border-warning/30 bg-warning/10 text-warning">
              Retailer preview
            </Badge>
            <CompatibilityBadge build={candidateBuild} />
          </div>
          <h4 className="font-bold leading-snug">{result.displayName}</h4>
          <p className="mt-2 text-xs text-muted-foreground">
            {formatRetailerName(result.retailer)}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <InfoRow label="Price" value={priceLabel} />
        <InfoRow label="Stock" value={formatStockStatus(result.stockStatus)} />
        <InfoRow label="Confidence" value={`${Math.round(result.confidence * 100)}%`} />
        <InfoRow label="Source" value="Preview data" />
      </div>

      {candidateBuild.compatibilityWarnings.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {candidateBuild.compatibilityWarnings.map((warning) => (
            <div
              key={warning.id}
              className="rounded-md border border-warning/30 bg-warning/10 px-2.5 py-2 text-xs text-warning"
            >
              {warning.message}
            </div>
          ))}
        </div>
      )}

      <div className="mt-auto pt-4">
        <div className="grid gap-2">
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
                <GitCompare className="mr-2 size-4" /> Add to compare
              </>
            )}
          </Button>
          <Button className="rounded-xl" disabled={isCurrent} onClick={onPreviewSwap}>
            <ArrowRightLeft className="mr-2 size-4" />
            Preview swap
          </Button>
          <Button variant="ghost" className="rounded-xl" onClick={() => void handleCheckPrice()}>
            <ShoppingBag className="mr-2 size-4" />
            Check price
          </Button>
          {dealMessage && (
            <p className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              {dealMessage}
            </p>
          )}
        </div>
      </div>
    </article>
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
  emptyMessage = "No parts are available in this category yet.",
  isSearchEmpty = false,
  onAddCustom,
}: {
  build: Build;
  parts: Part[];
  selectedPart: Part;
  selectedIds: string[];
  recommendedReplacementId?: string | null;
  onToggleCompare: (part: Part) => void;
  onPreviewSwap: (part: Part) => void;
  emptyMessage?: string;
  isSearchEmpty?: boolean;
  onAddCustom?: () => void;
}) {
  if (parts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/50 p-6 text-sm text-muted-foreground">
        <p>{emptyMessage}</p>
        {isSearchEmpty && (
          <div className="mt-3 space-y-3">
            <p>Try Intel, Ryzen, 7800X3D, RTX, ASUS.</p>
            <div className="flex flex-wrap gap-2">
              {onAddCustom && (
                <Button size="sm" className="rounded-md" onClick={onAddCustom}>
                  Add this as a custom part
                </Button>
              )}
              <Badge variant="secondary" className="rounded-md">
                External retailer search coming later
              </Badge>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
}: {
  build: Build;
  part: Part;
  selectedPart: Part;
  isSelected: boolean;
  isRecommendedFix: boolean;
  compareDisabled: boolean;
  onToggleCompare: () => void;
  onPreviewSwap: () => void;
}) {
  const isCurrent = part.id === selectedPart.id;
  const delta = getDisplayPrice(part) - getDisplayPrice(selectedPart);
  const candidateBuild = buildCandidate(build, part);
  const deltaBadges = getComparisonDeltaBadges(build, part, selectedPart).slice(0, 3);

  return (
    <article
      className={cn(
        "flex min-h-[260px] flex-col rounded-xl border bg-card p-4 transition-colors",
        isSelected ? "border-primary/50 bg-primary/10" : "border-border hover:border-primary/30",
        isRecommendedFix && "border-success/50 bg-success/[0.07]",
      )}
    >
      <div className="flex items-start gap-4">
        <PartVisual part={part} />
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap gap-2">
            {isCurrent && <Badge className="rounded-md bg-primary/15 text-primary">Current</Badge>}
            {part.owned && (
              <Badge className="rounded-md bg-success/15 text-success">Already owned</Badge>
            )}
            {isRecommendedFix && (
              <Badge className="rounded-md border border-success/30 bg-success/15 text-success">
                <Sparkles className="mr-1 size-3" /> Review
              </Badge>
            )}
            <CompatibilityBadge build={candidateBuild} />
          </div>
          <h4 className="font-bold leading-snug">{part.displayName}</h4>
          <p className="mt-2 font-mono text-xl font-bold">
            {part.owned ? "$0" : formatMoney(part.price)}
          </p>
          <p className={cn("mt-1 text-xs", delta <= 0 ? "text-success" : "text-warning")}>
            {part.owned
              ? "Already owned"
              : isCurrent
                ? "Current baseline"
                : delta < 0
                  ? `${formatMoney(Math.abs(delta))} cheaper`
                  : `+${formatMoney(delta)}`}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {getPartSummarySpecs(part)
          .slice(0, 3)
          .map((spec) => (
            <span
              key={spec}
              className="rounded-md border border-border bg-background/60 px-2 py-1 text-[11px] text-muted-foreground"
            >
              {spec}
            </span>
          ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {deltaBadges.map((badge) => (
          <DeltaBadge key={badge.label} {...badge} />
        ))}
      </div>

      <div className="mt-auto pt-4">
        <div className="grid gap-2 sm:grid-cols-2">
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
          <Button className="rounded-xl" disabled={isCurrent} onClick={onPreviewSwap}>
            <ArrowRightLeft className="mr-2 size-4" />
            Preview swap
          </Button>
        </div>
      </div>
    </article>
  );
}

function CustomPartForm({
  category,
  selectedPart,
  initialName,
  onAdd,
}: {
  category: PartCategory;
  selectedPart: Part;
  initialName: string;
  onAdd: (part: Part) => void;
}) {
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState(initialName);
  const [color, setColor] = useState(
    typeof selectedPart.specs.color === "string" ? selectedPart.specs.color : "",
  );
  const [notes, setNotes] = useState("");

  function handleAdd() {
    const cleanBrand = brand.trim() || "Owned";
    const cleanModel = model.trim() || `${categoryLabels[category]} part`;
    const id = `owned-${category}-${Date.now()}`;
    const specs = {
      ...selectedPart.specs,
      color: color.trim() || selectedPart.specs.color || "Unknown",
      notes: notes.trim() || "User-provided local part.",
    };

    onAdd({
      id,
      category,
      brand: cleanBrand,
      model: cleanModel,
      displayName: `${cleanBrand} ${cleanModel}`,
      price: 0,
      source: "user_owned",
      owned: true,
      userProvided: true,
      color: typeof specs.color === "string" ? specs.color : undefined,
      availability: "unknown",
      specs,
      compatibilityTags: [...selectedPart.compatibilityTags, "user-owned"],
      recommendationReason:
        "User-owned part added locally. Specs are estimated from the current category baseline.",
    });
  }

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-primary">Add part I already own</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Local-only for now. It counts as $0 but still uses specs for compatibility checks.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <input
          value={categoryLabels[category]}
          disabled
          className="rounded-xl border border-border bg-secondary/60 px-3 py-2 text-sm text-muted-foreground outline-none"
          aria-label="Category"
        />
        <input
          value={brand}
          onChange={(event) => setBrand(event.target.value)}
          className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/25"
          placeholder="Brand, e.g. Intel"
        />
        <input
          value={model}
          onChange={(event) => setModel(event.target.value)}
          className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/25"
          placeholder="Model"
        />
        <input
          value={color}
          onChange={(event) => setColor(event.target.value)}
          className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/25"
          placeholder="Color or notes"
        />
      </div>
      <textarea
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        className="mt-3 min-h-20 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/25"
        placeholder="Estimated specs or notes, e.g. already installed, includes cooler, white model..."
      />
      <div className="mt-3 flex justify-end">
        <Button className="rounded-xl" onClick={handleAdd}>
          Add owned part
        </Button>
      </div>
    </div>
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
      <div className="rounded-xl border border-dashed border-border bg-card/50 p-6 text-sm text-muted-foreground">
        Select 2 to 4 parts from Recommended or Search to unlock the comparison table.
      </div>
    );
  }

  const decisionMetadata = getPartDecisionMetadata(build, parts, selectedPart);

  return (
    <div className="space-y-4">
      <DecisionSummary parts={parts} decisions={decisionMetadata} />
      <ComparisonTable
        build={build}
        fields={getCategoryComparisonFields(selectedPart.category)}
        parts={parts}
        selectedPart={selectedPart}
        decisions={decisionMetadata}
        plan={plan}
        isReplacing={isReplacing}
        onPreviewSwap={onPreviewSwap}
        onUpgraded={onUpgraded}
      />
    </div>
  );
}

function DecisionSummary({
  parts,
  decisions,
}: {
  parts: Part[];
  decisions: PartDecisionMetadata[];
}) {
  return (
    <section className="rounded-xl border border-primary/20 bg-primary/5 p-4">
      <div className="mb-3">
        <h3 className="text-base font-semibold">Decision guide</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Rule-based labels from price, budget, performance, power, and compatibility checks.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {decisions.map((decision) => {
          const part = parts.find((candidate) => candidate.id === decision.partId);

          if (!part) {
            return null;
          }

          return (
            <article key={decision.partId} className="rounded-xl border border-border bg-card p-3">
              <div className="mb-2 flex flex-wrap gap-1.5">
                <DecisionBadges decision={decision} />
              </div>
              <h4 className="text-sm font-semibold leading-snug">{part.displayName}</h4>
              <p className="mt-2 text-xs text-muted-foreground">{decision.recommendationReason}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ComparisonTable({
  build,
  fields,
  parts,
  selectedPart,
  decisions,
  plan,
  isReplacing,
  onPreviewSwap,
  onUpgraded,
}: {
  build: Build;
  fields: ReturnType<typeof getCategoryComparisonFields>;
  parts: Part[];
  selectedPart: Part;
  decisions: PartDecisionMetadata[];
  plan: PlanType;
  isReplacing?: boolean;
  onPreviewSwap: (part: Part) => void;
  onUpgraded?: () => void;
}) {
  const hasAdvancedCompare = canUseFeature(plan, "advanced_compare");
  const getDecision = (part: Part) =>
    decisions.find((decision) => decision.partId === part.id) ??
    getPartDecisionMetadata(build, [part], selectedPart)[0];

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="border-b border-border bg-secondary/40 px-4 py-3">
        <h3 className="text-base font-semibold">Explainable decision comparison</h3>
        <p className="text-xs text-muted-foreground">
          Decision labels are deterministic and use the current build, budget, compatibility checks,
          and part scores.
        </p>
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
                      <span className="normal-case tracking-normal text-foreground">
                        {part.displayName}
                      </span>
                      {part.id === selectedPart.id && (
                        <Badge className="rounded-md bg-primary/15 text-primary">Current</Badge>
                      )}
                    </div>
                    <p className="font-mono text-lg font-bold text-primary">
                      {part.owned ? "$0 - Already owned" : formatMoney(part.price)}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      <DecisionBadges decision={getDecision(part)} />
                      {getComparisonDeltaBadges(build, part, selectedPart)
                        .slice(0, 2)
                        .map((badge) => (
                          <DeltaBadge key={badge.label} {...badge} />
                        ))}
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            <tr>
              <td className="px-4 py-3 text-muted-foreground">Decision badges</td>
              {parts.map((part) => (
                <td key={part.id} className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    <DecisionBadges decision={getDecision(part)} />
                  </div>
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-4 py-3 text-muted-foreground">Recommendation reason</td>
              {parts.map((part) => (
                <td key={part.id} className="px-4 py-3 text-muted-foreground">
                  {getDecision(part).recommendationReason}
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-4 py-3 text-muted-foreground">Trade-off summary</td>
              {parts.map((part) => (
                <td key={part.id} className="px-4 py-3 text-muted-foreground">
                  {getDecision(part).tradeOffSummary}
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-4 py-3 text-muted-foreground">Total after swap</td>
              {parts.map((part) => (
                <td key={part.id} className="px-4 py-3 font-mono font-semibold">
                  {formatMoney(getDecision(part).totalPriceAfterSwap)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-4 py-3 text-muted-foreground">Beginner deltas</td>
              {parts.map((part) => {
                return (
                  <td key={part.id} className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {getComparisonDeltaBadges(build, part, selectedPart).map((badge) => (
                        <DeltaBadge key={badge.label} {...badge} />
                      ))}
                    </div>
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
              values={parts.map((part) => `${getDecision(part).valueScore}/100 value score`)}
            />
            <AdvancedRow
              label="Performance fit"
              unlocked={hasAdvancedCompare}
              featureLabel="Performance fit"
              onUpgraded={onUpgraded}
              values={parts.map((part) =>
                getDecision(part).performanceScore !== null
                  ? `${getDecision(part).performanceScore}/100`
                  : "Category fit",
              )}
            />
            <tr>
              <td className="px-4 py-3 text-muted-foreground">Compatibility impact</td>
              {parts.map((part) => {
                const decision = getDecision(part);
                return (
                  <td key={part.id} className="px-4 py-3">
                    <CompatibilityImpactBadge impact={decision.compatibilityImpact} />
                    <p className="mt-2 text-xs text-muted-foreground">
                      {decision.compatibilityImpact.summary}
                    </p>
                  </td>
                );
              })}
            </tr>
            <tr>
              <td className="px-4 py-3 text-muted-foreground">Final recommendation</td>
              {parts.map((part) => {
                const decision = getDecision(part);
                const isStrongPick =
                  decision.bestBudgetFit ||
                  decision.bestValue ||
                  decision.bestPerformance ||
                  decision.beginnerFriendly;

                return (
                  <td key={part.id} className="px-4 py-3">
                    {part.id === selectedPart.id
                      ? "Keep if you are already satisfied with the current build."
                      : isStrongPick
                        ? "Preview this swap before replacing."
                        : "Compare carefully before choosing this over the labeled picks."}
                  </td>
                );
              })}
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

function DeltaBadge({ label, tone }: { label: string; tone: "success" | "warning" | "neutral" }) {
  return (
    <span
      className={cn(
        "rounded-md border px-2 py-0.5 text-[11px] font-medium",
        tone === "success" && "border-success/25 bg-success/10 text-success",
        tone === "warning" && "border-warning/25 bg-warning/10 text-warning",
        tone === "neutral" && "border-border bg-background/70 text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

function DecisionBadges({ decision }: { decision: PartDecisionMetadata }) {
  const badges = [
    decision.bestValue && { label: "Best Value", tone: "success" as const },
    decision.bestPerformance && { label: "Best Performance", tone: "neutral" as const },
    decision.bestBudgetFit && { label: "Best Budget Fit", tone: "success" as const },
    decision.beginnerFriendly && { label: "Beginner Friendly", tone: "success" as const },
  ].filter((badge): badge is { label: string; tone: "success" | "warning" | "neutral" } =>
    Boolean(badge),
  );

  if (badges.length === 0) {
    return <DeltaBadge label="Compare carefully" tone="neutral" />;
  }

  return (
    <>
      {badges.map((badge) => (
        <DeltaBadge key={badge.label} {...badge} />
      ))}
    </>
  );
}

function CompatibilityImpactBadge({
  impact,
}: {
  impact: PartDecisionMetadata["compatibilityImpact"];
}) {
  if (impact.status === "pass") {
    return (
      <Badge className="rounded-md bg-success/15 text-success">
        <CheckCircle2 className="mr-1 size-3" /> Compatibility Impact: Pass
      </Badge>
    );
  }

  if (impact.status === "warning") {
    return (
      <Badge className="rounded-md bg-warning/15 text-warning">Compatibility Impact: Review</Badge>
    );
  }

  return (
    <Badge className="rounded-md bg-destructive/15 text-destructive">
      <AlertTriangle className="mr-1 size-3" /> Compatibility Impact: Fix first
    </Badge>
  );
}

function PreviewSwapPanel({
  build,
  currentPart,
  previewPart,
  plan,
  isReplacing,
  canReplacePart,
  isHighlighted,
  panelRef,
  onCancel,
  onConfirm,
  onUpgraded,
}: {
  build: Build;
  currentPart: Part;
  previewPart: Part;
  plan: PlanType;
  isReplacing?: boolean;
  canReplacePart: boolean;
  isHighlighted: boolean;
  panelRef: RefObject<HTMLElement | null>;
  onCancel: () => void;
  onConfirm: () => void;
  onUpgraded?: () => void;
}) {
  const candidateBuild = buildCandidate(build, previewPart);
  const delta = getDisplayPrice(previewPart) - getDisplayPrice(currentPart);
  const hasAdvancedCompare = canUseFeature(plan, "advanced_compare");
  const affiliateLink = previewPart.affiliateLinks?.[0];
  const decision =
    getPartDecisionMetadata(build, [currentPart, previewPart], currentPart).find(
      (item) => item.partId === previewPart.id,
    ) ?? getPartDecisionMetadata(build, [previewPart], currentPart)[0];
  const [dealMessage, setDealMessage] = useState<string | null>(null);

  async function handlePreviewAffiliateClick(link: AffiliateLink) {
    if (!link.url) {
      setDealMessage("We do not have a deal link for this part yet.");
      return;
    }

    const openedWindow = window.open("about:blank", "_blank");

    if (!openedWindow) {
      setDealMessage(
        "Your browser blocked the new tab. Please allow popups for this site and try again.",
      );
      return;
    }

    openedWindow.opener = null;
    await trackAffiliateClick({
      partId: previewPart.id,
      merchant: link.merchant,
      url: link.url,
      buildId: build.id,
    });

    openedWindow.location.href = link.url;
    setDealMessage(null);
  }

  return (
    <section
      ref={panelRef}
      className={cn(
        "mt-5 rounded-xl border border-primary/25 bg-primary/5 p-4 transition-all duration-500",
        isHighlighted && "border-primary/70 bg-primary/10 ring-2 ring-primary/25 shadow-glow",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge className="mb-3 rounded-md border border-primary/30 bg-primary/15 text-primary">
            <ArrowRightLeft className="mr-1 size-3" /> Swap Preview
          </Badge>
          <h3 className="text-lg font-bold">{previewPart.displayName}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Review the price and compatibility impact before replacing the current{" "}
            {categoryLabels[currentPart.category].toLowerCase()}.
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

      <div className="mt-4 grid gap-3 lg:grid-cols-4">
        <InfoRow
          label="Price change"
          value={
            previewPart.owned
              ? "$0 - Already owned"
              : delta < 0
                ? `-${formatMoney(Math.abs(delta))}`
                : `+${formatMoney(delta)}`
          }
          valueClass={delta <= 0 ? "text-success" : "text-warning"}
        />
        <InfoRow label="New build total" value={formatMoney(candidateBuild.totalPrice)} />
        <div className="rounded-xl border border-border bg-background/60 px-3 py-3">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Compatibility</p>
          <div className="mt-2">
            <CompatibilityBadge build={candidateBuild} />
          </div>
        </div>
        <InfoRow label="Power requirement" value={getPartPowerRequirement(previewPart)} />
      </div>

      <div className="mt-4 rounded-xl border border-border bg-background/60 p-4">
        <div className="flex flex-wrap gap-1.5">
          <DecisionBadges decision={decision} />
          <CompatibilityImpactBadge impact={decision.compatibilityImpact} />
        </div>
        <p className="mt-3 text-sm font-medium">{decision.recommendationReason}</p>
        <p className="mt-1 text-sm text-muted-foreground">{decision.tradeOffSummary}</p>
      </div>

      <div className="mt-4">
        {hasAdvancedCompare ? (
          <div className="rounded-xl border border-border bg-background/60 p-4 text-sm text-muted-foreground">
            {decision.compatibilityImpact.summary}
          </div>
        ) : (
          <ProFeatureLock
            feature="unlimited_swaps"
            label="Upgrade/downgrade explanation"
            showUpgrade={false}
            onUpgraded={onUpgraded}
          />
        )}
      </div>

      {!canReplacePart && (
        <div className="mt-4">
          <ProFeatureLock
            feature="unlimited_swaps"
            label="Keep tuning this build"
            onUpgraded={onUpgraded}
          />
        </div>
      )}

      {candidateBuild.compatibilityWarnings.length > 0 && (
        <div className="mt-4 space-y-2">
          {candidateBuild.compatibilityWarnings.map((warning) => (
            <div
              key={warning.id}
              className="rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning"
            >
              {warning.message}
            </div>
          ))}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <AffiliateDisclosure />
        <div className="flex flex-wrap justify-end gap-3">
          {affiliateLink && (
            <Button
              variant="ghost"
              className="rounded-xl"
              onClick={() => void handlePreviewAffiliateClick(affiliateLink)}
            >
              <ShoppingBag className="mr-2 size-4" />
              {affiliateLink.label ?? "Check price"}
            </Button>
          )}
          {dealMessage && (
            <p className="basis-full rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              {dealMessage}
            </p>
          )}
          <Button variant="secondary" className="rounded-xl" onClick={onCancel}>
            Keep current part
          </Button>
          <Button
            className="rounded-xl shadow-glow"
            disabled={isReplacing || !canReplacePart}
            onClick={onConfirm}
          >
            {isReplacing ? (
              <>
                <LoaderCircle className="mr-2 size-4 animate-spin" /> Replacing
              </>
            ) : (
              "Replace with this part"
            )}
          </Button>
        </div>
      </div>
    </section>
  );
}

function CompareTray({
  trayRef,
  parts,
  selectedPart,
  onRemove,
  onClear,
  onCompare,
}: {
  trayRef: RefObject<HTMLDivElement | null>;
  parts: Part[];
  selectedPart: Part;
  onRemove: (part: Part) => void;
  onClear: () => void;
  onCompare: () => void;
}) {
  return (
    <div
      ref={trayRef}
      className="sticky bottom-0 z-20 border-t border-border bg-background/95 px-6 py-2 backdrop-blur"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <Badge className="rounded-md border border-primary/30 bg-primary/10 text-primary">
            <GitCompare className="mr-1 size-3" /> {parts.length}/4 selected
          </Badge>
          {parts.length === 0 ? (
            <span className="text-xs text-muted-foreground">Select 2 to 4 parts to compare.</span>
          ) : (
            parts.map((part) => (
              <button
                key={part.id}
                type="button"
                className="inline-flex max-w-[180px] items-center gap-2 rounded-full border border-border bg-card px-2.5 py-1 text-xs"
                onClick={() => onRemove(part)}
              >
                <span className="truncate">
                  {part.id === selectedPart.id ? "Current: " : ""}
                  {part.displayName}
                </span>
                <X className="size-3 shrink-0 text-muted-foreground" />
              </button>
            ))
          )}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" className="rounded-md" onClick={onClear}>
            Reset
          </Button>
          {parts.length >= 2 && (
            <Button size="sm" className="rounded-md" onClick={onCompare}>
              Compare selected
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function PartVisual({ part, featured = false }: { part: Part; featured?: boolean }) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(part.imageUrl) && !imageFailed;

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br text-primary shadow-inner",
        CATEGORY_VISUALS[part.category] ?? "from-primary/15 to-secondary",
        featured ? "size-20" : "size-16",
      )}
    >
      {showImage ? (
        <img
          src={part.imageUrl}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
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
    return (
      <Badge className="rounded-md bg-success/15 text-success">
        <CheckCircle2 className="mr-1 size-3" /> {build.confidenceScore.score}/100
      </Badge>
    );
  }

  if (build.compatibilityStatus === "warning") {
    return (
      <Badge className="rounded-md bg-warning/15 text-warning">
        {build.confidenceScore.score}/100 warning
      </Badge>
    );
  }

  return (
    <Badge className="rounded-md bg-destructive/15 text-destructive">
      <AlertTriangle className="mr-1 size-3" /> {build.confidenceScore.score}/100 review
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

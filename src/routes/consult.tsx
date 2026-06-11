import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BuildCard } from "@/components/build-card";
import { ChatPanel } from "@/components/chat-panel";
import { CompareDrawer } from "@/components/compare-drawer";
import { TopBar } from "@/components/top-bar";
import { categoryLabels } from "@/data/seedParts";
import {
  getCartPreview,
  getCompareParts,
  getPartsByCategory,
  getRecommendedBuild,
  getRecommendedReplacementForWarning,
  getStoreEmployeeSummary,
  replaceBuildPart,
} from "@/lib/mockApi";
import type {
  Build,
  CartPreviewItem,
  CompatibilityWarning,
  StoreEmployeeSummary,
} from "@/types/build";
import type { Part } from "@/types/parts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  ClipboardList,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  Store,
  Wrench,
} from "lucide-react";

export const Route = createFileRoute("/consult")({
  head: () => ({
    meta: [
      { title: "Customer Consultation | AI PC Build Advisor" },
      {
        name: "description",
        content: "Chat with the AI advisor to collect customer needs and generate a live PC build.",
      },
    ],
  }),
  component: ConsultPage,
});

function normalizeCategory(category: string) {
  return category.toLowerCase();
}

function getWarningTargetCategory(warning: CompatibilityWarning) {
  if (
    warning.id === "psu-headroom" ||
    warning.id === "psu-headroom-tight" ||
    warning.id === "gpu-psu-vendor-guidance"
  ) {
    return "psu";
  }

  if (warning.id === "cpu-motherboard-socket") {
    return "motherboard";
  }

  if (warning.id === "motherboard-ram-type") {
    return "ram";
  }

  if (warning.id === "gpu-case-clearance") {
    return "case";
  }

  if (warning.id === "case-motherboard-form-factor") {
    return "case";
  }

  if (warning.id === "air-cooler-height" || warning.id === "aio-radiator-fit") {
    return "cooler";
  }

  return null;
}

function getFixButtonLabel(part: Part | null) {
  if (!part) {
    return "No automatic fix available";
  }

  if (part.category === "psu" && typeof part.specs.wattageW === "number") {
    return `Replace with ${part.specs.wattageW}W PSU`;
  }

  return `Replace with ${part.displayName}`;
}

function getFixNowDescription(category: string | null) {
  if (category === "psu") {
    return "Open PSU alternatives with wattage, headroom, and recommendation notes.";
  }

  if (!category) {
    return "This warning still needs a manual compatibility review.";
  }

  return "Open compatible alternatives for this warning and replace the affected part.";
}

function ConsultPage() {
  const [build, setBuild] = useState<Build | null>(null);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [cartPreview, setCartPreview] = useState<CartPreviewItem[]>([]);
  const [employeeSummary, setEmployeeSummary] = useState<StoreEmployeeSummary | null>(null);
  const [compareCategory, setCompareCategory] = useState<string | null>(null);
  const [compareParts, setCompareParts] = useState<Part[]>([]);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [recommendedReplacementId, setRecommendedReplacementId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isLoadingBuild, setIsLoadingBuild] = useState(true);
  const [isLoadingCompare, setIsLoadingCompare] = useState(false);
  const [isReplacingPart, setIsReplacingPart] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadBuild() {
      setIsLoadingBuild(true);
      setBuildError(null);

      try {
        const recommendedBuild = await getRecommendedBuild({
          budget: 2500,
          targetUseCase: ["4K video editing", "casual gaming"],
        });

        if (!active) {
          return;
        }

        setBuild(recommendedBuild);
      } catch {
        if (!active) {
          return;
        }

        setBuildError("The mock recommendation could not be loaded. Please refresh and try again.");
      } finally {
        if (active) {
          setIsLoadingBuild(false);
        }
      }
    }

    void loadBuild();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function refreshDerivedData() {
      if (!build) {
        return;
      }

      const preview = await getCartPreview(build);

      if (!active) {
        return;
      }

      setCartPreview(preview);
      setEmployeeSummary(getStoreEmployeeSummary(build, preview));
    }

    void refreshDerivedData();

    return () => {
      active = false;
    };
  }, [build]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function handleDrawerOpenChange(open: boolean) {
    setIsDrawerOpen(open);

    if (!open) {
      setCompareCategory(null);
      setCompareParts([]);
      setCompareError(null);
      setRecommendedReplacementId(null);
      setIsLoadingCompare(false);
    }
  }

  async function openCompare(category: string, nextRecommendedReplacementId?: string | null) {
    const normalizedCategory = normalizeCategory(category);

    setCompareCategory(normalizedCategory);
    setCompareError(null);
    setCompareParts([]);
    setRecommendedReplacementId(nextRecommendedReplacementId ?? null);
    setIsDrawerOpen(true);
    setIsLoadingCompare(true);

    try {
      const categoryParts = await getPartsByCategory(normalizedCategory);
      const comparedParts = await getCompareParts(categoryParts.map((part) => part.id));

      setCompareParts(comparedParts);
    } catch {
      setCompareError(
        `The ${normalizedCategory.toUpperCase()} alternatives could not be loaded from local mock data.`,
      );
    } finally {
      setIsLoadingCompare(false);
    }
  }

  async function handleReplacePart(part: Part, successMessage?: string) {
    if (!build) {
      return;
    }

    setIsReplacingPart(true);

    try {
      const nextBuild = await replaceBuildPart(build, part);
      setBuild(nextBuild);
      handleDrawerOpenChange(false);
      setToast(successMessage ?? `Replaced ${categoryLabels[part.category]} with ${part.displayName}.`);
    } finally {
      setIsReplacingPart(false);
    }
  }

  async function handleFixWarning(warning: CompatibilityWarning) {
    if (!build) {
      return;
    }

    const category = getWarningTargetCategory(warning);
    const recommendedPart = getRecommendedReplacementForWarning(build, warning);

    if (!category) {
      setToast("This warning does not have an automatic compare target yet.");
      return;
    }

    await openCompare(category, recommendedPart?.id ?? null);
  }

  function renderWarningActions(warning: CompatibilityWarning) {
    if (!build) {
      return null;
    }

    const category = getWarningTargetCategory(warning);
    const recommendedPart = getRecommendedReplacementForWarning(build, warning);
    const directFixAllowed =
      Boolean(recommendedPart) && !isReplacingPart && warning.id.includes("psu");

    return (
      <div className="mt-4 grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto]">
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-left transition-colors hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!category}
          onClick={() => void handleFixWarning(warning)}
        >
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-primary">
              <Wrench className="size-4" />
              Fix Now
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{getFixNowDescription(category)}</p>
          </div>
          <ArrowRightLeft className="size-4 shrink-0 text-primary" />
        </button>

        {directFixAllowed ? (
          <Button
            size="sm"
            variant="secondary"
            className="h-auto rounded-lg px-4 py-3"
            onClick={() =>
              recommendedPart
                ? void handleReplacePart(
                    recommendedPart,
                    `Applied recommended fix: ${recommendedPart.displayName}.`,
                  )
                : undefined
            }
          >
            {getFixButtonLabel(recommendedPart)}
          </Button>
        ) : (
          <Button size="sm" variant="secondary" className="h-auto rounded-lg px-4 py-3" disabled>
            {recommendedPart ? getFixButtonLabel(recommendedPart) : "Manual review needed"}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <TopBar />

      <main className="grid h-[calc(100vh-4rem)] min-h-0 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_390px] xl:grid-cols-[minmax(0,1fr)_410px]">
        <section className="min-h-0 min-w-0 overflow-y-auto bg-card/30">
          <div className="mx-auto max-w-6xl space-y-6 px-6 py-6 md:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Badge className="mb-3 rounded-md border border-primary/30 bg-primary/10 text-primary">
                  <Sparkles className="mr-1 size-3" /> Interaction + layout milestone
                </Badge>
                <h1 className="text-3xl font-bold tracking-tight">Live Build Recommendation</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  The Lovable design stays intact while the compare, replacement, warning-fix, and
                  summary flows now update from local mock data.
                </p>
              </div>

              {isLoadingBuild && (
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm text-muted-foreground">
                  <LoaderCircle className="size-4 animate-spin" />
                  Loading recommended build
                </div>
              )}
            </div>

            {buildError ? (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6">
                <h2 className="text-lg font-bold text-destructive">Build could not be loaded</h2>
                <p className="mt-2 text-sm text-destructive/90">{buildError}</p>
              </div>
            ) : build ? (
              <>
                <BuildCard
                  build={build}
                  focusedCategory={compareCategory ?? undefined}
                  onFocus={(category) => void openCompare(category)}
                  onCompare={(category) => void openCompare(category)}
                />

                <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                  <section className="rounded-2xl border border-border bg-card p-6">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="size-4 text-primary" />
                          <h2 className="text-xl font-bold">Compatibility Warnings</h2>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Every warning card now includes a direct fix path when local mock data can support it.
                        </p>
                      </div>
                      <Badge
                        className={
                          build.compatibilityStatus === "pass"
                            ? "bg-success/15 text-success"
                            : build.compatibilityStatus === "warning"
                              ? "bg-warning/15 text-warning"
                              : "bg-destructive/15 text-destructive"
                        }
                      >
                        {build.compatibilityStatus === "pass"
                          ? "All checks passed"
                          : `${build.compatibilityWarnings.length} active`}
                      </Badge>
                    </div>

                    {build.compatibilityWarnings.length === 0 ? (
                      <div className="rounded-2xl border border-success/20 bg-success/10 p-4 text-sm text-success">
                        Every current part passes the local mock compatibility rules.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {build.compatibilityWarnings.map((warning) => (
                          <div
                            key={warning.id}
                            className="rounded-2xl border border-border bg-background/60 p-4 transition-colors hover:border-primary/20"
                          >
                            <div className="flex items-start gap-3">
                              <AlertTriangle
                                className={
                                  warning.severity === "error"
                                    ? "mt-0.5 size-4 shrink-0 text-destructive"
                                    : "mt-0.5 size-4 shrink-0 text-warning"
                                }
                              />
                              <div className="flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-medium">{warning.message}</p>
                                  {getWarningTargetCategory(warning) && (
                                    <Badge className="bg-primary/15 text-primary">Fix Now</Badge>
                                  )}
                                </div>
                                {warning.suggestedFix && (
                                  <p className="mt-1 text-sm text-muted-foreground">
                                    Suggested fix: {warning.suggestedFix}
                                  </p>
                                )}
                                {renderWarningActions(warning)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="rounded-2xl border border-primary/20 bg-primary/5 p-6">
                    <div className="mb-4 flex items-center gap-2">
                      <Store className="size-4 text-primary" />
                      <h2 className="text-xl font-bold text-primary">Store Employee Summary</h2>
                    </div>

                    {employeeSummary ? (
                      <div className="space-y-4 text-sm">
                        <SummaryBlock label="Customer goal" value={employeeSummary.customerGoal} />
                        <SummaryBlock
                          label="Recommendation logic"
                          value={employeeSummary.recommendedBuildLogic}
                        />
                        <SummaryList
                          label="Key selling points"
                          values={employeeSummary.keySellingPoints}
                        />
                        <SummaryBlock
                          label="Cheaper alternative"
                          value={employeeSummary.cheaperAlternative}
                        />
                        <SummaryBlock label="Upsell option" value={employeeSummary.upsellOption} />
                        <SummaryBlock
                          label="Compatibility status"
                          value={employeeSummary.compatibilityStatus}
                        />
                        <SummaryBlock
                          label="Pre-cart status"
                          value={employeeSummary.preCartStatus}
                        />
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-primary/15 bg-background/60 p-4 text-sm text-muted-foreground">
                        Employee summary will appear after the build finishes loading.
                      </div>
                    )}
                  </section>
                </div>

                <section className="rounded-2xl border border-border bg-card p-6">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <ClipboardList className="size-4 text-primary" />
                        <h2 className="text-xl font-bold">Pre-Cart Preview</h2>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Mock store handoff list only. No checkout or live retailer integration yet.
                      </p>
                    </div>
                    <Badge variant="secondary" className="rounded-md">
                      {cartPreview.length} items
                    </Badge>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-border">
                    {cartPreview.length === 0 ? (
                      <div className="p-5 text-sm text-muted-foreground">
                        Pre-cart items will populate as soon as the mock build is ready.
                      </div>
                    ) : (
                      <table className="w-full text-left text-sm">
                        <thead className="bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
                          <tr>
                            <th className="px-4 py-3 font-medium">Part</th>
                            <th className="px-4 py-3 font-medium">Retailer</th>
                            <th className="px-4 py-3 font-medium">Note</th>
                            <th className="px-4 py-3 text-right font-medium">Price</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {cartPreview.map((item) => (
                            <tr key={item.partId}>
                              <td className="px-4 py-3">{item.displayName}</td>
                              <td className="px-4 py-3 text-muted-foreground">{item.retailer}</td>
                              <td className="px-4 py-3 text-muted-foreground">{item.note}</td>
                              <td className="px-4 py-3 text-right font-mono">
                                ${item.estimatedPrice.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-background/70">
                            <td colSpan={3} className="px-4 py-3 text-right font-semibold">
                              Total
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-base font-bold text-primary">
                              ${build.totalPrice.toFixed(2)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    )}
                  </div>
                </section>
              </>
            ) : (
              <div className="rounded-2xl border border-border bg-card p-8 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <LoaderCircle className="size-5 animate-spin" />
                </div>
                <h2 className="mt-4 text-xl font-bold">Preparing the first mock recommendation</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  The consultation layout is loading the initial build and seed catalog.
                </p>
              </div>
            )}
          </div>
        </section>

        <ChatPanel className="shrink-0" />
      </main>

      {build && (
        <CompareDrawer
          build={build}
          category={compareCategory}
          parts={compareParts}
          open={isDrawerOpen}
          isLoading={isLoadingCompare}
          isReplacing={isReplacingPart}
          errorMessage={compareError}
          recommendedReplacementId={recommendedReplacementId}
          onOpenChange={handleDrawerOpenChange}
          onReplace={(part) => void handleReplacePart(part)}
        />
      )}

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-primary/30 bg-card/95 px-4 py-3 text-sm shadow-glow backdrop-blur">
            <CheckCircle2 className="size-4 text-primary" />
            <span>{toast}</span>
            <Button variant="ghost" size="sm" className="rounded-md" onClick={() => setToast(null)}>
              Dismiss
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-primary/15 bg-background/60 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-2 leading-relaxed">{value}</p>
    </div>
  );
}

function SummaryList({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="rounded-2xl border border-primary/15 bg-background/60 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <div className="mt-3 space-y-2">
        {values.map((value) => (
          <div key={value} className="flex gap-2">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
            <p>{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

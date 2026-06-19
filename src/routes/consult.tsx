import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BuildCard } from "@/components/build-card";
import { ChatPanel, type ChatMessage } from "@/components/chat-panel";
import { CompareDrawer } from "@/components/compare-drawer";
import { TopBar } from "@/components/top-bar";
import { AffiliateDisclosure } from "@/components/AffiliateDisclosure";
import { ProFeatureLock } from "@/components/ProFeatureLock";
import { UpgradeCard } from "@/components/UpgradeCard";
import { UsageBadge } from "@/components/UsageBadge";
import { categoryLabels } from "@/data/seedParts";
import {
  askAdvisor,
  getEntitlementStatus,
  getCartPreview,
  getCompareParts,
  getPartsByCategory,
  getRecommendedBuild,
  getRecommendedReplacementForWarning,
  getUsageStatus,
  consumeReplacementUsage,
  resetMockMonetizationState,
  replaceBuildPart,
  trackAffiliateClick,
} from "@/lib/apiClient";
import { canUseFeature, getPlanForEntitlement } from "@/lib/monetization";
import { mergeCustomerNeeds } from "@/lib/needParser";
import type {
  CustomerNeeds,
  RecommendedBuildInput,
} from "@/types/api";
import type {
  Build as BuildModel,
  CartPreviewItem as CartPreviewItemModel,
  CompatibilityWarning as CompatibilityWarningModel,
  StoreEmployeeSummary as StoreEmployeeSummaryModel,
} from "@/types/build";
import type { Entitlement, UsageStatus } from "@/types/monetization";
import type { Part } from "@/types/parts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ArrowRightLeft,
  ChevronDown,
  CheckCircle2,
  ClipboardList,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  ShoppingBag,
  Wrench,
} from "lucide-react";

const DEFAULT_RECOMMENDATION_INPUT: RecommendedBuildInput = {
  budget: 2500,
  targetUseCase: ["4K video editing", "casual gaming"],
};

const QUICK_REPLIES = [
  "2K gaming",
  "Video editing",
  "Budget $2500",
  "Black case",
  "Beginner",
];

const INITIAL_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: "assistant-welcome",
    role: "assistant",
    text: "Tell me your budget, main workload, preferred look, or Intel / AMD / NVIDIA preference and I'll refresh the build on the left.",
  },
];

const PRO_PURCHASE_CHECKLIST = [
  "Confirm CPU and motherboard socket compatibility",
  "Confirm RAM type",
  "Confirm PSU wattage",
  "Confirm GPU clearance",
  "Confirm case and cooler fit",
  "Confirm storage slots",
  "Confirm Windows/license plan",
  "Confirm monitor resolution target",
];

export const Route = createFileRoute("/consult")({
  head: () => ({
    meta: [
      { title: "Build Advisor | AI PC Build Advisor" },
      {
        name: "description",
        content: "Chat with the AI advisor to collect your PC needs and generate a live build.",
      },
    ],
  }),
  component: ConsultPage,
});

function normalizeCategory(category: string) {
  return category.toLowerCase();
}

function getWarningTargetCategory(warning: CompatibilityWarningModel) {
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

function createMessageId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatNeedsList(values: string[] | undefined) {
  return values && values.length > 0 ? values.join(" + ") : "Still collecting";
}

function formatAppearancePreference(value: CustomerNeeds["appearancePreference"]) {
  if (!value) {
    return "Still collecting";
  }

  if (value === "rgb") {
    return "RGB lighting";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatExperienceLevel(value: CustomerNeeds["experienceLevel"]) {
  if (!value) {
    return "Still collecting";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatBrandPreference(needs: CustomerNeeds) {
  const labels = [
    needs.cpuBrandPreference ? needs.cpuBrandPreference.toUpperCase() : null,
    needs.gpuBrandPreference ? needs.gpuBrandPreference.toUpperCase() : null,
  ].filter(Boolean);

  return labels.length > 0 ? labels.join(" / ") : "Still collecting";
}

function buildAssistantReply({
  build,
  matchedFields,
  needs,
}: {
  build?: BuildModel | null;
  matchedFields: string[];
  needs: CustomerNeeds;
}) {
  if (matchedFields.length === 0) {
    return "I can help once I have a little more to work with. Try a budget, a workload like gaming or video editing, a preferred look, or an Intel / AMD / NVIDIA preference.";
  }

  const responseBits: string[] = [];

  if (needs.budget) {
    responseBits.push(`budget around $${needs.budget.toLocaleString()}`);
  }

  if (needs.targetUseCase && needs.targetUseCase.length > 0) {
    responseBits.push(needs.targetUseCase.join(" + ").toLowerCase());
  }

  if (needs.appearancePreference) {
    responseBits.push(`${needs.appearancePreference} styling`);
  }

  if (needs.experienceLevel) {
    responseBits.push(`${needs.experienceLevel} experience level`);
  }

  if (needs.cpuBrandPreference || needs.gpuBrandPreference) {
    responseBits.push(
      [needs.cpuBrandPreference?.toUpperCase(), needs.gpuBrandPreference?.toUpperCase()]
        .filter(Boolean)
        .join(" / "),
    );
  }

  const cpu = build?.parts.find((part) => part.category === "cpu");
  const gpu = build?.parts.find((part) => part.category === "gpu");
  const followUp =
    !needs.budget
      ? "A budget range would help tighten the rest of the parts."
      : !needs.targetUseCase || needs.targetUseCase.length === 0
          ? "Tell me the main workload next so I can tune the GPU and CPU balance."
        : !needs.experienceLevel
          ? "If you want, tell me whether you're a beginner or more advanced and I'll tune how aggressive the recommendation should be."
          : "You can still open the Part Compare Drawer on any part to review alternatives.";

  return `Noted ${responseBits.join(", ")}. I refreshed the recommendation around ${cpu?.displayName ?? "the selected CPU"} and ${gpu?.displayName ?? "the selected GPU"}. ${followUp}`;
}

function hasExtractedNeeds(needs: CustomerNeeds | undefined) {
  return Boolean(
    needs &&
      (needs.budget ||
        needs.targetUseCase?.length ||
        needs.appearancePreference ||
        needs.experienceLevel ||
        needs.cpuBrandPreference ||
        needs.gpuBrandPreference),
  );
}

function ConsultPage() {
  const [build, setBuild] = useState<BuildModel | null>(null);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [cartPreview, setCartPreview] = useState<CartPreviewItemModel[]>([]);
  const [employeeSummary, setEmployeeSummary] = useState<StoreEmployeeSummaryModel | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [compareCategory, setCompareCategory] = useState<string | null>(null);
  const [compareParts, setCompareParts] = useState<Part[]>([]);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [recommendedReplacementId, setRecommendedReplacementId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isLoadingBuild, setIsLoadingBuild] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isLoadingCompare, setIsLoadingCompare] = useState(false);
  const [isReplacingPart, setIsReplacingPart] = useState(false);
  const [isGeneratingRecommendation, setIsGeneratingRecommendation] = useState(false);
  const [customerNeeds, setCustomerNeeds] = useState<CustomerNeeds>({});
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(INITIAL_CHAT_MESSAGES);
  const [chatInput, setChatInput] = useState("");
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const [usageStatus, setUsageStatus] = useState<UsageStatus | null>(null);
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [showUsageUpgrade, setShowUsageUpgrade] = useState(false);
  const [expandedWarningIds, setExpandedWarningIds] = useState<Set<string>>(new Set());
  const plan = getPlanForEntitlement(entitlement);
  const hasPurchaseChecklist = canUseFeature(plan, "purchase_checklist");

  useEffect(() => {
    let active = true;

    async function loadBuild() {
      setIsLoadingBuild(true);
      setIsLoadingDetails(false);
      setBuildError(null);
      setDetailsError(null);

      try {
        const recommendedBuild = await getRecommendedBuild(DEFAULT_RECOMMENDATION_INPUT);

        if (!active) {
          return;
        }

        setBuild(recommendedBuild);
        setIsLoadingBuild(false);
        setIsLoadingDetails(true);

        try {
          const preview = await getCartPreview(recommendedBuild);

          if (!active) {
            return;
          }

          setCartPreview(preview.items);
          setEmployeeSummary(preview.employeeSummary);
        } catch {
          if (!active) {
            return;
          }

          setDetailsError("The purchase references and recommendation summary could not be loaded from the mock API.");
        } finally {
          if (active) {
            setIsLoadingDetails(false);
          }
        }
      } catch {
        if (!active) {
          return;
        }

        setBuildError("The internal recommendation API could not be loaded. Please refresh and try again.");
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
    void refreshMonetizationState();
  }, []);

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

  async function refreshMonetizationState() {
    try {
      const [nextEntitlement, nextUsage] = await Promise.all([
        getEntitlementStatus(),
        getUsageStatus(),
      ]);
      setEntitlement(nextEntitlement);
      setUsageStatus(nextUsage);
      if (nextUsage.canAskAiQuestion) {
        setShowUsageUpgrade(false);
      }
    } catch {
      setEntitlement({
        userId: "mock-user",
        plan: "free",
        active: true,
        startedAt: new Date().toISOString(),
      });
    }
  }

  async function handleResetMonetization() {
    try {
      const result = await resetMockMonetizationState();
      setEntitlement(result.entitlement);
      setUsageStatus(result.usage);
      setShowUsageUpgrade(false);
      setToast({
        message: result.message,
        tone: "success",
      });
    } catch {
      setToast({
        message: "Could not reset mock monetization state right now.",
        tone: "error",
      });
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
        `The ${normalizedCategory.toUpperCase()} alternatives could not be loaded from the internal API.`,
      );
    } finally {
      setIsLoadingCompare(false);
    }
  }

  async function refreshBuildAndDetails(nextInput?: RecommendedBuildInput) {
    const recommendedBuild = await getRecommendedBuild(nextInput);
    const preview = await getCartPreview(recommendedBuild);

    return {
      build: recommendedBuild,
      cartPreview: preview.items,
      employeeSummary: preview.employeeSummary,
    };
  }

  async function handleReplacePart(part: Part, successMessage?: string) {
    if (!build) {
      return;
    }

    setIsReplacingPart(true);
    setDetailsError(null);

    try {
      const replacementUsage = await consumeReplacementUsage();
      setUsageStatus(replacementUsage.usage);

      if (!replacementUsage.consumed) {
        setShowUsageUpgrade(true);
        setToast({
          message:
            replacementUsage.message ??
            "You have used your included hardware replacements for this build.",
          tone: "error",
        });
        return;
      }

      const nextState = await replaceBuildPart(build, part);
      setBuild(nextState.build);
      setCartPreview(nextState.cartPreview);
      setEmployeeSummary(nextState.employeeSummary);
      handleDrawerOpenChange(false);
      setToast({
        message:
          successMessage ?? `Replaced ${categoryLabels[part.category]} with ${part.displayName}.`,
        tone: "success",
      });
    } catch {
      setDetailsError(
        "The selected part could not be applied through the internal API. Please try again.",
      );
      setToast({
        message: `Could not replace ${categoryLabels[part.category]} right now. Please try again.`,
        tone: "error",
      });
    } finally {
      setIsReplacingPart(false);
    }
  }

  async function handleFixWarning(warning: CompatibilityWarningModel) {
    if (!build) {
      return;
    }

    const category = getWarningTargetCategory(warning);
    const recommendedPart = getRecommendedReplacementForWarning(build, warning);

    if (!category) {
      setToast({
        message: "This warning does not have an automatic compare target yet.",
        tone: "error",
      });
      return;
    }

    await openCompare(category, recommendedPart?.id ?? null);
  }

  async function handleChatSend(rawMessage: string) {
    const message = rawMessage.trim();

    if (!message || isGeneratingRecommendation) {
      return;
    }

    const userMessage: ChatMessage = {
      id: createMessageId(),
      role: "user",
      text: message,
    };

    setChatMessages((current) => [...current, userMessage]);
    setChatInput("");

    setIsGeneratingRecommendation(true);
    setDetailsError(null);

    try {
      const advisorResponse = await askAdvisor({
        message,
        currentBuild: build,
        collectedNeeds: customerNeeds,
        plan,
        usageStatus,
      });

      setUsageStatus(advisorResponse.usage);
      setShowUsageUpgrade(Boolean(advisorResponse.upgradeRequired));
      setChatMessages((current) => [
        ...current,
        {
          id: createMessageId(),
          role: "assistant",
          text: advisorResponse.assistantMessage,
        },
      ]);

      if (!advisorResponse.usageConsumed) {
        return;
      }

      if (hasExtractedNeeds(advisorResponse.extractedNeeds)) {
        const mergedNeeds = mergeCustomerNeeds(customerNeeds, advisorResponse.extractedNeeds ?? {});
        setCustomerNeeds(mergedNeeds);
        setIsLoadingDetails(true);

        const nextState = await refreshBuildAndDetails(mergedNeeds);
        setBuild(nextState.build);
        setCartPreview(nextState.cartPreview);
        setEmployeeSummary(nextState.employeeSummary);
        handleDrawerOpenChange(false);
      }
    } catch {
      setDetailsError(
        "The advisor could not complete the request. The previous build is still shown.",
      );
      setToast({
        message: "Could not reach the advisor right now. Please try again.",
        tone: "error",
      });
      setChatMessages((current) => [
        ...current,
        {
          id: createMessageId(),
          role: "assistant",
          text: "I could not reach the advisor service this time. Your current build is unchanged, and compatibility checks remain available.",
        },
      ]);
    } finally {
      setIsGeneratingRecommendation(false);
      setIsLoadingDetails(false);
    }
  }

  async function handleAffiliateClick(
    item: CartPreviewItemModel,
    link: NonNullable<CartPreviewItemModel["affiliateLinks"]>[number],
  ) {
    await trackAffiliateClick({
      partId: item.partId,
      merchant: link.merchant,
      url: link.url,
      buildId: build?.id,
    });
    window.open(link.url, "_blank", "noopener,noreferrer");
  }

  function renderWarningActions(warning: CompatibilityWarningModel) {
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
              Review options
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

  function toggleWarningDetails(id: string) {
    setExpandedWarningIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
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
                  <Sparkles className="mr-1 size-3" /> AI-ready build advisor
                </Badge>
                <h1 className="text-3xl font-bold tracking-tight">Live Build Recommendation</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Compare parts, replace components, and watch pricing, compatibility, and purchase
                  references update from local mock data.
                </p>
              </div>

              {isLoadingBuild && (
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm text-muted-foreground">
                  <LoaderCircle className="size-4 animate-spin" />
                  Loading recommended build
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <UsageBadge usage={usageStatus} />
                <Button
                  size="sm"
                  variant="secondary"
                  className="rounded-md"
                  onClick={() => void handleResetMonetization()}
                >
                  Reset mock access
                </Button>
              </div>
            </div>

            {buildError ? (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6">
                <h2 className="text-lg font-bold text-destructive">Build could not be loaded</h2>
                <p className="mt-2 text-sm text-destructive/90">{buildError}</p>
              </div>
            ) : build ? (
              <>
                  <section className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Sparkles className="size-4 text-primary" />
                        <h2 className="text-lg font-bold text-primary">Your Build Needs</h2>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Collected from the guided advisor chat on the right.
                      </p>
                    </div>
                    {isGeneratingRecommendation && (
                      <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background/70 px-3 py-1 text-xs text-muted-foreground">
                        <LoaderCircle className="size-3.5 animate-spin" />
                        Recommending
                      </div>
                    )}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <NeedsCard
                      label="Budget"
                      value={
                        customerNeeds.budget
                          ? `$${customerNeeds.budget.toLocaleString()}`
                          : "Still collecting"
                      }
                    />
                    <NeedsCard label="Use case" value={formatNeedsList(customerNeeds.targetUseCase)} />
                    <NeedsCard
                      label="Appearance"
                      value={formatAppearancePreference(customerNeeds.appearancePreference)}
                    />
                    <NeedsCard
                      label="Experience"
                      value={formatExperienceLevel(customerNeeds.experienceLevel)}
                    />
                    <NeedsCard label="Brand preference" value={formatBrandPreference(customerNeeds)} />
                  </div>
                </section>

                {showUsageUpgrade && (
                  <UpgradeCard
                    onUpgraded={() => void refreshMonetizationState()}
                    className="border-warning/25 bg-warning/10"
                  />
                )}

                <BuildCard
                  build={build}
                  focusedCategory={compareCategory ?? undefined}
                  onFocus={(category) => void openCompare(category)}
                  onCompare={(category) => void openCompare(category)}
                />

                {detailsError && (
                  <div className="rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
                    {detailsError}
                  </div>
                )}

                <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                  {build.compatibilityWarnings.length === 0 ? (
                    <section className="rounded-2xl border border-success/20 bg-success/10 p-4">
                      <div className="flex items-center gap-3 text-success">
                        <ShieldCheck className="size-5" />
                        <div>
                          <h2 className="text-base font-bold">Compatibility checks passed</h2>
                          <p className="text-sm">No rule-based issues found in the current build.</p>
                        </div>
                      </div>
                    </section>
                  ) : (
                    <section className="rounded-2xl border border-border bg-card p-4">
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="size-4 text-warning" />
                          <h2 className="text-lg font-bold">Compatibility needs review</h2>
                        </div>
                        <Badge className="bg-warning/15 text-warning">
                          {build.compatibilityWarnings.length} item{build.compatibilityWarnings.length === 1 ? "" : "s"}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        {build.compatibilityWarnings.map((warning) => {
                          const expanded = expandedWarningIds.has(warning.id);
                          const affectedNames = warning.affectedPartIds
                            .map((partId) => build.parts.find((part) => part.id === partId)?.displayName)
                            .filter(Boolean)
                            .join(" + ");

                          return (
                            <div key={warning.id} className="rounded-xl border border-border bg-background/60 p-3">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge
                                      className={
                                        warning.severity === "error"
                                          ? "bg-destructive/15 text-destructive"
                                          : "bg-warning/15 text-warning"
                                      }
                                    >
                                      {warning.severity === "error" ? "Needs review" : "Warning"}
                                    </Badge>
                                    {affectedNames && (
                                      <span className="truncate text-sm text-muted-foreground">
                                        {affectedNames}
                                      </span>
                                    )}
                                  </div>
                                  <p className="mt-1 text-sm font-medium">{warning.message}</p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="rounded-md"
                                  onClick={() => toggleWarningDetails(warning.id)}
                                >
                                  View details <ChevronDown className={`ml-1 size-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
                                </Button>
                              </div>
                              {expanded && (
                                <div className="mt-3 border-t border-border pt-3">
                                  {warning.suggestedFix && (
                                    <p className="text-sm text-muted-foreground">
                                      Suggested fix: {warning.suggestedFix}
                                    </p>
                                  )}
                                  {renderWarningActions(warning)}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}

                  <section className="rounded-2xl border border-primary/20 bg-primary/5 p-6">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <ShoppingBag className="size-4 text-primary" />
                        <h2 className="text-xl font-bold text-primary">Recommendation Summary</h2>
                      </div>
                      {isLoadingDetails && (
                        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background/70 px-3 py-1 text-xs text-muted-foreground">
                          <LoaderCircle className="size-3.5 animate-spin" />
                          Refreshing
                        </div>
                      )}
                    </div>

                    {employeeSummary ? (
                      <div className="space-y-4 text-sm">
                        <SummaryBlock label="Build goal" value={employeeSummary.customerGoal} />
                        <SummaryBlock
                          label="Recommendation logic"
                          value={employeeSummary.recommendedBuildLogic}
                        />
                        <SummaryList
                          label="Why these parts fit"
                          values={employeeSummary.keySellingPoints}
                        />
                        <SummaryBlock
                          label="Cheaper alternative"
                          value={employeeSummary.cheaperAlternative}
                        />
                        <SummaryBlock label="Upgrade option" value={employeeSummary.upsellOption} />
                        <SummaryBlock
                          label="Compatibility status"
                          value={employeeSummary.compatibilityStatus}
                        />
                        <SummaryBlock
                          label="Purchase reference status"
                          value={employeeSummary.preCartStatus}
                        />
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-primary/15 bg-background/60 p-4 text-sm text-muted-foreground">
                        {isLoadingDetails
                          ? "Refreshing the recommendation summary..."
                          : "Recommendation summary will appear after the build finishes loading."}
                      </div>
                    )}
                  </section>
                </div>

                <section className="rounded-2xl border border-border bg-card p-6">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <ClipboardList className="size-4 text-primary" />
                        <h2 className="text-xl font-bold">Purchase Reference List</h2>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Mock retailer references only. No checkout, payment, or live stock integration yet.
                      </p>
                    </div>
                    <AffiliateDisclosure />
                    <div className="flex items-center gap-2">
                      {isLoadingDetails && (
                        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
                          <LoaderCircle className="size-3.5 animate-spin" />
                          Syncing
                        </div>
                      )}
                      <Badge variant="secondary" className="rounded-md">
                        {cartPreview.length} items
                      </Badge>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-border">
                    {isLoadingDetails && cartPreview.length === 0 ? (
                      <div className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
                        <LoaderCircle className="size-4 animate-spin" />
                        Loading purchase references
                      </div>
                    ) : cartPreview.length === 0 ? (
                      <div className="p-5 text-sm text-muted-foreground">
                        Purchase references will populate as soon as the mock build is ready.
                      </div>
                    ) : (
                      <table className="w-full text-left text-sm">
                        <thead className="bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
                          <tr>
                            <th className="px-4 py-3 font-medium">Part</th>
                            <th className="px-4 py-3 font-medium">Retailer</th>
                            <th className="px-4 py-3 font-medium">Note</th>
                            <th className="px-4 py-3 text-right font-medium">Price</th>
                            <th className="px-4 py-3 text-right font-medium">Deal</th>
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
                              <td className="px-4 py-3 text-right">
                                {(item.affiliateLinks ?? []).slice(0, 1).map((link) => (
                                  <Button
                                    key={`${item.partId}-${link.merchant}`}
                                    size="sm"
                                    variant="secondary"
                                    className="rounded-md"
                                    onClick={() => void handleAffiliateClick(item, link)}
                                  >
                                    {link.label ?? "Check price"}
                                  </Button>
                                ))}
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-background/70">
                            <td colSpan={4} className="px-4 py-3 text-right font-semibold">
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

                <section className="rounded-2xl border border-border bg-card p-6">
                  <div className="mb-4 flex items-center gap-2">
                    <ClipboardList className="size-4 text-primary" />
                    <h2 className="text-xl font-bold">Purchase Checklist</h2>
                  </div>
                  {hasPurchaseChecklist ? (
                    <ul className="grid gap-2 md:grid-cols-2">
                      {PRO_PURCHASE_CHECKLIST.map((item) => (
                        <li
                          key={item}
                          className="flex items-center gap-3 rounded-xl border border-border bg-background/60 p-3 text-sm"
                        >
                          <CheckCircle2 className="size-4 shrink-0 text-success" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                      <div className="grid gap-2 md:grid-cols-2">
                        {PRO_PURCHASE_CHECKLIST.slice(0, 4).map((item) => (
                          <div
                            key={item}
                            className="rounded-xl border border-border bg-background/40 p-3 text-sm text-muted-foreground"
                          >
                            {item}
                          </div>
                        ))}
                      </div>
                      <ProFeatureLock
                        feature="purchase_checklist"
                        label="Full purchase checklist"
                        onUpgraded={() => void refreshMonetizationState()}
                      />
                    </div>
                  )}
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

        <ChatPanel
          className="shrink-0"
          input={chatInput}
          isGenerating={isGeneratingRecommendation}
          messages={chatMessages}
          quickReplies={QUICK_REPLIES}
          usageSlot={<UsageBadge usage={usageStatus} />}
          limitSlot={
            showUsageUpgrade ? (
              <UpgradeCard compact onUpgraded={() => void refreshMonetizationState()} />
            ) : undefined
          }
          onInputChange={setChatInput}
          onSend={(value) => void handleChatSend(value)}
        />
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
          plan={plan}
          usageStatus={usageStatus}
          onUpgraded={() => void refreshMonetizationState()}
          onOpenChange={handleDrawerOpenChange}
          onReplace={(part) => void handleReplacePart(part)}
        />
      )}

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <div
            className={`pointer-events-auto flex items-center gap-3 rounded-xl px-4 py-3 text-sm shadow-glow backdrop-blur ${
              toast.tone === "error"
                ? "border border-destructive/30 bg-destructive/10 text-destructive"
                : "border border-primary/30 bg-card/95"
            }`}
          >
            {toast.tone === "error" ? (
              <AlertTriangle className="size-4" />
            ) : (
              <CheckCircle2 className="size-4 text-primary" />
            )}
            <span>{toast.message}</span>
            <Button variant="ghost" size="sm" className="rounded-md" onClick={() => setToast(null)}>
              Dismiss
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function NeedsCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-primary/15 bg-background/60 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm leading-relaxed">{value}</p>
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

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { BuildCard } from "@/components/build-card";
import { ChatPanel, type ChatMessage } from "@/components/chat-panel";
import { ComparePanel } from "@/components/compare-drawer";
import { TopBar } from "@/components/top-bar";
import { AffiliateDisclosure } from "@/components/AffiliateDisclosure";
import { ProFeatureLock } from "@/components/ProFeatureLock";
import { PostBuildFeedbackForm } from "@/components/post-build-feedback-form";
import { UpgradeCard } from "@/components/UpgradeCard";
import { UsageBadge } from "@/components/UsageBadge";
import { categoryLabels } from "@/data/seedParts";
import {
  askAdvisor,
  deleteSavedBuild,
  getAuthSession,
  getEntitlementStatus,
  getCartPreview,
  getCompareParts,
  getSavedBuild,
  getSavedBuilds,
  getPartsByCategory,
  getRecommendedBuild,
  getRecommendedReplacementForWarning,
  getUsageStatus,
  consumeReplacementUsage,
  resetMockMonetizationState,
  replaceBuildPart,
  saveCurrentBuild,
  savePostBuildFeedback,
  signIn,
  signOut,
  trackAffiliateClick,
  ApiClientError,
} from "@/lib/apiClient";
import { canUseFeature, getPlanForEntitlement } from "@/lib/monetization";
import { mergeCustomerNeeds } from "@/lib/needParser";
import { getDynamicSubstitutionSuggestions } from "@/lib/substitution-engine";
import type { ActiveCompareContext, AdvisorSuggestedAction } from "@/lib/ai/types";
import type { CustomerNeeds, RecommendedBuildInput } from "@/types/api";
import type {
  Build as BuildModel,
  CartPreviewItem as CartPreviewItemModel,
  CompatibilityWarning as CompatibilityWarningModel,
  PostBuildFeedbackInput,
  SavedBuildSummary,
  StoreEmployeeSummary as StoreEmployeeSummaryModel,
} from "@/types/build";
import type { Entitlement, UsageStatus } from "@/types/monetization";
import type { AuthSession } from "@/lib/persistence/types";
import type { Part, PartCategory } from "@/types/parts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ArrowRightLeft,
  ChevronDown,
  CheckCircle2,
  ClipboardList,
  Copy,
  Download,
  FileJson,
  FolderOpen,
  LoaderCircle,
  Save,
  ShieldCheck,
  Sparkles,
  ShoppingBag,
  Trash2,
  Wrench,
} from "lucide-react";

const DEFAULT_RECOMMENDATION_INPUT: RecommendedBuildInput = {
  budget: 2500,
  targetUseCase: ["4K video editing", "casual gaming"],
};

const QUICK_REPLIES = [
  "Build me a $1500 gaming PC for 1080p/1440p.",
  "I want a $2000 1440p high refresh gaming PC.",
  "I want a white aesthetic PC build.",
  "Should I upgrade from a 5070 Ti to a 5080?",
  "Give me a cheaper alternative without losing too much performance.",
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

const AI_LIMIT_UPGRADE_COPY =
  "You have used the Free advisor questions for today. Your build is still here, and Build Pro unlocks 50 AI questions per build.";
const REPLACEMENT_LIMIT_UPGRADE_COPY =
  "You have used the Free hardware replacements for this build. Build Pro unlocks 25 replacements so you can keep tuning parts.";
const SAVED_BUILD_LIMIT_UPGRADE_COPY =
  "Your Free saved build slot is full. Build Pro unlocks up to 10 saved builds plus full export.";

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

function normalizeCategory(category: string): PartCategory {
  return category.toLowerCase() as PartCategory;
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

  if (
    warning.id === "air-cooler-height" ||
    warning.id === "aio-radiator-fit" ||
    warning.id === "cooler-case-fit" ||
    warning.id === "cooler-socket-support"
  ) {
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
  const followUp = !needs.budget
    ? "A budget range would help tighten the rest of the parts."
    : !needs.targetUseCase || needs.targetUseCase.length === 0
      ? "Tell me the main workload next so I can tune the GPU and CPU balance."
      : !needs.experienceLevel
        ? "If you want, tell me whether you're a beginner or more advanced and I'll tune how aggressive the recommendation should be."
        : "You can still open the AI-assisted compare panel on any part to review alternatives.";

  return `Noted ${responseBits.join(", ")}. I refreshed the recommendation around ${cpu?.displayName ?? "the selected CPU"} and ${gpu?.displayName ?? "the selected GPU"}. ${followUp}`;
}

function formatMoney(value: number) {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatCompatibilityStatus(status: BuildModel["compatibilityStatus"]) {
  if (status === "pass") {
    return "Ready";
  }

  return "Needs review";
}

function formatFeedbackDifficulty(
  value: NonNullable<SavedBuildSummary["feedbackSummary"]>["beginnerDifficulty"],
) {
  const labels: Record<typeof value, string> = {
    easy: "Easy",
    manageable: "Manageable",
    hard: "Hard",
    not_sure: "Not sure",
  };

  return labels[value];
}

function createBuildExportText({
  build,
  buildNeeds,
  cartPreview,
}: {
  build: BuildModel;
  buildNeeds: CustomerNeeds;
  cartPreview: CartPreviewItemModel[];
}) {
  const lines = [
    `# ${build.name}`,
    "",
    `Estimated total: ${formatMoney(build.totalPrice)}`,
    `Compatibility: ${formatCompatibilityStatus(build.compatibilityStatus)}`,
    `Build confidence: ${build.confidenceScore.score}/100 (${build.confidenceScore.label})`,
    `Target use case: ${build.targetUseCase.join(" + ") || "Not specified"}`,
    `Budget: ${buildNeeds.budget ? formatMoney(buildNeeds.budget) : "Still collecting"}`,
    `Appearance: ${formatAppearancePreference(buildNeeds.appearancePreference)}`,
    `Experience: ${formatExperienceLevel(buildNeeds.experienceLevel)}`,
    `Brand preference: ${formatBrandPreference(buildNeeds)}`,
    "",
    "## Parts",
    ...build.parts.map((part) => {
      const price = part.owned ? "$0 - Already owned" : formatMoney(part.price);
      return `- ${part.category.toUpperCase()}: ${part.displayName} (${price})`;
    }),
    "",
    "## Compatibility Checks",
    ...build.compatibilityChecks.map(
      (check) => `- ${check.severity.toUpperCase()}: ${check.label} - ${check.message}`,
    ),
    "",
    "## Purchase References",
    ...cartPreview.map((item) => {
      const price = item.estimatedPrice === 0 ? "$0" : formatMoney(item.estimatedPrice);
      return `- ${item.displayName}: ${price} at ${item.retailer}. ${item.note ?? ""}`.trim();
    }),
    "",
    "Some links may earn us a commission at no extra cost to you.",
  ];

  return lines.join("\n");
}

function downloadTextFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
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
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [isLoadingBuild, setIsLoadingBuild] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isLoadingCompare, setIsLoadingCompare] = useState(false);
  const [isReplacingPart, setIsReplacingPart] = useState(false);
  const [isGeneratingRecommendation, setIsGeneratingRecommendation] = useState(false);
  const [customerNeeds, setCustomerNeeds] = useState<CustomerNeeds>({});
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(INITIAL_CHAT_MESSAGES);
  const [chatInput, setChatInput] = useState("");
  const [toast, setToast] = useState<{
    message: string;
    tone: "success" | "error" | "notice";
  } | null>(null);
  const [usageStatus, setUsageStatus] = useState<UsageStatus | null>(null);
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [showUsageUpgrade, setShowUsageUpgrade] = useState(false);
  const [expandedWarningIds, setExpandedWarningIds] = useState<Set<string>>(new Set());
  const [advisorUpdatedFields, setAdvisorUpdatedFields] = useState<Set<keyof CustomerNeeds>>(
    new Set(),
  );
  const [openOwnedPartForm, setOpenOwnedPartForm] = useState(false);
  const [ownedPartHint, setOwnedPartHint] = useState<string | null>(null);
  const [savedBuilds, setSavedBuilds] = useState<SavedBuildSummary[]>([]);
  const [savedBuildLimit, setSavedBuildLimit] = useState(1);
  const [isSavedBuildsOpen, setIsSavedBuildsOpen] = useState(false);
  const [isLoadingSavedBuilds, setIsLoadingSavedBuilds] = useState(false);
  const [isSavingBuild, setIsSavingBuild] = useState(false);
  const [saveBuildName, setSaveBuildName] = useState("");
  const [currentSavedBuildId, setCurrentSavedBuildId] = useState<string | null>(null);
  const [currentFeedbackSummary, setCurrentFeedbackSummary] =
    useState<SavedBuildSummary["feedbackSummary"]>();
  const [feedbackTarget, setFeedbackTarget] = useState<{ id: string; name: string } | null>(null);
  const [isSavingFeedback, setIsSavingFeedback] = useState(false);
  const plan = getPlanForEntitlement(entitlement);
  const hasPurchaseChecklist = canUseFeature(plan, "purchase_checklist");
  const hasFullExport = canUseFeature(plan, "build_export");
  const substitutionSuggestions = useMemo(
    () => (build ? getDynamicSubstitutionSuggestions(build) : []),
    [build],
  );
  const activeCompareContext = useMemo<ActiveCompareContext | null>(() => {
    if (!isCompareOpen || !build || !compareCategory) {
      return null;
    }

    const currentPart = build.parts.find((part) => part.category === compareCategory);

    if (!currentPart) {
      return null;
    }

    return {
      category: currentPart.category,
      currentPart,
      candidateParts: compareParts.filter((part) => part.category === currentPart.category),
      budget: customerNeeds.budget ?? build.budget,
      buildTotal: build.totalPrice,
    };
  }, [build, compareCategory, compareParts, customerNeeds.budget, isCompareOpen]);

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
        setCurrentSavedBuildId(null);
        setCurrentFeedbackSummary(undefined);
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

          setDetailsError(
            "The purchase references and recommendation summary could not be loaded from the mock API.",
          );
        } finally {
          if (active) {
            setIsLoadingDetails(false);
          }
        }
      } catch {
        if (!active) {
          return;
        }

        setBuildError(
          "The internal recommendation API could not be loaded. Please refresh and try again.",
        );
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
    void refreshAuthState();
    void refreshMonetizationState();
  }, []);

  useEffect(() => {
    if (build && !saveBuildName.trim()) {
      setSaveBuildName(build.name);
    }
  }, [build, saveBuildName]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function handleCompareOpenChange(open: boolean) {
    setIsCompareOpen(open);

    if (!open) {
      setCompareCategory(null);
      setCompareParts([]);
      setCompareError(null);
      setRecommendedReplacementId(null);
      setOpenOwnedPartForm(false);
      setOwnedPartHint(null);
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
        userId: "mock-guest-session",
        plan: "free",
        active: true,
        startedAt: new Date().toISOString(),
      });
    }
  }

  async function refreshAuthState() {
    try {
      setAuthSession(await getAuthSession());
    } catch {
      setAuthSession({
        status: "guest",
        sessionId: "mock-guest-session",
        userId: "mock-guest-session",
        isMock: true,
      });
    }
  }

  async function handleSignIn() {
    const email = window.prompt("Email for local mock sign in")?.trim();

    if (!email) {
      return;
    }

    try {
      const session = await signIn({ email, password: "local-mock-password" });
      setAuthSession(session);
      await refreshMonetizationState();
      await refreshSavedBuilds();
      setToast({ message: `Signed in as ${session.user?.email ?? email}.`, tone: "success" });
    } catch {
      setToast({ message: "Could not sign in right now.", tone: "error" });
    }
  }

  async function handleSignOut() {
    try {
      const result = await signOut();
      setAuthSession(result.session);
      await refreshMonetizationState();
      await refreshSavedBuilds();
      setToast({ message: result.message, tone: "success" });
    } catch {
      setToast({ message: "Could not sign out right now.", tone: "error" });
    }
  }

  async function handleResetMonetization() {
    try {
      const result = await resetMockMonetizationState();
      setEntitlement(result.entitlement);
      setUsageStatus(result.usage);
      setSavedBuilds([]);
      setSavedBuildLimit(1);
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

  async function refreshSavedBuilds() {
    setIsLoadingSavedBuilds(true);

    try {
      const result = await getSavedBuilds();
      setSavedBuilds(result.builds);
      setSavedBuildLimit(result.limit);
    } catch {
      setToast({ message: "Could not load saved builds right now.", tone: "error" });
    } finally {
      setIsLoadingSavedBuilds(false);
    }
  }

  function handleOpenSavedBuilds() {
    setIsSavedBuildsOpen(true);
    void refreshSavedBuilds();
  }

  async function handleSaveBuild(id?: string, overrideName?: string) {
    if (!build) {
      return;
    }

    const name = (overrideName ?? saveBuildName).trim() || build.name;
    setIsSavingBuild(true);

    try {
      const result = await saveCurrentBuild({
        id,
        name,
        build,
        buildNeeds: customerNeeds,
      });
      setSavedBuilds(result.builds);
      setSavedBuildLimit(result.limit);
      setSaveBuildName(result.savedBuild.name);
      setCurrentSavedBuildId(result.savedBuild.id);
      setCurrentFeedbackSummary(result.savedBuild.feedbackSummary);
      setToast({ message: `"${result.savedBuild.name}" saved.`, tone: "success" });
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 403) {
        setShowUsageUpgrade(true);
        setToast({
          message: SAVED_BUILD_LIMIT_UPGRADE_COPY,
          tone: "notice",
        });
      } else {
        setToast({ message: "Could not save this build right now.", tone: "error" });
      }
    } finally {
      setIsSavingBuild(false);
    }
  }

  async function handleLoadSavedBuild(id: string) {
    setIsLoadingSavedBuilds(true);

    try {
      const savedBuild = await getSavedBuild(id);
      const preview = await getCartPreview(savedBuild.build);
      setBuild(savedBuild.build);
      setCustomerNeeds(savedBuild.buildNeeds);
      setCartPreview(preview.items);
      setEmployeeSummary(preview.employeeSummary);
      setSaveBuildName(savedBuild.name);
      setCurrentSavedBuildId(savedBuild.id);
      setCurrentFeedbackSummary(savedBuild.feedbackSummary);
      setIsSavedBuildsOpen(false);
      handleCompareOpenChange(false);
      setToast({ message: `"${savedBuild.name}" loaded.`, tone: "success" });
    } catch {
      setToast({ message: "Could not load that saved build.", tone: "error" });
    } finally {
      setIsLoadingSavedBuilds(false);
    }
  }

  async function handleDeleteSavedBuild(id: string) {
    try {
      const result = await deleteSavedBuild(id);
      setSavedBuilds(result.builds);
      setSavedBuildLimit(result.limit);
      if (currentSavedBuildId === id) {
        setCurrentSavedBuildId(null);
        setCurrentFeedbackSummary(undefined);
      }
      setToast({ message: "Saved build deleted.", tone: "success" });
    } catch {
      setToast({ message: "Could not delete that saved build.", tone: "error" });
    }
  }

  async function handleRenameSavedBuild(summary: SavedBuildSummary) {
    const nextName = window.prompt("Rename saved build", summary.name)?.trim();

    if (!nextName || nextName === summary.name) {
      return;
    }

    try {
      const savedBuild = await getSavedBuild(summary.id);
      const result = await saveCurrentBuild({
        id: savedBuild.id,
        name: nextName,
        build: savedBuild.build,
        buildNeeds: savedBuild.buildNeeds,
      });
      setSavedBuilds(result.builds);
      setSavedBuildLimit(result.limit);
      if (currentSavedBuildId === savedBuild.id) {
        setSaveBuildName(result.savedBuild.name);
        setCurrentFeedbackSummary(result.savedBuild.feedbackSummary);
      }
      setToast({ message: "Saved build renamed.", tone: "success" });
    } catch {
      setToast({ message: "Could not rename that saved build.", tone: "error" });
    }
  }

  async function handleOpenFeedbackForCurrentBuild() {
    if (!build) {
      return;
    }

    if (currentSavedBuildId) {
      setFeedbackTarget({ id: currentSavedBuildId, name: saveBuildName || build.name });
      return;
    }

    const name = saveBuildName.trim() || build.name;
    setIsSavingBuild(true);

    try {
      const result = await saveCurrentBuild({
        name,
        build,
        buildNeeds: customerNeeds,
      });
      setSavedBuilds(result.builds);
      setSavedBuildLimit(result.limit);
      setSaveBuildName(result.savedBuild.name);
      setCurrentSavedBuildId(result.savedBuild.id);
      setCurrentFeedbackSummary(result.savedBuild.feedbackSummary);
      setFeedbackTarget({ id: result.savedBuild.id, name: result.savedBuild.name });
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 403) {
        setShowUsageUpgrade(true);
        setToast({ message: SAVED_BUILD_LIMIT_UPGRADE_COPY, tone: "notice" });
      } else {
        setToast({ message: "Save this build before reporting a build result.", tone: "error" });
      }
    } finally {
      setIsSavingBuild(false);
    }
  }

  function handleOpenFeedbackForSavedBuild(summary: SavedBuildSummary) {
    setFeedbackTarget({ id: summary.id, name: summary.name });
  }

  async function handleSubmitPostBuildFeedback(feedback: PostBuildFeedbackInput) {
    setIsSavingFeedback(true);

    try {
      const result = await savePostBuildFeedback(feedback);
      setSavedBuilds(result.builds);
      setSavedBuildLimit(result.limit);
      if (currentSavedBuildId === result.savedBuild.id) {
        setCurrentFeedbackSummary(result.savedBuild.feedbackSummary);
      }
      setFeedbackTarget(null);
      setToast({ message: "Build result saved.", tone: "success" });
    } catch {
      setToast({ message: "Could not save build feedback right now.", tone: "error" });
    } finally {
      setIsSavingFeedback(false);
    }
  }

  async function handleCopyExport() {
    if (!build) {
      return;
    }

    const content = createBuildExportText({ build, buildNeeds: customerNeeds, cartPreview });

    try {
      await navigator.clipboard.writeText(content);
      setToast({ message: "Build summary copied.", tone: "success" });
    } catch {
      setToast({ message: "Clipboard copy was blocked by the browser.", tone: "error" });
    }
  }

  function handleDownloadJson() {
    if (!build) {
      return;
    }

    downloadTextFile(
      `${build.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "pc-build"}.json`,
      JSON.stringify(
        { build, buildNeeds: customerNeeds, purchaseReferences: cartPreview },
        null,
        2,
      ),
      "application/json",
    );
  }

  function handleDownloadMarkdown() {
    if (!build) {
      return;
    }

    downloadTextFile(
      `${build.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "pc-build"}.md`,
      createBuildExportText({ build, buildNeeds: customerNeeds, cartPreview }),
      "text/markdown",
    );
  }

  async function openCompare(category: string, nextRecommendedReplacementId?: string | null) {
    const normalizedCategory = normalizeCategory(category);

    setCompareCategory(normalizedCategory);
    setCompareError(null);
    setCompareParts([]);
    setRecommendedReplacementId(nextRecommendedReplacementId ?? null);
    setIsCompareOpen(true);
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

    if (usageStatus && !usageStatus.canReplacePart) {
      setShowUsageUpgrade(true);
      setToast({
        message: REPLACEMENT_LIMIT_UPGRADE_COPY,
        tone: "notice",
      });
      return;
    }

    setIsReplacingPart(true);
    setDetailsError(null);

    try {
      const nextState = await replaceBuildPart(build, part);
      const replacementUsage = await consumeReplacementUsage();
      setUsageStatus(replacementUsage.usage);

      if (!replacementUsage.consumed) {
        setShowUsageUpgrade(true);
        setToast({
          message: replacementUsage.message ?? REPLACEMENT_LIMIT_UPGRADE_COPY,
          tone: "notice",
        });
        return;
      }

      setBuild(nextState.build);
      setCartPreview(nextState.cartPreview);
      setEmployeeSummary(nextState.employeeSummary);
      setCurrentSavedBuildId(null);
      setCurrentFeedbackSummary(undefined);
      handleCompareOpenChange(false);
      const budgetDelta = nextState.build.budget - nextState.build.totalPrice;
      const budgetSummary =
        budgetDelta >= 0
          ? `$${Math.abs(budgetDelta).toLocaleString()} under budget`
          : `$${Math.abs(budgetDelta).toLocaleString()} over budget`;
      const compatibilitySummary =
        nextState.build.compatibilityStatus === "pass"
          ? "Compatibility checks pass."
          : nextState.build.compatibilityStatus === "warning"
            ? `${nextState.build.compatibilityWarnings.length} compatibility note${nextState.build.compatibilityWarnings.length === 1 ? "" : "s"} need review.`
            : `${nextState.build.confidenceScore.failCount} blocking compatibility issue${nextState.build.confidenceScore.failCount === 1 ? "" : "s"} must be fixed.`;
      const nextAction =
        nextState.build.compatibilityStatus === "pass"
          ? "Next: review the shopping list."
          : "Next: review the compatibility notes.";
      const replacementSummary = `New total $${nextState.build.totalPrice.toLocaleString()}, ${budgetSummary}. ${compatibilitySummary} ${nextAction}`;
      setToast({
        message: `${successMessage ?? `Replaced ${categoryLabels[part.category]} with ${part.displayName}.`} ${replacementSummary}`,
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
        conversationHistory: chatMessages
          .filter(
            (chatMessage) => chatMessage.role === "user" || chatMessage.id !== "assistant-welcome",
          )
          .slice(-8)
          .map((chatMessage) => ({
            role: chatMessage.role,
            text: chatMessage.text,
          })),
        currentBuild: build,
        collectedNeeds: customerNeeds,
        activeCompare: activeCompareContext,
        plan,
        usageStatus,
      });

      setUsageStatus(advisorResponse.usage);
      setShowUsageUpgrade(Boolean(advisorResponse.upgradeRequired));
      if (advisorResponse.upgradeRequired) {
        setToast({
          message: AI_LIMIT_UPGRADE_COPY,
          tone: "notice",
        });
      }
      setChatMessages((current) => [
        ...current,
        {
          id: createMessageId(),
          role: "assistant",
          text: advisorResponse.assistantMessage,
          actions: advisorResponse.suggestedActions,
          warnings: advisorResponse.warnings,
          fallbackUsed: advisorResponse.fallbackUsed,
        },
      ]);

      if (!advisorResponse.usageConsumed) {
        return;
      }
    } catch {
      setDetailsError(
        "Advisor request failed. The current build is still available, and compare, replacement, and shopping-list tools remain usable.",
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
          text: "I could not reach the advisor service this time. Your current build is unchanged, and compatibility checks remain available. Try one of the demo prompts again in a moment.",
        },
      ]);
    } finally {
      setIsGeneratingRecommendation(false);
      setIsLoadingDetails(false);
    }
  }

  async function applyAdvisorNeedsUpdate(
    nextNeeds: CustomerNeeds,
    updatedFields: Array<keyof CustomerNeeds>,
  ) {
    const mergedNeeds = mergeCustomerNeeds(customerNeeds, nextNeeds);
    setCustomerNeeds(mergedNeeds);
    setAdvisorUpdatedFields((current) => {
      const next = new Set(current);
      updatedFields.forEach((field) => next.add(field));
      return next;
    });
    setIsLoadingDetails(true);

    try {
      const nextState = await refreshBuildAndDetails(mergedNeeds);
      setBuild(nextState.build);
      setCartPreview(nextState.cartPreview);
      setEmployeeSummary(nextState.employeeSummary);
      setCurrentSavedBuildId(null);
      setCurrentFeedbackSummary(undefined);
      handleCompareOpenChange(false);
      setToast({ message: "Build needs updated from advisor action.", tone: "success" });
    } catch {
      setDetailsError(
        "The build needs were updated, but the recommendation could not refresh right now.",
      );
      setToast({ message: "Could not refresh the build after updating needs.", tone: "error" });
    } finally {
      setIsLoadingDetails(false);
    }
  }

  async function handleAdvisorAction(action: AdvisorSuggestedAction) {
    switch (action.type) {
      case "update_budget":
        await applyAdvisorNeedsUpdate({ budget: action.budget }, ["budget"]);
        return;
      case "update_use_case":
        await applyAdvisorNeedsUpdate({ targetUseCase: action.targetUseCase }, ["targetUseCase"]);
        return;
      case "update_appearance":
        await applyAdvisorNeedsUpdate({ appearancePreference: action.appearancePreference }, [
          "appearancePreference",
        ]);
        return;
      case "update_brand_preference":
        await applyAdvisorNeedsUpdate(
          {
            ...(action.cpuBrandPreference ? { cpuBrandPreference: action.cpuBrandPreference } : {}),
            ...(action.gpuBrandPreference ? { gpuBrandPreference: action.gpuBrandPreference } : {}),
          },
          [
            ...(action.cpuBrandPreference ? (["cpuBrandPreference"] as const) : []),
            ...(action.gpuBrandPreference ? (["gpuBrandPreference"] as const) : []),
          ],
        );
        return;
      case "update_experience_level":
        await applyAdvisorNeedsUpdate({ experienceLevel: action.experienceLevel }, [
          "experienceLevel",
        ]);
        return;
      case "add_owned_part": {
        const category = action.category ?? "gpu";
        setOpenOwnedPartForm(true);
        setOwnedPartHint(action.partHint ?? categoryLabels[category]);
        await openCompare(category);
        return;
      }
      case "open_part_explorer":
        setOpenOwnedPartForm(false);
        setOwnedPartHint(null);
        await openCompare(action.category);
        return;
      case "explain_current_build": {
        const partSummary = build
          ? build.parts
              .slice(0, 4)
              .map((part) => `${categoryLabels[part.category]}: ${part.displayName}`)
              .join(". ")
          : "The build is still loading.";
        setChatMessages((current) => [
          ...current,
          {
            id: createMessageId(),
            role: "assistant",
            text: `${build?.name ?? "Current build"} is at ${build ? `$${build.totalPrice.toLocaleString()}` : "the current budget"}. ${partSummary}. Compatibility remains checked by local rules.`,
          },
        ]);
        return;
      }
      case "ask_clarifying_question":
        setChatMessages((current) => [
          ...current,
          {
            id: createMessageId(),
            role: "assistant",
            text: action.question,
          },
        ]);
        return;
    }
  }

  async function handleAffiliateClick(
    item: CartPreviewItemModel,
    link: NonNullable<CartPreviewItemModel["affiliateLinks"]>[number],
  ) {
    const openedWindow = window.open("about:blank", "_blank");

    if (!openedWindow) {
      setToast({
        message:
          "Your browser blocked the new tab. Please allow popups for this site and try again.",
        tone: "notice",
      });
      return;
    }

    openedWindow.opener = null;
    await trackAffiliateClick({
      partId: item.partId,
      merchant: link.merchant,
      url: link.url,
      buildId: build?.id,
    });
    openedWindow.location.href = link.url;
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
    <div className="app-shell flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <TopBar
        authSession={authSession}
        entitlement={entitlement}
        onSavedBuildsClick={handleOpenSavedBuilds}
        onSignInClick={() => void handleSignIn()}
        onSignOutClick={() => void handleSignOut()}
      />

      <main
        className={`grid h-[calc(100vh-4rem)] min-h-0 grid-cols-1 overflow-y-auto lg:overflow-hidden ${
          isCompareOpen
            ? "lg:grid-cols-[minmax(320px,0.85fr)_minmax(420px,1.15fr)_390px] xl:grid-cols-[minmax(360px,0.9fr)_minmax(520px,1.1fr)_410px]"
            : "lg:grid-cols-[minmax(0,1fr)_390px] xl:grid-cols-[minmax(0,1fr)_410px]"
        }`}
      >
        <section className="order-3 min-h-0 min-w-0 bg-transparent lg:order-1 lg:overflow-y-auto">
          <div className="mx-auto max-w-6xl space-y-7 px-5 py-7 sm:px-6 md:px-8 md:py-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Badge className="mb-3 rounded-md border border-primary/30 bg-primary/10 text-primary">
                  <Sparkles className="mr-1 size-3" /> AI-ready build advisor
                </Badge>
                <h1 className="text-3xl font-bold tracking-tight">Live Build Recommendation</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Compare parts, replace components, and watch pricing, compatibility, and purchase
                  references update from the local demo catalog.
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
                {plan === "build_pro" && (
                  <Badge className="rounded-md border border-success/25 bg-success/10 text-success">
                    <ShieldCheck className="mr-1 size-3" />
                    Build Pro active
                  </Badge>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  className="rounded-md"
                  onClick={() => void handleResetMonetization()}
                >
                  Reset demo state
                </Button>
              </div>
            </div>

            {buildError ? (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6">
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-destructive/30 bg-background">
                    <AlertTriangle className="size-4 text-destructive" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-destructive">
                      Build recommendation unavailable
                    </h2>
                    <p className="mt-2 text-sm text-destructive/90">{buildError}</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Refresh the page, then run a starter prompt from the chat to verify the demo
                      flow.
                    </p>
                  </div>
                </div>
              </div>
            ) : build ? (
              <>
                <section className="surface-panel rounded-2xl p-5">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Sparkles className="size-4 text-primary" />
                        <h2 className="text-lg font-bold">Your Build Needs</h2>
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
                      updated={advisorUpdatedFields.has("budget")}
                    />
                    <NeedsCard
                      label="Use case"
                      value={formatNeedsList(customerNeeds.targetUseCase)}
                      updated={advisorUpdatedFields.has("targetUseCase")}
                    />
                    <NeedsCard
                      label="Appearance"
                      value={formatAppearancePreference(customerNeeds.appearancePreference)}
                      updated={advisorUpdatedFields.has("appearancePreference")}
                    />
                    <NeedsCard
                      label="Experience"
                      value={formatExperienceLevel(customerNeeds.experienceLevel)}
                      updated={advisorUpdatedFields.has("experienceLevel")}
                    />
                    <NeedsCard
                      label="Brand preference"
                      value={formatBrandPreference(customerNeeds)}
                      updated={
                        advisorUpdatedFields.has("cpuBrandPreference") ||
                        advisorUpdatedFields.has("gpuBrandPreference")
                      }
                    />
                  </div>
                </section>

                {showUsageUpgrade && (
                  <section className="rounded-2xl border border-warning/25 bg-warning/10 p-5">
                    <div className="mb-4 flex items-start gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-warning/30 bg-background text-warning">
                        <Sparkles className="size-4" />
                      </div>
                      <div>
                        <h2 className="text-base font-bold">Keep building with Build Pro</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Free planning limits are designed for a first pass. Build Pro unlocks more
                          advisor questions, more hardware replacements, saved builds, and full
                          export.
                        </p>
                      </div>
                    </div>
                    <UpgradeCard
                      compact
                      onUpgraded={() => void refreshMonetizationState()}
                      className="border-warning/25 bg-background/70"
                    />
                  </section>
                )}

                <BuildCard
                  build={build}
                  focusedCategory={compareCategory ?? undefined}
                  onFocus={(category) => void openCompare(category)}
                  onCompare={(category) => void openCompare(category)}
                  substitutions={substitutionSuggestions}
                  feedbackSummary={currentFeedbackSummary}
                  onReportBuildResult={() => void handleOpenFeedbackForCurrentBuild()}
                  onApplySubstitution={(part, suggestion) =>
                    void handleReplacePart(
                      part,
                      `Applied ${categoryLabels[suggestion.category]} substitution: ${part.displayName}.`,
                    )
                  }
                />

                {detailsError && (
                  <div className="flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <div>
                      <p className="font-semibold">Advisor detail refresh needs another try</p>
                      <p className="mt-1 text-warning/90">{detailsError}</p>
                    </div>
                  </div>
                )}

                <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                  {build.compatibilityWarnings.length === 0 ? (
                    <section className="rounded-2xl border border-success/20 bg-success/10 p-4">
                      <div className="flex items-center gap-3 text-success">
                        <ShieldCheck className="size-5" />
                        <div>
                          <h2 className="text-base font-bold">Compatibility checks passed</h2>
                          <p className="text-sm">
                            {build.compatibilityChecks.length} deterministic checks passed with{" "}
                            {build.confidenceScore.score}/100 confidence.
                          </p>
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
                          {build.compatibilityWarnings.length} item
                          {build.compatibilityWarnings.length === 1 ? "" : "s"}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        {build.compatibilityWarnings.map((warning) => {
                          const expanded = expandedWarningIds.has(warning.id);
                          const affectedNames = warning.affectedPartIds
                            .map(
                              (partId) =>
                                build.parts.find((part) => part.id === partId)?.displayName,
                            )
                            .filter(Boolean)
                            .join(" + ");

                          return (
                            <div
                              key={warning.id}
                              className="rounded-xl border border-border bg-background/60 p-3"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge
                                      className={
                                        warning.severity === "fail"
                                          ? "bg-destructive/15 text-destructive"
                                          : "bg-warning/15 text-warning"
                                      }
                                    >
                                      {warning.severity === "fail" ? "Needs review" : "Warning"}
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
                                  View details{" "}
                                  <ChevronDown
                                    className={`ml-1 size-3 transition-transform ${expanded ? "rotate-180" : ""}`}
                                  />
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

                  <section className="surface-panel rounded-2xl p-6">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <ShoppingBag className="size-4 text-primary" />
                        <h2 className="text-xl font-bold">Recommendation Summary</h2>
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
                      <div className="surface-inset rounded-2xl p-4 text-sm text-muted-foreground">
                        {isLoadingDetails
                          ? "Refreshing the recommendation summary..."
                          : "Recommendation summary will appear after the build finishes loading."}
                      </div>
                    )}
                  </section>
                </div>

                <section id="purchase-reference-list" className="surface-panel rounded-2xl p-6">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <ClipboardList className="size-4 text-primary" />
                        <h2 className="text-xl font-bold">Purchase Reference List</h2>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Demo retailer references only. No checkout, payment, or live stock
                        integration yet.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <AffiliateDisclosure />
                      <input
                        value={saveBuildName}
                        onChange={(event) => setSaveBuildName(event.target.value)}
                        className="h-9 w-48 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-primary/25"
                        placeholder="Build name"
                      />
                      <Button
                        size="sm"
                        className="rounded-md"
                        disabled={isSavingBuild}
                        onClick={() => void handleSaveBuild()}
                      >
                        {isSavingBuild ? (
                          <LoaderCircle className="mr-2 size-4 animate-spin" />
                        ) : (
                          <Save className="mr-2 size-4" />
                        )}
                        Save Build
                      </Button>
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
                      <div className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
                        <LoaderCircle className="size-4 animate-spin text-primary" />
                        <div>
                          <p className="font-medium text-foreground">
                            Preparing purchase references
                          </p>
                          <p className="mt-1">
                            Matching selected parts to demo retailer metadata and price notes.
                          </p>
                        </div>
                      </div>
                    ) : cartPreview.length === 0 ? (
                      <div className="flex items-start gap-3 p-5 text-sm text-muted-foreground">
                        <ShoppingBag className="mt-0.5 size-4 shrink-0 text-primary" />
                        <div>
                          <p className="font-medium text-foreground">No purchase references yet</p>
                          <p className="mt-1">
                            Ask for a recommendation or refresh the build. This MVP shows demo
                            retailer metadata only, with no checkout or live inventory.
                          </p>
                        </div>
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
                                {item.estimatedPrice === 0
                                  ? "Already owned"
                                  : `$${item.estimatedPrice.toFixed(2)}`}
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
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Download className="size-4 text-primary" />
                        <h2 className="text-xl font-bold">Export Build Plan</h2>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Preview is available for everyone. Full export is included with Build Pro.
                      </p>
                    </div>
                    {hasFullExport && (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="rounded-md"
                          onClick={() => void handleCopyExport()}
                        >
                          <Copy className="mr-2 size-4" />
                          Copy
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="rounded-md"
                          onClick={handleDownloadJson}
                        >
                          <FileJson className="mr-2 size-4" />
                          JSON
                        </Button>
                        <Button size="sm" className="rounded-md" onClick={handleDownloadMarkdown}>
                          <Download className="mr-2 size-4" />
                          Markdown
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
                    <pre className="max-h-72 overflow-auto rounded-xl border border-border bg-background/70 p-4 text-xs leading-relaxed text-muted-foreground">
                      {createBuildExportText({ build, buildNeeds: customerNeeds, cartPreview })}
                    </pre>
                    {hasFullExport ? (
                      <div className="rounded-xl border border-success/20 bg-success/10 p-4 text-sm text-success">
                        <CheckCircle2 className="mb-3 size-5" />
                        Build Pro export is active. Copy the summary or download JSON/Markdown for
                        your purchase planning.
                      </div>
                    ) : (
                      <ProFeatureLock
                        feature="build_export"
                        label="Full export and saved builds"
                        onUpgraded={() => void refreshMonetizationState()}
                      />
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
                <h2 className="mt-4 text-xl font-bold">Preparing the first recommendation</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  The consultation layout is loading the initial build and seed catalog.
                </p>
              </div>
            )}
          </div>
        </section>

        {build && (
          <ComparePanel
            build={build}
            category={compareCategory}
            parts={compareParts}
            open={isCompareOpen}
            isLoading={isLoadingCompare}
            isReplacing={isReplacingPart}
            errorMessage={compareError}
            recommendedReplacementId={recommendedReplacementId}
            substitutionSuggestions={substitutionSuggestions}
            plan={plan}
            usageStatus={usageStatus}
            startWithOwnedPartForm={openOwnedPartForm}
            ownedPartHint={ownedPartHint}
            onUpgraded={() => void refreshMonetizationState()}
            onOpenChange={handleCompareOpenChange}
            onReplace={(part) => void handleReplacePart(part)}
          />
        )}

        <ChatPanel
          className="order-1 h-[min(82vh,720px)] shrink-0 lg:order-3 lg:h-full"
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
          onActionClick={(action) => void handleAdvisorAction(action)}
        />
      </main>

      {isSavedBuildsOpen && (
        <SavedBuildsPanel
          builds={savedBuilds}
          limit={savedBuildLimit}
          isLoading={isLoadingSavedBuilds}
          plan={plan}
          onClose={() => setIsSavedBuildsOpen(false)}
          onRefresh={() => void refreshSavedBuilds()}
          onLoad={(id) => void handleLoadSavedBuild(id)}
          onRename={(summary) => void handleRenameSavedBuild(summary)}
          onReportFeedback={handleOpenFeedbackForSavedBuild}
          onDelete={(id) => void handleDeleteSavedBuild(id)}
          onUpgraded={() => void refreshMonetizationState()}
        />
      )}

      <PostBuildFeedbackForm
        buildId={feedbackTarget?.id ?? null}
        buildName={feedbackTarget?.name}
        open={Boolean(feedbackTarget)}
        isSubmitting={isSavingFeedback}
        onOpenChange={(open) => {
          if (!open) {
            setFeedbackTarget(null);
          }
        }}
        onSubmit={(feedback) => void handleSubmitPostBuildFeedback(feedback)}
      />

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <div
            className={`pointer-events-auto flex items-center gap-3 rounded-xl px-4 py-3 text-sm shadow-glow backdrop-blur ${
              toast.tone === "error"
                ? "border border-destructive/30 bg-destructive/10 text-destructive"
                : toast.tone === "notice"
                  ? "border border-warning/30 bg-warning/10 text-warning"
                  : "border border-primary/30 bg-card/95"
            }`}
          >
            {toast.tone === "error" ? (
              <AlertTriangle className="size-4" />
            ) : toast.tone === "notice" ? (
              <Sparkles className="size-4" />
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

function NeedsCard({ label, value, updated }: { label: string; value: string; updated?: boolean }) {
  return (
    <div className="surface-inset rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
        {updated && (
          <Badge className="rounded-md border border-primary/20 bg-primary/10 text-[10px] text-primary">
            Updated
          </Badge>
        )}
      </div>
      <p className="mt-2 text-sm leading-relaxed">{value}</p>
    </div>
  );
}

function SavedBuildsPanel({
  builds,
  limit,
  isLoading,
  plan,
  onClose,
  onRefresh,
  onLoad,
  onRename,
  onReportFeedback,
  onDelete,
  onUpgraded,
}: {
  builds: SavedBuildSummary[];
  limit: number;
  isLoading: boolean;
  plan: "free" | "build_pro";
  onClose: () => void;
  onRefresh: () => void;
  onLoad: (id: string) => void;
  onRename: (summary: SavedBuildSummary) => void;
  onReportFeedback: (summary: SavedBuildSummary) => void;
  onDelete: (id: string) => void;
  onUpgraded: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm">
      <div className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col border-l border-border bg-background shadow-2xl">
        <div className="shrink-0 border-b border-border p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-primary">
                <FolderOpen className="size-5" />
                <h2 className="text-xl font-bold">Saved Builds</h2>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {builds.length} of {limit} saved locally for this session.
              </p>
            </div>
            <Button size="sm" variant="secondary" className="rounded-md" onClick={onClose}>
              Close
            </Button>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <Badge className="rounded-md border border-primary/20 bg-primary/10 text-primary">
              {plan === "build_pro" ? "Build Pro: 10 saves" : "Free: 1 save"}
            </Badge>
            <Button size="sm" variant="ghost" className="rounded-md" onClick={onRefresh}>
              Refresh
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
          {isLoading ? (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              Loading saved builds
            </div>
          ) : builds.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card/50 p-5 text-sm text-muted-foreground">
              Save the current build to keep a purchase-ready snapshot here.
            </div>
          ) : (
            builds.map((savedBuild) => (
              <article key={savedBuild.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">{savedBuild.name}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Saved {formatDate(savedBuild.createdAt)} · Updated{" "}
                      {formatDate(savedBuild.updatedAt)}
                    </p>
                  </div>
                  <Badge
                    className={
                      savedBuild.compatibilityStatus === "pass"
                        ? "bg-success/15 text-success"
                        : "bg-warning/15 text-warning"
                    }
                  >
                    {formatCompatibilityStatus(savedBuild.compatibilityStatus)}
                  </Badge>
                </div>

                <div className="mt-4 grid gap-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-mono font-semibold">
                      {formatMoney(savedBuild.totalPrice)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">CPU</span>
                    <span className="text-right">{savedBuild.cpuName ?? "Not saved"}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">GPU</span>
                    <span className="text-right">{savedBuild.gpuName ?? "Not saved"}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Owned parts</span>
                    <span>{savedBuild.ownedParts}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {savedBuild.targetUseCase.join(" + ") || "No use case saved"}
                  </p>
                </div>

                <div className="mt-4 grid gap-2 rounded-xl border border-border bg-background/60 p-3 text-xs sm:grid-cols-4">
                  <div>
                    <p className="text-muted-foreground">Build completed</p>
                    <p className="mt-1 font-semibold">
                      {savedBuild.feedbackSummary ? "Yes" : "Not reported"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Issues reported</p>
                    <p className="mt-1 font-semibold">
                      {savedBuild.feedbackSummary?.issuesReported ?? "None yet"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Satisfaction score</p>
                    <p className="mt-1 font-semibold">
                      {savedBuild.feedbackSummary
                        ? `${savedBuild.feedbackSummary.satisfactionScore}/5`
                        : "Not rated"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Beginner difficulty</p>
                    <p className="mt-1 font-semibold">
                      {savedBuild.feedbackSummary
                        ? formatFeedbackDifficulty(savedBuild.feedbackSummary.beginnerDifficulty)
                        : "Not reported"}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <Button
                    size="sm"
                    className="rounded-md"
                    onClick={() => onReportFeedback(savedBuild)}
                  >
                    Report Build Result
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="rounded-md"
                    onClick={() => onRename(savedBuild)}
                  >
                    Rename
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="rounded-md"
                    onClick={() => onLoad(savedBuild.id)}
                  >
                    Load build
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-md text-destructive"
                    onClick={() => onDelete(savedBuild.id)}
                  >
                    <Trash2 className="mr-2 size-4" />
                    Delete
                  </Button>
                </div>
              </article>
            ))
          )}
        </div>

        {plan === "free" && (
          <div className="shrink-0 border-t border-border p-5">
            <ProFeatureLock
              feature="build_export"
              label="Save up to 10 builds"
              onUpgraded={onUpgraded}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-inset rounded-2xl p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-2 leading-relaxed">{value}</p>
    </div>
  );
}

function SummaryList({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="surface-inset rounded-2xl p-4">
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

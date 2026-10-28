import { isSafeExternalUrl } from "@/lib/product-trust";
import { priceBasisLabel, priceUnknown } from "@/lib/v3/catalog";
import {
  completeness,
  primarySlots,
  selectedPart,
  slotLabel,
  slotOccupancy,
  type BuildDocumentV3,
  type SlotId,
  budgetOf,
} from "@/lib/v3/build-document";
import type { CompatibilitySeverity } from "@/types/build";

export type PlanLineStatus = "planned" | "owned" | "unresolved" | "empty";

export interface PlanLink {
  url: string;
  kind: "official" | "search";
  label: string;
}

export interface PlanLine {
  slot: SlotId;
  label: string;
  status: PlanLineStatus;
  partId?: string;
  name?: string;
  /** Original unresolved text (e.g. an unmatched import line). */
  note?: string;
  /** Known catalog price; null means unknown, never zero. */
  price: number | null;
  priceBasis: string;
  links: PlanLink[];
}

export interface PlanFinding {
  severity: Exclude<CompatibilitySeverity, "pass">;
  label: string;
  message: string;
}

export interface ShoppingPlan {
  name: string;
  source: BuildDocumentV3["source"];
  /** Null when no target budget was set (photo drafts): no budget comparison is made. */
  budget: number | null;
  lines: PlanLine[];
  /** Sum of known prices for parts still to buy. Owned parts count as $0. */
  knownSubtotal: number;
  pricedCount: number;
  openCount: number;
  /** Chosen parts whose price no source gives (not counted in the subtotal). */
  unknownPriceCount: number;
  complete: boolean;
  compatibility: "incomplete" | CompatibilitySeverity;
  findings: PlanFinding[];
  /** Rules that could not run because a part they need is not in the build yet. */
  notChecked: { label: string; waitingFor: string[] }[];
  checksRun: number;
  disclosures: string[];
}

export const PLAN_DISCLOSURES = [
  "Prices are seed catalog values or manufacturer store prices with the date they were checked, not live retailer quotes. Unknown prices are not counted. Check the retailer before buying.",
  "Tax, shipping and stock are not included or checked.",
  "Links open an official product page or a retailer search; they are references, not verified listings.",
  "Compatibility covers the rules this app checks with catalog specs. It does not confirm physical fit, and empty or unresolved slots are not checked.",
];

function linksFor(part: NonNullable<ReturnType<typeof selectedPart>>): PlanLink[] {
  const links: PlanLink[] = [];
  if (isSafeExternalUrl(part.productUrl))
    links.push({ url: part.productUrl!, kind: "official", label: "Official page" });
  if (isSafeExternalUrl(part.searchUrl)) {
    const host = new URL(part.searchUrl!).hostname.replace(/^www\./, "");
    links.push({ url: part.searchUrl!, kind: "search", label: `Search ${host}` });
  }
  return links;
}

export function buildShoppingPlan(document: BuildDocumentV3): ShoppingPlan {
  const lines: PlanLine[] = primarySlots.map((slot) => {
    const occupancy = slotOccupancy(document, slot);
    const label = slotLabel[slot];
    if (occupancy === "unresolved")
      return {
        slot,
        label,
        status: "unresolved",
        note: document.unresolved[slot],
        price: null,
        priceBasis: "Unknown until a part is chosen",
        links: [],
      };
    const part = selectedPart(document, slot);
    if (!part)
      return {
        slot,
        label,
        status: "empty",
        price: null,
        priceBasis: "No part selected",
        links: [],
      };
    if (part.owned)
      return {
        slot,
        label,
        status: "owned",
        partId: part.id,
        name: part.displayName,
        price: 0,
        priceBasis: "Already owned",
        links: [],
      };
    const known = !priceUnknown(part);
    return {
      slot,
      label,
      status: "planned",
      partId: part.id,
      name: part.displayName,
      price: known ? part.price : null,
      priceBasis: priceBasisLabel(part),
      links: linksFor(part),
    };
  });

  const status = completeness(document);
  const priced = lines.filter((line) => line.price !== null);
  const present = new Set<string>(document.build.parts.map((part) => part.category));
  const missingInputs = (categories: string[]) =>
    categories.filter((category) => !present.has(category));
  const notChecked = document.build.compatibilityChecks
    .filter((check) => missingInputs(check.checkedPartCategories).length > 0)
    .map((check) => ({
      label: check.label,
      waitingFor: missingInputs(check.checkedPartCategories),
    }));
  const findings: PlanFinding[] = document.build.compatibilityChecks
    .filter(
      (check) =>
        check.severity !== "pass" && missingInputs(check.checkedPartCategories).length === 0,
    )
    .map((check) => ({
      severity: check.severity as PlanFinding["severity"],
      label: check.label,
      message: check.message,
    }));

  return {
    name: document.build.name,
    source: document.source,
    budget: budgetOf(document),
    lines,
    knownSubtotal: priced.reduce((sum, line) => sum + (line.price ?? 0), 0),
    pricedCount: priced.length,
    unknownPriceCount: lines.filter((line) => line.status === "planned" && line.price === null)
      .length,
    openCount: lines.filter((line) => line.status === "unresolved" || line.status === "empty")
      .length,
    complete: status.complete,
    // An incomplete draft never reports an overall pass.
    compatibility: status.complete ? document.build.compatibilityStatus : "incomplete",
    findings,
    notChecked,
    checksRun: document.build.compatibilityChecks.length - notChecked.length,
    disclosures: PLAN_DISCLOSURES,
  };
}

const money = (value: number) => `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

const statusText: Record<PlanLineStatus, string> = {
  planned: "Planned",
  owned: "Owned",
  unresolved: "Needs review",
  empty: "Not chosen",
};

export function shoppingPlanMarkdown(plan: ShoppingPlan, generatedAt = new Date()): string {
  const rows = plan.lines.map((line) => {
    const item = line.name ?? (line.note ? `Unresolved: "${line.note}"` : "—");
    const price = line.price === null ? "Unknown" : money(line.price);
    const links = line.links.map((link) => `[${link.label}](${link.url})`).join(" · ") || "—";
    return `| ${line.label} | ${statusText[line.status]} | ${item.replaceAll("|", "\\|")} | ${price} | ${line.priceBasis} | ${links} |`;
  });
  const subtotalNote =
    plan.pricedCount === 8
      ? "all 8 slots priced from catalog data"
      : `known subtotal for ${plan.pricedCount} of 8 slots; ${8 - plan.pricedCount} slot(s) not priced`;
  const compatibility =
    plan.compatibility === "incomplete"
      ? `Incomplete — ${plan.openCount} slot(s) still need a decision, so the build is not fully checked.`
      : `${plan.compatibility.toUpperCase()} on ${plan.checksRun} catalog rule check(s).`;
  return [
    `# ${plan.name}`,
    "",
    `Generated ${generatedAt.toISOString()} · Source: ${plan.source} · Budget: ${plan.budget === null ? "Not set" : money(plan.budget)}`,
    "",
    "## Parts plan",
    "",
    "| Slot | Status | Part | Price | Price basis | Links |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
    `**Subtotal:** ${money(plan.knownSubtotal)} (${subtotalNote}). Tax and shipping not included.`,
    "",
    "## Compatibility",
    "",
    compatibility,
    ...(plan.findings.length
      ? [
          "",
          ...plan.findings.map((f) => `- **${f.severity.toUpperCase()}** ${f.label}: ${f.message}`),
        ]
      : []),
    ...(plan.notChecked.length
      ? [
          "",
          `Not checked yet (${plan.notChecked.length}): waiting on missing parts.`,
          ...plan.notChecked.map((rule) => `- ${rule.label} — needs ${rule.waitingFor.join(", ")}`),
        ]
      : []),
    "",
    "## Notes",
    "",
    ...plan.disclosures.map((text) => `- ${text}`),
    "",
  ].join("\n");
}

export function shoppingPlanJson(
  plan: ShoppingPlan,
  document: BuildDocumentV3,
  generatedAt = new Date(),
) {
  return {
    schema: "aipc.build-report.v1",
    generatedAt: generatedAt.toISOString(),
    buildRevision: document.revision,
    savedBuildId: document.savedBuildId ?? null,
    ...plan,
    budget: plan.budget ?? "Not set",
    // Visual priorities only; observations and the reference photo are not exported.
    visualPriorities:
      document.imageContext?.visualPriorities.map(({ category, value, locked }) => ({
        category,
        value,
        locked,
      })) ?? [],
  };
}

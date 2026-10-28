import { useMemo, useState } from "react";
import { ClipboardCopy, Download, ExternalLink, FileJson, ShoppingBag } from "lucide-react";
import type { BuildDocumentV3, SlotId } from "@/lib/v3/build-document";
import {
  buildShoppingPlan,
  shoppingPlanJson,
  shoppingPlanMarkdown,
  type PlanLineStatus,
} from "@/lib/v3/shopping-plan";
import { funnel } from "@/lib/v3/funnel-analytics";

const statusLabel: Record<PlanLineStatus, string> = {
  planned: "Planned",
  owned: "Owned",
  unresolved: "Needs review",
  empty: "Not chosen",
};

function fileSlug(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "pc-build"
  );
}

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = window.document.createElement("a");
  link.href = url;
  link.download = filename;
  window.document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Budget against the known subtotal; only drawn when the user set a target budget. */
function BudgetCard({
  budget,
  knownSubtotal,
  openCount,
  unknownPriceCount,
}: {
  budget: number;
  knownSubtotal: number;
  openCount: number;
  unknownPriceCount: number;
}) {
  return (
    <div>
      <small>BUDGET</small>
      <strong>${budget.toLocaleString()}</strong>
      <em>
        {knownSubtotal > budget
          ? `Known parts already exceed budget by $${(knownSubtotal - budget).toLocaleString()}`
          : openCount
            ? `$${(budget - knownSubtotal).toLocaleString()} left for ${openCount} open slot(s)`
            : unknownPriceCount
              ? `${(budget - knownSubtotal).toLocaleString()} left before ${unknownPriceCount} unknown price(s)`
              : `${(budget - knownSubtotal).toLocaleString()} under budget`}
      </em>
    </div>
  );
}

export function ShoppingPlanPanel({
  document,
  onSelectSlot,
}: {
  document: BuildDocumentV3;
  onSelectSlot: (slot: SlotId) => void;
}) {
  const plan = useMemo(() => buildShoppingPlan(document), [document]);
  const [message, setMessage] = useState("");

  async function copyMarkdown() {
    try {
      await navigator.clipboard.writeText(shoppingPlanMarkdown(plan));
      setMessage("Report copied as Markdown.");
      funnel.reportExported(document, "markdown_copy");
    } catch {
      setMessage("The browser blocked clipboard access. Use Download instead.");
    }
  }

  return (
    <section className="v3-plan" aria-labelledby="v3-plan-title">
      <div className="v3-plan-heading">
        <div>
          <span className="v3-kicker">SHOPPING PLAN</span>
          <h2 id="v3-plan-title">
            <ShoppingBag size={20} /> What to buy, and what is still open
          </h2>
        </div>
        <div className="v3-plan-actions">
          <button type="button" className="v3-secondary" onClick={() => void copyMarkdown()}>
            <ClipboardCopy size={15} /> Copy report
          </button>
          <button
            type="button"
            className="v3-secondary"
            onClick={() => {
              download(
                `${fileSlug(plan.name)}.md`,
                shoppingPlanMarkdown(plan),
                "text/markdown;charset=utf-8",
              );
              funnel.reportExported(document, "markdown_file");
            }}
          >
            <Download size={15} /> Markdown
          </button>
          <button
            type="button"
            className="v3-secondary"
            onClick={() => {
              download(
                `${fileSlug(plan.name)}.json`,
                JSON.stringify(shoppingPlanJson(plan, document), null, 2),
                "application/json",
              );
              funnel.reportExported(document, "json_file");
            }}
          >
            <FileJson size={15} /> JSON
          </button>
        </div>
      </div>
      {message && (
        <p className="v3-plan-message" role="status">
          {message}
        </p>
      )}
      <div className="v3-plan-table" role="table" aria-label="Shopping plan by slot">
        <div className="v3-plan-row v3-plan-head" role="row">
          <span role="columnheader">Slot</span>
          <span role="columnheader">Part</span>
          <span role="columnheader">Price</span>
          <span role="columnheader">Where to check</span>
        </div>
        {plan.lines.map((line) => (
          <div className={`v3-plan-row is-${line.status}`} role="row" key={line.slot}>
            <span role="cell">
              <strong>{line.label}</strong>
              <small>{statusLabel[line.status]}</small>
            </span>
            <span role="cell">
              {line.name ??
                (line.status === "unresolved" ? (
                  <button type="button" onClick={() => onSelectSlot(line.slot)}>
                    Review “{line.note}”
                  </button>
                ) : (
                  <button type="button" onClick={() => onSelectSlot(line.slot)}>
                    Choose a part
                  </button>
                ))}
              {line.colorNote && <small className="v3-color-source">{line.colorNote}</small>}
            </span>
            <span role="cell">
              <strong>{line.price === null ? "Unknown" : `$${line.price.toLocaleString()}`}</strong>
              <small>{line.priceBasis}</small>
            </span>
            <span role="cell" className="v3-plan-links">
              {line.links.length
                ? line.links.map((link) => (
                    <a
                      key={link.url}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => funnel.shoppingLinkOpened(document, line.slot, link.kind)}
                    >
                      {link.label} <ExternalLink size={12} />
                    </a>
                  ))
                : "—"}
            </span>
          </div>
        ))}
      </div>
      <div className="v3-plan-summary">
        <div>
          <small>KNOWN SUBTOTAL</small>
          <strong>${plan.knownSubtotal.toLocaleString()}</strong>
          <em>
            {plan.pricedCount === 8
              ? "All 8 slots priced from catalog data"
              : [
                  `${plan.pricedCount} of 8 slots priced`,
                  plan.openCount ? `${plan.openCount} still open` : null,
                  plan.unknownPriceCount
                    ? `${plan.unknownPriceCount} price${plan.unknownPriceCount === 1 ? "" : "s"} unknown`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
            {" · tax and shipping not included"}
          </em>
        </div>
        {/* No target budget (photo drafts): no comparison card at all, never a $0 budget. */}
        {plan.budget !== null && (
          <BudgetCard
            budget={plan.budget}
            knownSubtotal={plan.knownSubtotal}
            openCount={plan.openCount}
            unknownPriceCount={plan.unknownPriceCount}
          />
        )}
        <div>
          <small>COMPATIBILITY</small>
          <strong>{plan.compatibility === "incomplete" ? "Incomplete" : plan.compatibility}</strong>
          <em>
            {plan.compatibility === "incomplete"
              ? "Open slots are not checked"
              : `${plan.findings.length} finding(s) on ${plan.checksRun} rule check(s)`}
          </em>
        </div>
      </div>
      {plan.findings.length > 0 && (
        <ul className="v3-plan-findings">
          {plan.findings.map((finding) => (
            <li key={`${finding.label}-${finding.message}`} className={`is-${finding.severity}`}>
              <strong>{finding.severity === "fail" ? "Fail" : "Warning"}:</strong> {finding.label} —{" "}
              {finding.message}
            </li>
          ))}
        </ul>
      )}
      {plan.notChecked.length > 0 && (
        <details className="v3-plan-unchecked">
          <summary>
            {plan.notChecked.length} rule check(s) waiting on parts you have not chosen yet
          </summary>
          <ul>
            {plan.notChecked.map((rule) => (
              <li key={rule.label}>
                {rule.label} — needs {rule.waitingFor.join(", ")}
              </li>
            ))}
          </ul>
        </details>
      )}
      <ul className="v3-plan-notes">
        {plan.disclosures.map((text) => (
          <li key={text}>{text}</li>
        ))}
      </ul>
    </section>
  );
}

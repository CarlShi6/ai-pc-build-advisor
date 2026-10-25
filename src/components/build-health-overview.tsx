import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ShoppingBag,
} from "lucide-react";

type BuildHealthOverviewProps = {
  budget: number;
  total: number;
  compatibilityStatus: "pass" | "warning" | "fail";
  compatibilityReviewCount: number;
  compatibilityExpanded: boolean;
  unresolvedPurchaseCount: number;
  componentCount: number;
  onBudgetAction: () => void;
  onCompatibilityAction: () => void;
  onShoppingAction: () => void;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function BuildHealthOverview({
  budget,
  total,
  compatibilityStatus,
  compatibilityReviewCount,
  compatibilityExpanded,
  unresolvedPurchaseCount,
  componentCount,
  onBudgetAction,
  onCompatibilityAction,
  onShoppingAction,
}: BuildHealthOverviewProps) {
  const remaining = budget - total;
  const budgetUsed = budget > 0 ? Math.min(100, Math.round((total / budget) * 100)) : 0;
  const compatibilityReady = compatibilityReviewCount === 0 && compatibilityStatus === "pass";
  const shoppingReady = unresolvedPurchaseCount === 0 && componentCount > 0;

  return (
    <section className="build-health" aria-labelledby="build-health-title">
      <header className="build-health-heading">
        <div>
          <span className="section-kicker">BUILD AT A GLANCE</span>
          <h2 id="build-health-title">Three decisions before checkout</h2>
        </div>
        <span className="build-health-source">Seed prices · calculated checks</span>
      </header>

      <button className="health-card health-card-budget" onClick={onBudgetAction}>
        <span className="health-icon">
          <CircleDollarSign size={18} />
        </span>
        <span className="health-copy">
          <span>Budget</span>
          <strong className={remaining >= 0 ? "semantic-excellent" : "semantic-risk"}>
            {remaining >= 0
              ? `${formatMoney(remaining)} left`
              : `${formatMoney(Math.abs(remaining))} over`}
          </strong>
          <small>
            {formatMoney(total)} of {formatMoney(budget)} · open largest cost
          </small>
        </span>
        <span className="health-percent">{budgetUsed}%</span>
        <span className="health-progress" aria-hidden="true">
          <span style={{ width: `${budgetUsed}%` }} />
        </span>
        <ChevronRight size={16} />
      </button>

      <div className="health-card-grid">
        <button
          className="health-card"
          onClick={onCompatibilityAction}
          aria-expanded={compatibilityExpanded}
        >
          <span className={`health-icon ${compatibilityReady ? "ready" : "review"}`}>
            {compatibilityReady ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          </span>
          <span className="health-copy">
            <span>Compatibility</span>
            <strong>
              {compatibilityReady ? "Checks passed" : `${compatibilityReviewCount} to review`}
            </strong>
            <small>Rule engine · view finding</small>
          </span>
          <ChevronRight size={16} />
        </button>

        <button className="health-card" onClick={onShoppingAction}>
          <span className={`health-icon ${shoppingReady ? "ready" : "review"}`}>
            <ShoppingBag size={18} />
          </span>
          <span className="health-copy">
            <span>Purchase plan</span>
            <strong>
              {shoppingReady ? "References ready" : `${unresolvedPurchaseCount} unresolved`}
            </strong>
            <small>{componentCount} parts · inspect sources</small>
          </span>
          <ChevronRight size={16} />
        </button>
      </div>
    </section>
  );
}

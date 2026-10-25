import { categoryLabels } from "@/data/seedParts";
import type { Build } from "@/types/build";

export function BudgetBreakdown({ build, onSelect }: { build: Build; onSelect: (id: string) => void }) {
  const total = build.parts.reduce((sum, part) => sum + (part.owned ? 0 : Math.max(0, part.price)), 0);
  const sorted = [...build.parts].sort((a, b) => b.price - a.price);
  return <section className="budget-breakdown" aria-label="Component cost breakdown">
    <div className="breakdown-heading"><strong>Where your budget goes</strong><span>Estimated parts cost</span></div>
    <div className="allocation-bar" aria-hidden="true">{sorted.filter((p) => !p.owned && p.price > 0).map((part, i) => <span key={part.id} style={{ flex: part.price, opacity: 1 - i * .085 }} />)}</div>
    <div className="allocation-legend">{sorted.filter((part) => !part.owned && part.price > 0).map((part) => <button key={part.id} onClick={() => onSelect(part.id)} aria-label={`Compare ${categoryLabels[part.category]} alternatives, ${Math.round(part.price / Math.max(total, 1) * 100)} percent of parts cost`}><span>{categoryLabels[part.category]}</span><strong>{Math.round(part.price / Math.max(total, 1) * 100)}%</strong></button>)}</div>
    <p>Select a category to compare alternatives and adjust your spend.</p>
  </section>;
}

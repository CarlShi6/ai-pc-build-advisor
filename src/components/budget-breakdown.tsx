import { ChevronRight } from "lucide-react";
import { categoryLabels } from "@/data/seedParts";
import type { Build } from "@/types/build";

export function BudgetBreakdown({
  build,
  onSelect,
}: {
  build: Build;
  onSelect: (id: string) => void;
}) {
  const total = build.parts.reduce(
    (sum, part) => sum + (part.owned ? 0 : Math.max(0, part.price)),
    0,
  );
  const sorted = [...build.parts]
    .filter((part) => !part.owned && part.price > 0)
    .sort((a, b) => b.price - a.price);
  const primary = sorted.slice(0, 4);
  const remaining = sorted.slice(4);
  const renderRow = (part: Build["parts"][number]) => {
    const share = Math.round((part.price / Math.max(total, 1)) * 100);
    return (
      <button
        key={part.id}
        onClick={() => onSelect(part.id)}
        aria-label={`Compare ${categoryLabels[part.category]} alternatives, ${share} percent of parts cost`}
      >
        <span>
          <i aria-hidden="true" />
          {categoryLabels[part.category]}
        </span>
        <span>
          <small>${part.price.toLocaleString()}</small>
          <strong>{share}%</strong>
          <ChevronRight size={13} />
        </span>
      </button>
    );
  };
  return (
    <section className="budget-breakdown" aria-label="Component cost breakdown">
      <div className="breakdown-heading">
        <strong>Cost map</strong>
        <span>Select a category to compare compatible alternatives.</span>
      </div>
      <div className="allocation-bar" aria-label="Budget allocation by component">
        {sorted.map((part, index) => (
          <span
            key={part.id}
            style={{ flex: part.price, opacity: Math.max(0.38, 1 - index * 0.085) }}
            title={`${categoryLabels[part.category]}: $${part.price.toLocaleString()}`}
          />
        ))}
      </div>
      <div className="allocation-legend">{primary.map(renderRow)}</div>
      {remaining.length > 0 && (
        <details className="allocation-more">
          <summary>Show {remaining.length} smaller categories</summary>
          <div className="allocation-legend">{remaining.map(renderRow)}</div>
        </details>
      )}
    </section>
  );
}

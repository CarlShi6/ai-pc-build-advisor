import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, TrendingDown, TrendingUp, Minus, Star } from "lucide-react";
import type { CSSProperties } from "react";
import {
  GPU_METRICS,
  GPU_OPTIONS,
  verdict,
  type ComparableOption,
  type Metric,
} from "@/lib/parts-data";

function VerdictBadge({ v }: { v: "better" | "worse" | "similar" }) {
  const map = {
    better: {
      cls: "bg-success/15 text-success border-success/30",
      icon: TrendingUp,
      label: "Better",
    },
    worse: {
      cls: "bg-warning/15 text-warning border-warning/30",
      icon: TrendingDown,
      label: "Lower",
    },
    similar: {
      cls: "bg-secondary text-muted-foreground border-border",
      icon: Minus,
      label: "Similar",
    },
  } as const;
  const { cls, icon: Icon, label } = map[v];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        cls,
      )}
    >
      <Icon className="size-3" /> {label}
    </span>
  );
}

function HeaderTag({ o, selectedId }: { o: ComparableOption; selectedId?: string }) {
  if (o.id === selectedId)
    return (
      <Badge className="rounded-md border border-primary/40 bg-primary/15 text-primary">
        <Check className="mr-1 size-3" /> Currently Selected
      </Badge>
    );
  if (o.tag === "budget")
    return (
      <Badge className="rounded-md bg-success/15 text-success">
        <Star className="mr-1 size-3" /> Best Value
      </Badge>
    );
  if (o.tag === "alt")
    return (
      <Badge className="rounded-md bg-warning/15 text-warning">Highest Performance</Badge>
    );
  return (
    <Badge variant="secondary" className="rounded-md">
      Recommended
    </Badge>
  );
}

export function ComparisonTable({
  options = GPU_OPTIONS,
  metrics = GPU_METRICS,
  selectedId,
  onSelect,
  title = "Parameter Comparison",
  subtitle = "Side-by-side GPU options to help you pick the right card.",
}: {
  options?: ComparableOption[];
  metrics?: Metric[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  title?: string;
  subtitle?: string;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <header className="border-b border-border p-6">
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </header>

      <div
        className="grid grid-cols-1 gap-px bg-border md:grid-cols-[260px_repeat(var(--cols),1fr)]"
        style={{ ["--cols" as string]: options.length } as CSSProperties}
      >
        {/* Header row */}
        <div className="bg-card p-5 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Specification
        </div>
        {options.map((o) => {
          const isSel = o.id === selectedId;
          return (
            <div
              key={o.id}
              className={cn(
                "space-y-3 bg-card p-5",
                isSel && "bg-primary/5 ring-1 ring-inset ring-primary/40",
              )}
            >
              <HeaderTag o={o} selectedId={selectedId} />
              <h3 className="text-base font-bold leading-tight">{o.name}</h3>
              <p className="text-xs text-muted-foreground">{o.reason}</p>
              {onSelect && (
                <Button
                  size="sm"
                  variant={isSel ? "default" : "secondary"}
                  onClick={() => onSelect(o.id)}
                  className="w-full rounded-lg"
                >
                  {isSel ? "Selected" : "Select this part"}
                </Button>
              )}
            </div>
          );
        })}

        {/* Metric rows */}
        {metrics.map((m) => (
          <Row key={m.key} metric={m} options={options} selectedId={selectedId} />
        ))}

        {/* Buyer notes */}
        <div className="bg-card p-5">
          <p className="text-sm font-semibold">Buyer-friendly notes</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Plain-language guidance for each option.
          </p>
        </div>
        {options.map((o) => (
          <div
            key={o.id + "-note"}
            className={cn(
              "space-y-2 bg-card p-5",
              o.id === selectedId && "bg-primary/5 ring-1 ring-inset ring-primary/40",
            )}
          >
            <p className="text-sm">{o.beginnerNote}</p>
            <p className="rounded-md border border-primary/20 bg-primary/5 p-2 text-xs text-primary">
              {o.salesNote}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Row({
  metric,
  options,
  selectedId,
}: {
  metric: Metric;
  options: ComparableOption[];
  selectedId?: string;
}) {
  return (
    <>
      <div className="bg-card p-5">
        <p className="text-sm font-semibold">{metric.label}</p>
        {metric.hint && (
          <p className="mt-1 text-xs text-muted-foreground">{metric.hint}</p>
        )}
      </div>
      {options.map((o) => {
        const v = verdict(metric, options, o);
        return (
          <div
            key={o.id + metric.key}
            className={cn(
              "flex items-center justify-between gap-3 bg-card p-5",
              o.id === selectedId && "bg-primary/5 ring-1 ring-inset ring-primary/40",
            )}
          >
            <span className="font-mono text-base font-semibold">{metric.format(o)}</span>
            <VerdictBadge v={v} />
          </div>
        );
      })}
    </>
  );
}

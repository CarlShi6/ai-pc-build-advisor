import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { TopBar } from "@/components/top-bar";
import { ComparisonTable } from "@/components/comparison-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  GPU_OPTIONS,
  GPU_METRICS,
  verdict,
  type ComparableOption,
} from "@/lib/parts-data";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Star,
  TrendingUp,
  TrendingDown,
  Minus,
  Cpu,
  MonitorPlay,
  Sparkles,
  AlertTriangle,
  Lightbulb,
  Wallet,
} from "lucide-react";

const searchSchema = z.object({
  category: z.enum(["GPU", "CPU"]).catch("GPU"),
});

export const Route = createFileRoute("/compare")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Component Comparison — AI装机助手" },
      {
        name: "description",
        content: "Side-by-side comparison of PC components with clear recommendations.",
      },
    ],
  }),
  component: ComparePage,
});

const ORIGINAL_SELECTED_ID = "rtx-4080s";
const ORIGINAL_PRICE = GPU_OPTIONS.find((o) => o.id === ORIGINAL_SELECTED_ID)!.price;

function ComparePage() {
  const { category } = Route.useSearch();
  const navigate = useNavigate({ from: "/compare" });
  const [selectedId, setSelectedId] = useState<string>(ORIGINAL_SELECTED_ID);

  const options = GPU_OPTIONS; // demo data — GPU only
  const selected = useMemo(
    () => options.find((o) => o.id === selectedId) ?? options[0],
    [options, selectedId],
  );
  const delta = selected.price - ORIGINAL_PRICE;
  const changed = selected.id !== ORIGINAL_SELECTED_ID;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopBar />
      <main className="mx-auto max-w-6xl space-y-8 px-6 py-10">
        {/* Breadcrumb / back */}
        <div className="flex items-center justify-between gap-4">
          <Button asChild variant="ghost" size="sm" className="rounded-lg text-muted-foreground">
            <Link to="/build">
              <ArrowLeft className="mr-2 size-4" /> Back to build
            </Link>
          </Button>
          <div className="flex gap-1 rounded-full border border-border bg-card p-1">
            {(["GPU", "CPU"] as const).map((c) => {
              const active = c === category;
              const disabled = c === "CPU";
              return (
                <button
                  key={c}
                  disabled={disabled}
                  onClick={() => navigate({ search: { category: c } })}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-xs font-semibold transition-all",
                    active
                      ? "bg-primary text-primary-foreground shadow-glow"
                      : "text-muted-foreground hover:text-foreground",
                    disabled && "cursor-not-allowed opacity-40",
                  )}
                >
                  {c === "GPU" ? "Compare GPU" : "Compare CPU (soon)"}
                </button>
              );
            })}
          </div>
        </div>

        {/* Top summary card */}
        <section className="overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card p-6 shadow-glow">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="space-y-3">
              <Badge className="rounded-md border border-primary/40 bg-primary/15 text-primary">
                <Sparkles className="mr-1 size-3" /> Currently Comparing · {category}
              </Badge>
              <h1 className="text-3xl font-bold tracking-tight">
                Component Comparison{" "}
                <span className="font-normal text-muted-foreground">/ 参数对比</span>
              </h1>
              <div className="grid gap-4 sm:grid-cols-2">
                <SummaryItem
                  icon={<MonitorPlay className="size-4 text-primary" />}
                  label="Current Selected"
                  value={selected.name}
                />
                <SummaryItem
                  icon={<Cpu className="size-4 text-primary" />}
                  label="Build Goal"
                  value="4K video editing + casual gaming"
                />
                <SummaryItem
                  icon={<Wallet className="size-4 text-primary" />}
                  label="Budget Status"
                  value={
                    selected.price <= 1100
                      ? "Within budget"
                      : selected.price <= 1500
                        ? "Slightly over budget"
                        : "Over budget"
                  }
                  tone={selected.price <= 1100 ? "success" : "warning"}
                />
                <SummaryItem
                  icon={<Lightbulb className="size-4 text-primary" />}
                  label="Recommendation"
                  value="Best balance for performance and price"
                />
              </div>
            </div>
          </div>

          {changed && (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm">
              <div className="flex items-center gap-2">
                <Check className="size-4 text-primary" />
                <span>
                  Selected GPU changed to{" "}
                  <span className="font-semibold">{selected.name}</span>.{" "}
                  <span
                    className={cn(
                      "font-mono font-semibold",
                      delta < 0 ? "text-success" : "text-warning",
                    )}
                  >
                    {delta < 0
                      ? `Estimated total saves $${Math.abs(delta).toLocaleString()}`
                      : `Estimated total increases $${delta.toLocaleString()}`}
                  </span>
                  .
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedId(ORIGINAL_SELECTED_ID)}
                className="rounded-md text-xs text-muted-foreground"
              >
                Reset
              </Button>
            </div>
          )}
        </section>

        {/* Side-by-side option cards */}
        <section className="grid gap-4 md:grid-cols-3">
          {options.map((o) => (
            <OptionCard
              key={o.id}
              option={o}
              selected={o.id === selectedId}
              onSelect={() => setSelectedId(o.id)}
            />
          ))}
        </section>

        {/* Parameter comparison table */}
        <ComparisonTable
          options={options}
          metrics={GPU_METRICS}
          selectedId={selectedId}
          onSelect={setSelectedId}
          title="Parameter comparison"
          subtitle="Each row scores the three GPUs against each other. Green = better, orange = worse, gray = similar."
        />

        {/* Buyer explanation */}
        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-6">
            <div className="mb-3 flex items-center gap-2">
              <Lightbulb className="size-4 text-primary" />
              <h3 className="text-base font-bold">Beginner-friendly explanation</h3>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground">
              The <span className="font-semibold text-foreground">RTX 4080 Super</span> is
              recommended because it gives strong 4K editing and gaming performance without the
              huge price jump of the RTX 4090. The{" "}
              <span className="font-semibold text-foreground">RTX 4070 Ti Super</span> is a
              better-value choice if you want to save money.
            </p>
          </div>
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6">
            <div className="mb-3 flex items-center gap-2">
              <Star className="size-4 text-primary" />
              <h3 className="text-base font-bold text-primary">Recommendation note</h3>
            </div>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                Keep <span className="font-semibold text-foreground">RTX 4080 Super</span> as
                the balanced option.
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                Choose <span className="font-semibold text-foreground">RTX 4070 Ti Super</span> if
                you want to lower the budget.
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                Pick <span className="font-semibold text-foreground">RTX 4090</span> only if you
                specifically want maximum performance.
              </li>
            </ul>
          </div>
        </section>

        <div className="flex justify-end">
          <Button asChild size="lg" className="rounded-xl shadow-glow">
            <Link to="/cart">
              View purchase references <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
        </div>
      </main>
    </div>
  );
}

function SummaryItem({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "default" | "success" | "warning";
}) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-3">
      <div className="mb-1 flex items-center gap-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        {icon}
        {label}
      </div>
      <p
        className={cn(
          "text-sm font-semibold",
          tone === "success" && "text-success",
          tone === "warning" && "text-warning",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function OptionCard({
  option,
  selected,
  onSelect,
}: {
  option: ComparableOption;
  selected: boolean;
  onSelect: () => void;
}) {
  const badge =
    option.tag === "budget"
      ? { cls: "bg-success/15 text-success border-success/30", label: "Best Value", icon: Star }
      : option.tag === "alt"
        ? {
            cls: "bg-warning/15 text-warning border-warning/30",
            label: "Highest Performance",
            icon: TrendingUp,
          }
        : {
            cls: "bg-primary/15 text-primary border-primary/30",
            label: "Recommended",
            icon: Sparkles,
          };
  const BadgeIcon = badge.icon;

  const stockTone =
    option.stock === "Ready"
      ? "text-success"
      : option.stock === "Low"
        ? "text-warning"
        : "text-destructive";

  return (
    <div
      className={cn(
        "relative flex flex-col gap-4 rounded-2xl border bg-card p-5 transition-all",
        selected
          ? "border-primary/60 bg-primary/[0.06] shadow-glow"
          : "border-border hover:border-primary/30",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
            badge.cls,
          )}
        >
          <BadgeIcon className="size-3" /> {badge.label}
        </span>
        {selected && (
          <Badge className="rounded-md border border-primary/40 bg-primary/15 text-[10px] text-primary">
            <Check className="mr-1 size-3" /> Currently Selected
          </Badge>
        )}
      </div>

      <div>
        <h3 className="text-base font-bold leading-tight">{option.name}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{option.reason}</p>
      </div>

      <div className="font-mono text-3xl font-bold">
        ${option.price.toLocaleString()}
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border pt-4 text-xs">
        <Spec label="Performance" value={`${option.perfScore}/100`} />
        <Spec label="VRAM" value={`${option.vramGb} GB`} />
        <Spec label="Power" value={`${option.powerW} W`} />
        <Spec label="Est. FPS" value={`${option.fps4k ?? "—"}`} />
        <Spec
          label="Stock"
          value={option.stock}
          valueClass={cn("font-semibold", stockTone)}
        />
        <Spec
          label="Compatible"
          value={option.compatible ? "Yes" : "Check"}
          valueClass={cn(
            "font-semibold",
            option.compatible ? "text-success" : "text-warning",
          )}
        />
      </dl>

      {!option.compatible && (
        <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-2 text-xs text-warning">
          <AlertTriangle className="mt-0.5 size-3 shrink-0" />
          Verify PSU + case clearance before adding.
        </div>
      )}

      <Button
        onClick={onSelect}
        variant={selected ? "default" : "secondary"}
        className="mt-auto rounded-lg"
      >
        {selected ? (
          <>
            <Check className="mr-2 size-4" /> Selected
          </>
        ) : (
          "Select this option"
        )}
      </Button>
    </div>
  );
}

function Spec({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-mono font-semibold", valueClass)}>{value}</span>
    </div>
  );
}

// silence unused import warnings for icons reserved for future variants
void Minus;
void TrendingDown;

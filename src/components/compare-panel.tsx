import { useMemo, useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ComparisonTable } from "@/components/comparison-table";
import {
  COMPARE_DATA,
  type ComparableOption,
} from "@/lib/parts-data";
import {
  Check,
  Star,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  Wallet,
  Cpu,
  MonitorPlay,
  X,
  Info,
} from "lucide-react";

export function ComparePanel({
  category,
  onClose,
  onConfirm,
}: {
  category: string;
  onClose?: () => void;
  onConfirm?: (msg: string) => void;
}) {
  const data = COMPARE_DATA[category];

  if (!data) {
    return (
      <section className="rounded-2xl border border-dashed border-border bg-card/60 p-8 text-center">
        <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Info className="size-5" />
        </div>
        <h3 className="text-lg font-bold">{category} comparison coming soon</h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          Alternative {category} options will appear here. For now this build's {category} is
          locked in as the recommended choice.
        </p>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose} className="mt-4 rounded-md">
            Close panel
          </Button>
        )}
      </section>
    );
  }

  return (
    <CompareBody
      key={category}
      category={category}
      data={data}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}

function CompareBody({
  category,
  data,
  onClose,
  onConfirm,
}: {
  category: string;
  data: (typeof COMPARE_DATA)[string];
  onClose?: () => void;
  onConfirm?: (msg: string) => void;
}) {
  const { options, metrics, originalId, goal } = data;
  const originalPrice = options.find((o) => o.id === originalId)!.price;
  const [selectedId, setSelectedId] = useState<string>(originalId);

  const selected = useMemo(
    () => options.find((o) => o.id === selectedId) ?? options[0],
    [options, selectedId],
  );
  const delta = selected.price - originalPrice;
  const changed = selected.id !== originalId;

  useEffect(() => {
    if (!changed || !onConfirm) return;
    const msg =
      delta < 0
        ? `Selected ${category} changed to ${selected.name}. Estimated total saves $${Math.abs(delta).toLocaleString()}.`
        : `Selected ${category} changed to ${selected.name}. Estimated total increases $${delta.toLocaleString()}.`;
    onConfirm(msg);
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section id="compare-panel" className="space-y-6 scroll-mt-20">
      {/* Header card visually connected to the selected row */}
      <div className="overflow-hidden rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/10 via-card to-card p-6 shadow-glow">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <Badge className="rounded-md border border-primary/40 bg-primary/15 text-primary">
              <Sparkles className="mr-1 size-3" /> Currently Comparing · {category}
            </Badge>
            <h2 className="text-2xl font-bold tracking-tight">
              {category} alternatives{" "}
              <span className="font-normal text-muted-foreground">/ 备选方案</span>
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <SummaryItem
                icon={category === "GPU" ? <MonitorPlay className="size-4 text-primary" /> : <Cpu className="size-4 text-primary" />}
                label="Current Selection"
                value={selected.name}
              />
              <SummaryItem
                icon={<Lightbulb className="size-4 text-primary" />}
                label="Customer Goal"
                value={goal}
              />
              <SummaryItem
                icon={<Wallet className="size-4 text-primary" />}
                label="Budget Impact"
                value={
                  delta === 0
                    ? "No change"
                    : delta < 0
                      ? `Saves $${Math.abs(delta).toLocaleString()}`
                      : `+$${delta.toLocaleString()} over original`
                }
                tone={delta <= 0 ? "success" : "warning"}
              />
              <SummaryItem
                icon={<Star className="size-4 text-primary" />}
                label="Recommendation"
                value="Best balance for performance and price"
              />
            </div>
          </div>
          {onClose && (
            <Button
              size="icon"
              variant="ghost"
              onClick={onClose}
              className="size-8 rounded-md text-muted-foreground"
              aria-label="Close comparison"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>

        {changed && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm">
            <div className="flex items-center gap-2">
              <Check className="size-4 text-primary" />
              <span>
                Selected {category} changed to{" "}
                <span className="font-semibold">{selected.name}</span>.{" "}
                <span className={cn("font-mono font-semibold", delta < 0 ? "text-success" : "text-warning")}>
                  {delta < 0
                    ? `Estimated total saves $${Math.abs(delta).toLocaleString()}`
                    : `Estimated total increases $${delta.toLocaleString()}`}
                </span>
              </span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedId(originalId)}
              className="rounded-md text-xs text-muted-foreground"
            >
              Reset
            </Button>
          </div>
        )}
      </div>

      {/* Side-by-side option cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {options.map((o) => (
          <OptionCard
            key={o.id}
            option={o}
            selected={o.id === selectedId}
            onSelect={() => setSelectedId(o.id)}
          />
        ))}
      </div>

      {/* Parameter comparison table */}
      <ComparisonTable
        options={options}
        metrics={metrics}
        selectedId={selectedId}
        onSelect={setSelectedId}
        title={`${category} parameter comparison`}
        subtitle="Green = better · Orange = worse · Gray = similar · Blue = currently selected."
      />

      {/* Beginner + employee notes */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Lightbulb className="size-4 text-primary" />
            <h3 className="text-sm font-bold">How to explain this to a beginner customer</h3>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{selected.beginnerNote}</p>
        </div>
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Star className="size-4 text-primary" />
            <h3 className="text-sm font-bold text-primary">Employee sales note</h3>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">{selected.salesNote}</p>
        </div>
      </div>
    </section>
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
        ? { cls: "bg-warning/15 text-warning border-warning/30", label: "Highest Performance", icon: TrendingUp }
        : { cls: "bg-primary/15 text-primary border-primary/30", label: "Recommended", icon: Sparkles };
  const BadgeIcon = badge.icon;

  const stockTone =
    option.stock === "Ready" ? "text-success" : option.stock === "Low" ? "text-warning" : "text-destructive";

  return (
    <div
      className={cn(
        "relative flex flex-col gap-4 rounded-2xl border bg-card p-5 transition-all",
        selected ? "border-primary/60 bg-primary/[0.06] shadow-glow" : "border-border hover:border-primary/30",
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

      <div className="font-mono text-2xl font-bold">${option.price.toLocaleString()}</div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border pt-4 text-xs">
        <Spec label="Performance" value={`${option.perfScore}/100`} />
        {option.vramGb !== undefined && <Spec label="VRAM" value={`${option.vramGb} GB`} />}
        <Spec label="Power" value={`${option.powerW} W`} />
        {option.fps4k !== undefined && <Spec label="Est. FPS" value={`${option.fps4k}`} />}
        <Spec label="Stock" value={option.stock} valueClass={cn("font-semibold", stockTone)} />
        <Spec
          label="Compatible"
          value={option.compatible ? "Yes" : "Check"}
          valueClass={cn("font-semibold", option.compatible ? "text-success" : "text-warning")}
        />
      </dl>

      {!option.compatible && (
        <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-2 text-xs text-warning">
          <AlertTriangle className="mt-0.5 size-3 shrink-0" />
          Needs a motherboard / PSU change before adding.
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

function Spec({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-mono font-semibold", valueClass)}>{value}</span>
    </div>
  );
}
import { Button } from "@/components/ui/button";
import {
  PRICE_HISTORY_RANGE_OPTIONS,
  createLatestPriceRequestGuard,
  createPriceChartPresentation,
  formatAvailability,
  formatCondition,
  formatObservationDate,
  formatPriceChange,
  formatShipping,
  formatUsdMinorUnits,
  getAccessibleTrendSummary,
  getPriceHistoryErrorPresentation,
  getPriceHistoryRequestKey,
  priceHistoryLoader,
} from "@/lib/price-trend";
import { cn } from "@/lib/utils";
import type { PriceHistoryRange, PriceHistoryResponse } from "@/types/pricing";
import { AlertTriangle, BarChart3, RefreshCw } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

type PriceTrendLoadState =
  | { key: string; status: "loading" }
  | { key: string; status: "error"; error: unknown }
  | { key: string; status: "success"; response: PriceHistoryResponse };

export function PriceTrendPanel({ partId, partName }: { partId: string; partName: string }) {
  const [range, setRange] = useState<PriceHistoryRange>("30d");
  const currentKey = getPriceHistoryRequestKey(partId, range);
  const [loadState, setLoadState] = useState<PriceTrendLoadState>({
    key: currentKey,
    status: "loading",
  });
  const [requestVersion, setRequestVersion] = useState(0);
  const requestGuard = useRef(createLatestPriceRequestGuard());
  const forceRefresh = useRef(false);

  useEffect(() => {
    const guard = requestGuard.current;
    const token = guard.begin(partId, range);
    const refresh = forceRefresh.current;
    forceRefresh.current = false;
    setLoadState({ key: token.key, status: "loading" });

    void priceHistoryLoader
      .load(partId, range, refresh)
      .then((response) => {
        if (guard.isCurrent(token)) {
          setLoadState({ key: token.key, status: "success", response });
        }
      })
      .catch((error: unknown) => {
        if (guard.isCurrent(token)) {
          setLoadState({ key: token.key, status: "error", error });
        }
      });

    return () => guard.invalidate();
  }, [partId, range, requestVersion]);

  const visibleState: PriceTrendLoadState =
    loadState.key === currentKey ? loadState : { key: currentKey, status: "loading" };

  return (
    <PriceTrendView
      partName={partName}
      range={range}
      state={visibleState}
      onRangeChange={setRange}
      onRetry={() => {
        forceRefresh.current = true;
        setRequestVersion((version) => version + 1);
      }}
    />
  );
}

export function PriceTrendView({
  partName,
  range,
  state,
  onRangeChange,
  onRetry,
}: {
  partName: string;
  range: PriceHistoryRange;
  state: PriceTrendLoadState;
  onRangeChange: (range: PriceHistoryRange) => void;
  onRetry: () => void;
}) {
  const chartTitleId = useId();

  return (
    <section
      className="surface-panel mt-4 min-w-0 rounded-2xl p-4 sm:p-5"
      aria-labelledby={`${chartTitleId}-heading`}
      aria-busy={state.status === "loading"}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-primary">
            <BarChart3 className="size-4 shrink-0" aria-hidden="true" />
            <h3 id={`${chartTitleId}-heading`} className="text-base font-semibold text-foreground">
              Price history
            </h3>
          </div>
          <p className="mt-1 break-words text-xs text-muted-foreground">Focused item: {partName}</p>
        </div>

        <div
          className="grid w-full grid-cols-3 rounded-xl border border-border bg-background/60 p-1 sm:w-auto"
          role="group"
          aria-label="Price history range"
        >
          {PRICE_HISTORY_RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-label={option.accessibleLabel}
              aria-pressed={range === option.value}
              className={cn(
                "min-w-0 rounded-lg px-3 py-2 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                range === option.value
                  ? "bg-primary/20 text-primary ring-1 ring-primary/35"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
              onClick={() => onRangeChange(option.value)}
            >
              {option.shortLabel}
            </button>
          ))}
        </div>
      </div>

      <div className={cn("mt-4", state.status === "loading" && "min-h-40")}>
        {state.status === "loading" ? (
          <PriceTrendLoadingState />
        ) : state.status === "error" ? (
          <PriceTrendErrorState error={state.error} onRetry={onRetry} />
        ) : (
          <PriceTrendSuccessState response={state.response} chartTitleId={chartTitleId} />
        )}
      </div>
    </section>
  );
}

function PriceTrendLoadingState() {
  return (
    <div className="space-y-3" role="status" aria-live="polite">
      <span className="sr-only">Loading price history</span>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-hidden="true">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-16 animate-pulse rounded-xl bg-primary/10" />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Loading development sample observations…</p>
    </div>
  );
}

function PriceTrendErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const presentation = getPriceHistoryErrorPresentation(error);

  return (
    <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-sm" role="alert">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">{presentation.title}</p>
          <p className="mt-1 text-muted-foreground">{presentation.message}</p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="mt-3 rounded-lg"
            onClick={onRetry}
          >
            <RefreshCw className="mr-2 size-3.5" aria-hidden="true" />
            Retry price history
          </Button>
        </div>
      </div>
    </div>
  );
}

function PriceTrendSuccessState({
  response,
  chartTitleId,
}: {
  response: PriceHistoryResponse;
  chartTitleId: string;
}) {
  if (response.observations.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-background/50 p-5 text-sm">
        <p className="font-semibold">No price observations</p>
        <p className="mt-1 text-muted-foreground">
          No price observations exist for this exact item in the selected range.
        </p>
        <PriceSourceDisclosure message={response.disclosure.message} />
      </div>
    );
  }

  const change = formatPriceChange(
    response.absolutePriceChangeMinor,
    response.percentagePriceChange,
    response.previousComparablePriceMinor,
  );
  const chart = createPriceChartPresentation(response.observations);
  const trendSummary = getAccessibleTrendSummary(response.observations);

  return (
    <div className="min-w-0 space-y-4">
      <PriceSourceDisclosure message={response.disclosure.message} />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        <SummaryField
          label={
            response.disclosure.isLive ? "Best comparable price" : "Best comparable sample price"
          }
          value={
            response.currentBest
              ? formatUsdMinorUnits(response.currentBest.effectivePreTaxPriceMinor)
              : "Not available"
          }
          emphasis
        />
        <SummaryField
          label="Retailer"
          value={response.currentBest?.retailerName ?? "No ranked retailer"}
        />
        <SummaryField
          label="Change"
          value={change.label}
          valueClass={
            change.direction === "decrease"
              ? "text-success"
              : change.direction === "increase"
                ? "text-warning"
                : undefined
          }
        />
        <SummaryField
          label="Range low / high"
          value={
            response.rangeLowMinor === null || response.rangeHighMinor === null
              ? "Not available"
              : `${formatUsdMinorUnits(response.rangeLowMinor)} / ${formatUsdMinorUnits(response.rangeHighMinor)}`
          }
        />
        <SummaryField
          label="Last observation"
          value={formatObservationDate(response.lastObservationAt)}
        />
        <SummaryField label="Observations" value={String(response.observationCount)} />
      </div>

      {!response.currentBest && (
        <p className="rounded-xl border border-warning/25 bg-warning/10 px-3 py-2 text-xs text-muted-foreground">
          No comparable price can be ranked. In-stock observations with unknown shipping and
          unavailable listings are excluded; missing shipping is never treated as free.
        </p>
      )}

      <details className="rounded-xl border border-border bg-background/55">
        <summary className="cursor-pointer rounded-xl px-4 py-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary">
          Show price chart and trend explanation
        </summary>
        <div className="border-t border-border p-3">
          <svg
            className="h-auto min-h-32 w-full"
            viewBox="0 0 100 48"
            preserveAspectRatio="none"
            role="img"
            aria-labelledby={`${chartTitleId}-chart-title ${chartTitleId}-chart-description`}
          >
            <title id={`${chartTitleId}-chart-title`}>Comparable sample price trend</title>
            <desc id={`${chartTitleId}-chart-description`}>{trendSummary}</desc>
            <line x1="6" x2="94" y1="42" y2="42" className="stroke-border" strokeWidth="0.5" />
            {chart.comparablePoints.length > 1 && (
              <polyline
                points={chart.polylinePoints}
                fill="none"
                className="stroke-primary"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
              />
            )}
            {chart.comparablePoints.map((point) => (
              <circle
                key={point.id}
                cx={point.x}
                cy={point.y}
                r="1.8"
                className="fill-primary stroke-background"
                strokeWidth="0.8"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {chart.unavailablePoints.map((point) =>
              point.kind === "unknown_shipping" ? (
                <circle
                  key={point.id}
                  cx={point.x}
                  cy={point.y}
                  r="1.8"
                  fill="none"
                  className="stroke-warning"
                  strokeWidth="1.2"
                  vectorEffect="non-scaling-stroke"
                />
              ) : (
                <g key={point.id} className="stroke-destructive" vectorEffect="non-scaling-stroke">
                  <line
                    x1={point.x - 1.5}
                    x2={point.x + 1.5}
                    y1={point.y - 1.5}
                    y2={point.y + 1.5}
                  />
                  <line
                    x1={point.x - 1.5}
                    x2={point.x + 1.5}
                    y1={point.y + 1.5}
                    y2={point.y - 1.5}
                  />
                </g>
              ),
            )}
          </svg>
          <p className="mt-2 text-xs text-muted-foreground">{trendSummary}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <span>● Comparable in-stock total</span>
            <span>○ In stock, shipping unknown</span>
            <span>× Unavailable / not rankable</span>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Observed samples are connected chronologically. Lines do not imply continuous price
            tracking between sparse observations.
          </p>
        </div>
      </details>

      <ObservationDetails response={response} />
    </div>
  );
}

function PriceSourceDisclosure({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-primary/25 bg-primary/10 px-3 py-2 text-xs">
      <p className="font-semibold text-foreground">
        Development sample data — not live retailer pricing.
      </p>
      <p className="mt-0.5 text-muted-foreground">{message}</p>
    </div>
  );
}

function SummaryField({
  label,
  value,
  emphasis = false,
  valueClass,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  valueClass?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-background/55 px-3 py-3">
      <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 break-words text-sm font-semibold",
          emphasis && "font-mono text-base text-primary",
          valueClass,
        )}
      >
        {value}
      </p>
    </div>
  );
}

function ObservationDetails({ response }: { response: PriceHistoryResponse }) {
  const observations = [...response.observations].sort(
    (left, right) => Date.parse(right.observedAt) - Date.parse(left.observedAt),
  );

  return (
    <details className="rounded-xl border border-border bg-background/45">
      <summary className="cursor-pointer rounded-xl px-4 py-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary">
        Observation details ({observations.length})
      </summary>
      <div className="overflow-x-auto border-t border-border">
        <table className="w-full min-w-[760px] text-left text-xs">
          <caption className="sr-only">
            Price observations for the focused exact catalog item, newest first
          </caption>
          <thead className="bg-secondary/60 text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                Date
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Retailer
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Item price
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Shipping
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Comparable total
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Availability
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Condition
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {observations.map((observation) => (
              <tr key={observation.id}>
                <td className="whitespace-nowrap px-3 py-2">
                  {formatObservationDate(observation.observedAt)}
                </td>
                <td className="max-w-48 break-words px-3 py-2 font-medium">
                  {observation.retailerName}
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-mono">
                  {formatUsdMinorUnits(observation.itemPriceMinor)}
                </td>
                <td className="max-w-52 px-3 py-2">{formatShipping(observation)}</td>
                <td className="whitespace-nowrap px-3 py-2 font-mono">
                  {observation.effectivePreTaxPriceMinor === null
                    ? "Not comparable"
                    : formatUsdMinorUnits(observation.effectivePreTaxPriceMinor)}
                </td>
                <td className="whitespace-nowrap px-3 py-2">{formatAvailability(observation)}</td>
                <td className="whitespace-nowrap px-3 py-2">{formatCondition(observation)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

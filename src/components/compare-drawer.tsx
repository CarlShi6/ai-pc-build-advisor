import { categoryLabels } from "@/data/seedParts";
import {
  getCompatibilityNotesForPart,
  getPartPowerRequirement,
  getPartSummarySpecs,
} from "@/lib/build-advisor";
import { calculateBuildTotal, deriveCompatibilityStatus, evaluateCompatibility } from "@/lib/compatibility";
import { cn } from "@/lib/utils";
import type { Build } from "@/types/build";
import type { Part } from "@/types/parts";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowRightLeft, Check, LoaderCircle, Sparkles } from "lucide-react";

function formatMoney(value: number) {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function buildCandidate(build: Build, replacement: Part) {
  const parts = build.parts.map((part) => (part.category === replacement.category ? replacement : part));
  const candidate: Build = {
    ...build,
    parts,
    totalPrice: calculateBuildTotal(parts),
    compatibilityWarnings: [],
    compatibilityStatus: "pass",
  };
  const warnings = evaluateCompatibility(candidate);

  return {
    ...candidate,
    compatibilityWarnings: warnings,
    compatibilityStatus: deriveCompatibilityStatus(warnings),
  };
}

export function CompareDrawer({
  build,
  category,
  parts,
  open,
  isLoading,
  isReplacing,
  errorMessage,
  recommendedReplacementId,
  onOpenChange,
  onReplace,
}: {
  build: Build | null;
  category: string | null;
  parts: Part[];
  open: boolean;
  isLoading?: boolean;
  isReplacing?: boolean;
  errorMessage?: string | null;
  recommendedReplacementId?: string | null;
  onOpenChange: (open: boolean) => void;
  onReplace: (part: Part) => void;
}) {
  if (!build || !category) {
    return null;
  }

  const selectedPart = build.parts.find((part) => part.category === category);

  if (!selectedPart) {
    return null;
  }

  const alternatives = parts.filter((part) => part.id !== selectedPart.id);
  const sectionTitle = categoryLabels[selectedPart.category];

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto flex max-h-[88vh] w-full max-w-6xl flex-col rounded-t-[28px] border-primary/20 bg-background">
        <DrawerHeader className="border-b border-border px-6 pb-5 pt-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <Badge className="w-fit rounded-md border border-primary/30 bg-primary/10 text-primary">
                <ArrowRightLeft className="mr-1 size-3" /> Compare {sectionTitle}
              </Badge>
              <div>
                <DrawerTitle className="text-2xl">{selectedPart.displayName}</DrawerTitle>
                <DrawerDescription className="mt-1 max-w-2xl">
                  Review the current selected part, compare mock alternatives in the same category,
                  and replace it without leaving the consultation flow.
                </DrawerDescription>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Current total</p>
              <p className="font-mono text-2xl font-bold text-primary">{formatMoney(build.totalPrice)}</p>
            </div>
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-4 pt-6">
          <section className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Current Selection</p>
                <h3 className="mt-1 text-xl font-bold">{selectedPart.displayName}</h3>
              </div>
              <Badge className="rounded-md border border-primary/30 bg-primary/15 text-primary">
                <Check className="mr-1 size-3" /> In build now
              </Badge>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.1fr_1.4fr]">
              <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
                <InfoRow label="Price" value={formatMoney(selectedPart.price)} />
                <InfoRow label="Power requirement" value={getPartPowerRequirement(selectedPart)} />
                <InfoRow
                  label="Recommendation reason"
                  value={selectedPart.recommendationReason ?? "Chosen for balance in this mock build."}
                />
              </div>
              <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Key specs</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {getPartSummarySpecs(selectedPart).map((spec) => (
                      <span key={spec} className="rounded-md border border-border bg-background/60 px-2.5 py-1 text-xs">
                        {spec}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Compatibility notes</p>
                  <div className="mt-2 space-y-2">
                    {getCompatibilityNotesForPart(build, selectedPart).map((note) => (
                      <p key={note} className="rounded-xl border border-border bg-background/60 px-3 py-2 text-sm text-muted-foreground">
                        {note}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="mt-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold">Alternative {sectionTitle} options</h3>
                <p className="text-sm text-muted-foreground">
                  Each card shows price, key specs, compatibility impact, and the recommendation reason.
                </p>
              </div>
              <Badge variant="secondary" className="rounded-md">
                {Math.max(alternatives.length, 0)} alternatives
              </Badge>
            </div>

            {recommendedReplacementId && (
              <div className="rounded-2xl border border-success/25 bg-success/10 px-4 py-3 text-sm text-success">
                A recommended fix is highlighted below because it resolves the currently selected compatibility issue.
              </div>
            )}

            {isLoading ? (
              <div className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 p-8 text-sm text-muted-foreground">
                <LoaderCircle className="mr-2 size-4 animate-spin" />
                Loading {sectionTitle.toLowerCase()} alternatives
              </div>
            ) : errorMessage ? (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
                {errorMessage}
              </div>
            ) : parts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-sm text-muted-foreground">
                No {sectionTitle.toLowerCase()} options are available in the current local mock data yet.
              </div>
            ) : alternatives.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-sm text-muted-foreground">
                This build only has one {sectionTitle.toLowerCase()} option right now, so there is nothing else to compare.
              </div>
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {alternatives.map((part) => {
                  const candidateBuild = buildCandidate(build, part);
                  const delta = part.price - selectedPart.price;
                  const notes = getCompatibilityNotesForPart(candidateBuild, part);
                  const isRecommendedFix = part.id === recommendedReplacementId;

                  return (
                    <article
                      key={part.id}
                      className={cn(
                        "flex h-full flex-col rounded-2xl border p-5 transition-colors",
                        isRecommendedFix
                          ? "border-success/40 bg-success/[0.06]"
                          : "border-border bg-card hover:border-primary/30",
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-lg font-bold">{part.displayName}</h4>
                            {isRecommendedFix && (
                              <Badge className="rounded-md border border-success/30 bg-success/15 text-success">
                                <Sparkles className="mr-1 size-3" /> Recommended fix
                              </Badge>
                            )}
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {part.recommendationReason ?? "Alternative configured in the local mock catalog."}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-2xl font-bold">{formatMoney(part.price)}</p>
                          <p className={cn("text-xs", delta <= 0 ? "text-success" : "text-warning")}>
                            {delta === 0
                              ? "No price change"
                              : delta < 0
                              ? `${formatMoney(Math.abs(delta))} cheaper`
                              : `${formatMoney(delta)} more`}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {getPartSummarySpecs(part).map((spec) => (
                          <span key={spec} className="rounded-md border border-border bg-background/60 px-2.5 py-1 text-xs">
                            {spec}
                          </span>
                        ))}
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <InfoRow
                          label="Price difference"
                          value={
                            delta === 0
                              ? "No change"
                              : delta < 0
                                ? `-${formatMoney(Math.abs(delta))}`
                                : `+${formatMoney(delta)}`
                          }
                          valueClass={delta <= 0 ? "text-success" : "text-warning"}
                        />
                        <InfoRow label="Power requirement" value={getPartPowerRequirement(part)} />
                        <InfoRow
                          label="Compatibility status"
                          value={
                            candidateBuild.compatibilityStatus === "pass"
                              ? "Pass"
                              : candidateBuild.compatibilityStatus === "warning"
                                ? "Warning"
                                : "Fail"
                          }
                          valueClass={
                            candidateBuild.compatibilityStatus === "pass"
                              ? "text-success"
                              : candidateBuild.compatibilityStatus === "warning"
                                ? "text-warning"
                                : "text-destructive"
                          }
                        />
                        <InfoRow label="Build total after swap" value={formatMoney(candidateBuild.totalPrice)} />
                      </div>

                      <div className="mt-4 rounded-2xl border border-border bg-background/60 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Compatibility notes</p>
                        <div className="mt-2 space-y-2">
                          {notes.map((note) => (
                            <p key={note} className="text-sm text-muted-foreground">
                              {note}
                            </p>
                          ))}
                        </div>
                        {candidateBuild.compatibilityWarnings.length > 0 && (
                          <div className="mt-3 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
                            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                            <span>
                              {candidateBuild.compatibilityWarnings.length} compatibility item
                              {candidateBuild.compatibilityWarnings.length === 1 ? "" : "s"} would remain after this swap.
                            </span>
                          </div>
                        )}
                      </div>

                      <Button
                        className="mt-4 rounded-xl"
                        variant={isRecommendedFix ? "default" : "secondary"}
                        disabled={Boolean(isReplacing)}
                        onClick={() => onReplace(part)}
                      >
                        {isReplacing
                          ? "Replacing part..."
                          : isRecommendedFix
                            ? "Replace with this recommended part"
                            : "Replace with this part"}
                      </Button>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <DrawerFooter className="border-t border-border px-6 py-4 sm:flex-row sm:justify-end">
          <Button variant="ghost" className="rounded-xl" onClick={() => onOpenChange(false)}>
            Close compare drawer
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

function InfoRow({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-background/60 px-3 py-3">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-sm font-medium", valueClass)}>{value}</p>
    </div>
  );
}

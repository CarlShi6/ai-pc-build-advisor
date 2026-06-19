import { UpgradeCard } from "@/components/UpgradeCard";
import { formatUpgradeMessage } from "@/lib/monetization";
import type { FeatureKey } from "@/types/monetization";
import { LockKeyhole } from "lucide-react";

export function ProFeatureLock({
  feature = "advanced_compare",
  label = "Build Pro feature",
  showUpgrade = true,
  onUpgraded,
}: {
  feature?: FeatureKey;
  label?: string;
  showUpgrade?: boolean;
  onUpgraded?: () => void;
}) {
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border border-primary/20 bg-background text-primary">
          <LockKeyhole className="size-3.5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-primary">{label}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {formatUpgradeMessage(feature)}
          </p>
        </div>
      </div>
      {showUpgrade && <UpgradeCard className="mt-3" compact onUpgraded={onUpgraded} />}
    </div>
  );
}

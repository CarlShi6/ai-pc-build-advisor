import { getRemainingAiQuestions, getRemainingReplacements } from "@/lib/monetization";
import { cn } from "@/lib/utils";
import type { UsageStatus } from "@/types/monetization";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

export function UsageBadge({
  usage,
  className,
}: {
  usage?: UsageStatus | null;
  className?: string;
}) {
  if (!usage) {
    return (
      <Badge variant="secondary" className={cn("rounded-md", className)}>
        <Sparkles className="mr-1 size-3" /> Loading usage
      </Badge>
    );
  }

  const remaining = getRemainingAiQuestions(usage);
  const replacements = getRemainingReplacements(usage);
  const text =
    usage.plan === "build_pro"
      ? `${remaining} AI questions and ${replacements} replacements left`
      : `${remaining} AI questions today and ${replacements} swaps left`;

  return (
    <Badge
      className={cn(
        "rounded-md border border-primary/25 bg-primary/10 text-primary",
        (remaining === 0 || replacements === 0) && "border-warning/30 bg-warning/10 text-warning",
        className,
      )}
    >
      <Sparkles className="mr-1 size-3" />
      {usage.plan === "build_pro" ? "Build Pro active: " : ""}
      {text}
    </Badge>
  );
}

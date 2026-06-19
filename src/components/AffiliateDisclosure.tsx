import { Info } from "lucide-react";

export function AffiliateDisclosure() {
  return (
    <div className="inline-flex items-start gap-2 rounded-xl border border-border bg-background/70 px-3 py-2 text-xs text-muted-foreground">
      <Info className="mt-0.5 size-3.5 shrink-0 text-primary" />
      <span>Some links may earn us a commission at no extra cost to you.</span>
    </div>
  );
}

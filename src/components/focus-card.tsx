import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, GitCompare } from "lucide-react";

export type FocusPart = {
  category: string;
  name: string;
  tagline: string;
  priorities: string[];
  whyItMatters: string;
};

export function FocusCard({
  part,
  onCompare,
}: {
  part: FocusPart;
  onCompare?: () => void;
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/15 via-card to-card p-6 shadow-glow">
      <div className="pointer-events-none absolute -right-20 -top-20 size-56 rounded-full bg-primary/20 blur-3xl" />
      <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-3">
          <Badge className="rounded-md border border-primary/40 bg-primary/15 text-primary">
            <Eye className="mr-1 size-3" /> Currently Viewing · {part.category}
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight">{part.name}</h2>
          <p className="max-w-xl text-sm text-muted-foreground">{part.tagline}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            {part.priorities.map((p) => (
              <span
                key={p}
                className="rounded-md border border-border bg-background/50 px-2.5 py-1 text-xs font-medium"
              >
                {p}
              </span>
            ))}
          </div>
          <p className="max-w-xl rounded-md border border-border bg-background/50 p-3 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Why this matters: </span>
            {part.whyItMatters}
          </p>
        </div>
        {onCompare && (
          <Button
            onClick={onCompare}
            size="lg"
            className="shrink-0 rounded-xl shadow-glow"
          >
            <GitCompare className="mr-2 size-4" /> Compare {part.category} options
          </Button>
        )}
      </div>
    </section>
  );
}
import { createFileRoute, Link } from "@tanstack/react-router";
import { TopBar } from "@/components/top-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, Cpu, GitCompare, ShoppingBag, Sparkles } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Saved Builds - AI PC Build Advisor" },
      { name: "description", content: "Saved mock PC build recommendations and comparison activity." },
    ],
  }),
  component: DashboardPage,
});

const STATS = [
  { label: "Saved Builds", value: "4", change: "+1", icon: Cpu },
  { label: "Parts Compared", value: "18", change: "+6", icon: GitCompare },
  { label: "Reference Lists", value: "3", change: "+2", icon: ShoppingBag },
];

const RECENT = [
  { id: "PC-22341", build: "Production Master Pro", useCase: "4K editing + gaming", total: "$2,783", status: "Ready" },
  { id: "PC-22340", build: "Streamer Starter", useCase: "Streaming + 1440p", total: "$1,420", status: "Review" },
  { id: "PC-22339", build: "Esports Lite", useCase: "High-FPS esports", total: "$980", status: "Ready" },
  { id: "PC-22338", build: "Workstation X", useCase: "AI + rendering", total: "$4,210", status: "Compare" },
];

function DashboardPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopBar />
      <main className="mx-auto max-w-6xl space-y-8 px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Badge className="mb-2 rounded-sm bg-primary/10 text-primary">
              <Sparkles className="mr-1 size-3" /> Buyer workspace
            </Badge>
            <h1 className="text-3xl font-bold tracking-tight">Saved Builds</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Review saved recommendations, comparison activity, and mock purchase references.
            </p>
          </div>
          <Button asChild className="rounded-xl shadow-glow">
            <Link to="/consult">Open Advisor</Link>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {STATS.map(({ label, value, change, icon: Icon }) => (
            <div key={label} className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-start justify-between">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </div>
                <span className="inline-flex items-center gap-1 text-xs text-success">
                  <ArrowUpRight className="size-3" /> {change}
                </span>
              </div>
              <div className="mt-6">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
                <p className="mt-1 font-mono text-3xl font-bold">{value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="border-b border-border p-4 font-semibold">Recent Build Drafts</div>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-6 py-3 font-medium">Build Ref</th>
                <th className="px-6 py-3 font-medium">Build</th>
                <th className="px-6 py-3 font-medium">Use Case</th>
                <th className="px-6 py-3 font-medium">Total</th>
                <th className="px-6 py-3 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {RECENT.map((row) => (
                <tr key={row.id}>
                  <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{row.id}</td>
                  <td className="px-6 py-4">{row.build}</td>
                  <td className="px-6 py-4">{row.useCase}</td>
                  <td className="px-6 py-4 font-mono">{row.total}</td>
                  <td className="px-6 py-4 text-right">
                    <Badge
                      className={
                        row.status === "Ready"
                          ? "bg-success/15 text-success"
                          : row.status === "Review"
                            ? "bg-warning/15 text-warning"
                            : "bg-primary/15 text-primary"
                      }
                    >
                      {row.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

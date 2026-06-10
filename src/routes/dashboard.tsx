import { createFileRoute } from "@tanstack/react-router";
import { TopBar } from "@/components/top-bar";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, DollarSign, ShoppingBag, Users } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Store Dashboard — AI装机助手" },
      { name: "description", content: "Store employee dashboard with sales and consultation metrics." },
    ],
  }),
  component: DashboardPage,
});

const STATS = [
  { label: "Sales Today", value: "$18,420", change: "+12.4%", icon: DollarSign },
  { label: "Consultations", value: "47", change: "+6", icon: Users },
  { label: "Orders Placed", value: "9", change: "+2", icon: ShoppingBag },
];

const RECENT = [
  { id: "OD-22341", customer: "Wang J.", build: "Production Master Pro", total: "$2,783", status: "READY" },
  { id: "OD-22340", customer: "Liu M.", build: "Streamer Starter", total: "$1,420", status: "PENDING" },
  { id: "OD-22339", customer: "Chen H.", build: "Esports Lite", total: "$980", status: "READY" },
  { id: "OD-22338", customer: "Zhao K.", build: "Workstation X", total: "$4,210", status: "ASSEMBLING" },
];

function DashboardPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopBar />
      <main className="mx-auto max-w-6xl space-y-8 px-6 py-10">
        <div>
          <Badge className="mb-2 rounded-sm bg-primary/10 text-primary">Employee #ST-9421</Badge>
          <h1 className="text-3xl font-bold tracking-tight">Store Dashboard</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Today's consultations, orders, and sales performance at a glance.
          </p>
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
          <div className="border-b border-border p-4 font-semibold">Recent Orders</div>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-6 py-3 font-medium">Order</th>
                <th className="px-6 py-3 font-medium">Customer</th>
                <th className="px-6 py-3 font-medium">Build</th>
                <th className="px-6 py-3 font-medium">Total</th>
                <th className="px-6 py-3 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {RECENT.map((r) => (
                <tr key={r.id}>
                  <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{r.id}</td>
                  <td className="px-6 py-4">{r.customer}</td>
                  <td className="px-6 py-4">{r.build}</td>
                  <td className="px-6 py-4 font-mono">{r.total}</td>
                  <td className="px-6 py-4 text-right">
                    <Badge
                      className={
                        r.status === "READY"
                          ? "bg-success/15 text-success"
                          : r.status === "PENDING"
                            ? "bg-warning/15 text-warning"
                            : "bg-primary/15 text-primary"
                      }
                    >
                      {r.status}
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
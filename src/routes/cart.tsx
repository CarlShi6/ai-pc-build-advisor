import { createFileRoute } from "@tanstack/react-router";
import { TopBar } from "@/components/top-bar";
import { SAMPLE_BUILD } from "@/components/build-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Check, Cpu, Gauge, MonitorPlay, ShieldCheck, Star, TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Cart Execution — AI装机助手" },
      { name: "description", content: "Pre-cart checklist and purchase entry workflow." },
    ],
  }),
  component: CartPage,
});

const CHECKLIST = [
  "Confirm customer budget and use case",
  "Verify in-store stock for each part",
  "Apply employee discount / promo",
  "Print part list & quote for customer",
  "Schedule assembly slot",
];

function CartPage() {
  const total = SAMPLE_BUILD.reduce((s, p) => s + p.price, 0);
  const cpu = SAMPLE_BUILD.find((p) => p.category === "CPU")!;
  const gpu = SAMPLE_BUILD.find((p) => p.category === "GPU")!;
  const [checked, setChecked] = useState<Set<number>>(new Set([0, 1]));
  const toggle = (i: number) => {
    setChecked((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopBar />
      <main className="mx-auto max-w-6xl space-y-6 px-6 py-6">
        {/* Selected Build Summary — compact strip */}
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex flex-wrap items-stretch gap-0 divide-y divide-border md:divide-y-0 md:divide-x">
            {/* CPU */}
            <div className="flex flex-1 basis-[200px] items-center gap-3 p-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary/60 text-primary">
                <Cpu className="size-4.5" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    CPU
                  </span>
                  <Badge className="rounded-md bg-primary/10 px-1.5 py-0 text-[10px] font-medium text-primary">
                    Currently Selected
                  </Badge>
                  <Badge className="rounded-md bg-success/10 px-1.5 py-0 text-[10px] font-medium text-success">
                    <Star className="mr-0.5 size-2.5" /> Main Rec
                  </Badge>
                </div>
                <p className="mt-0.5 truncate text-sm font-semibold">{cpu.name}</p>
              </div>
            </div>

            {/* GPU — highlighted */}
            <div className="flex flex-1 basis-[200px] items-center gap-3 bg-primary/[0.04] p-4 outline outline-1 -outline-offset-1 outline-primary/20">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                <MonitorPlay className="size-4.5" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    GPU
                  </span>
                  <Badge className="rounded-md bg-primary/10 px-1.5 py-0 text-[10px] font-medium text-primary">
                    Currently Selected
                  </Badge>
                </div>
                <p className="mt-0.5 truncate text-sm font-semibold">{gpu.name}</p>
              </div>
            </div>

            {/* Compatibility */}
            <div className="flex flex-1 basis-[160px] items-center gap-3 p-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-success/30 bg-success/10 text-success">
                <ShieldCheck className="size-4.5" />
              </span>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Compatibility
                </p>
                <p className="mt-0.5 text-sm font-semibold text-success">All Passed</p>
              </div>
            </div>

            {/* Stock */}
            <div className="flex flex-1 basis-[160px] items-center gap-3 p-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-warning/30 bg-warning/10 text-warning">
                <Gauge className="size-4.5" />
              </span>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Stock
                </p>
                <p className="mt-0.5 text-sm font-semibold text-warning">1 Low-stock Alt</p>
              </div>
            </div>

            {/* Total */}
            <div className="flex basis-[160px] flex-col items-start justify-center p-4 md:items-end">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Total
              </p>
              <p className="font-mono text-xl font-bold text-primary">
                ${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* Warning / Value badges */}
          <div className="flex flex-wrap gap-2 border-t border-border bg-background/40 px-4 py-2.5">
            <Badge className="rounded-md border border-warning/20 bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
              <TrendingUp className="mr-1 size-3" />
              RTX 4090 alt is $800 more expensive
            </Badge>
            <Badge className="rounded-md border border-success/20 bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
              <TrendingDown className="mr-1 size-3" />
              RTX 4070 Ti Super saves $200 with similar 1440p performance
            </Badge>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <section className="space-y-5">
            <div>
              <Badge className="mb-1.5 rounded-sm bg-primary/10 text-primary">Step 2 of 3</Badge>
              <h2 className="text-2xl font-bold tracking-tight">Cart Execution</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Review purchase entries and complete the pre-cart checklist before placing the order.
              </p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="border-b border-border p-4 font-semibold">Purchase Entry List</div>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-6 py-3 font-medium">SKU</th>
                    <th className="px-6 py-3 font-medium">Part</th>
                    <th className="px-6 py-3 font-medium">Vendor</th>
                    <th className="px-6 py-3 text-right font-medium">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {SAMPLE_BUILD.map((p, i) => (
                    <tr key={p.category}>
                      <td className="px-6 py-4 font-mono text-xs text-muted-foreground">
                        SKU-{(1000 + i).toString()}
                      </td>
                      <td className="px-6 py-4">{p.name}</td>
                      <td className="px-6 py-4 text-muted-foreground">Newegg B2B</td>
                      <td className="px-6 py-4 text-right font-mono">${p.price.toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={3} className="px-6 py-4 text-right text-sm font-semibold">
                      Total
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-lg font-bold text-primary">
                      ${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <aside className="space-y-5">
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="mb-3 text-base font-semibold">Pre-Cart Checklist</h3>
              <ul className="space-y-2">
                {CHECKLIST.map((item, i) => {
                  const isOn = checked.has(i);
                  return (
                    <li key={item}>
                      <button
                        onClick={() => toggle(i)}
                        className="flex w-full items-center gap-3 rounded-xl border border-border bg-background/50 p-3 text-left text-sm transition-colors hover:border-primary/40"
                      >
                        <span
                          className={`flex size-5 items-center justify-center rounded-md border ${
                            isOn
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border"
                          }`}
                        >
                          {isOn && <Check className="size-3" />}
                        </span>
                        <span className={isOn ? "text-muted-foreground line-through" : ""}>
                          {item}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
              <h3 className="mb-3 text-base font-bold text-primary">Employee Summary</h3>
              <dl className="grid grid-cols-2 gap-y-3 text-sm">
                <dt className="text-muted-foreground">Order ID</dt>
                <dd className="text-right font-mono">#OD-22341</dd>
                <dt className="text-muted-foreground">Margin</dt>
                <dd className="text-right font-mono">$342.10</dd>
                <dt className="text-muted-foreground">Commission</dt>
                <dd className="text-right font-mono">$48.20</dd>
                <dt className="text-muted-foreground">Stock</dt>
                <dd className="text-right font-semibold text-success">READY</dd>
              </dl>
              <Button className="mt-5 w-full rounded-xl py-5 shadow-glow">Place Order</Button>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

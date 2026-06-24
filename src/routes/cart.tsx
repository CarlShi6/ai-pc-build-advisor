import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TopBar } from "@/components/top-bar";
import { AffiliateDisclosure } from "@/components/AffiliateDisclosure";
import { ProFeatureLock } from "@/components/ProFeatureLock";
import { UpgradeCard } from "@/components/UpgradeCard";
import { recommendedBuildPartIds, seedParts } from "@/data/seedParts";
import { getEntitlementStatus, trackAffiliateClick } from "@/lib/apiClient";
import { getPlanForEntitlement, canUseFeature } from "@/lib/monetization";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AffiliateLink, Entitlement } from "@/types/monetization";
import type { Part } from "@/types/parts";
import { Check, ClipboardList, Cpu, MonitorPlay, ShieldCheck, ShoppingBag, Star } from "lucide-react";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Purchase References - AI PC Build Advisor" },
      { name: "description", content: "Mock purchase reference list for a recommended PC build." },
    ],
  }),
  component: CartPage,
});

const CHECKLIST = [
  "Confirm CPU and motherboard socket compatibility",
  "Confirm RAM type",
  "Confirm PSU wattage",
  "Confirm GPU clearance",
  "Confirm case and cooler fit",
  "Confirm storage slots",
  "Confirm Windows/license plan",
  "Confirm monitor resolution target",
];

const purchaseParts = Object.entries(recommendedBuildPartIds)
  .map(([, id]) => seedParts.find((part) => part.id === id))
  .filter((part): part is Part => Boolean(part));

function CartPage() {
  const total = purchaseParts.reduce((sum, part) => sum + part.price, 0);
  const cpu = purchaseParts.find((part) => part.category === "cpu")!;
  const gpu = purchaseParts.find((part) => part.category === "gpu")!;
  const [checked, setChecked] = useState<Set<number>>(new Set([0, 2]));
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const plan = getPlanForEntitlement(entitlement);
  const hasPurchaseChecklist = canUseFeature(plan, "purchase_checklist");

  useEffect(() => {
    void refreshEntitlement();
  }, []);

  async function refreshEntitlement() {
    try {
      setEntitlement(await getEntitlementStatus());
    } catch {
      setEntitlement({
        userId: "mock-guest-session",
        plan: "free",
        active: true,
        startedAt: new Date().toISOString(),
      });
    }
  }

  function toggle(index: number) {
    if (!hasPurchaseChecklist) {
      return;
    }

    setChecked((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  async function handleAffiliateClick(part: Part, link: AffiliateLink) {
    await trackAffiliateClick({
      partId: part.id,
      merchant: link.merchant,
      url: link.url,
      buildId: "build-production-master-pro",
    });
    window.open(link.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopBar />
      <main className="mx-auto max-w-6xl space-y-6 px-6 py-6">
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex flex-wrap items-stretch gap-0 divide-y divide-border md:divide-y-0 md:divide-x">
            <BuildStripItem icon={<Cpu className="size-4.5" />} label="CPU" value={cpu.displayName} />
            <BuildStripItem icon={<MonitorPlay className="size-4.5" />} label="GPU" value={gpu.displayName} highlight />
            <BuildStripItem icon={<ShieldCheck className="size-4.5" />} label="Compatibility" value="All passed" success />
            <div className="flex basis-[170px] flex-col items-start justify-center p-4 md:items-end">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Estimated total
              </p>
              <p className="font-mono text-xl font-bold text-primary">
                ${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <section className="space-y-5">
            <div>
              <Badge className="mb-1.5 rounded-sm bg-primary/10 text-primary">Mock references</Badge>
              <h2 className="text-2xl font-bold tracking-tight">Purchase Reference List</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Use this as a planning list only. Prices and availability are mock data, not live checkout.
              </p>
              <div className="mt-3">
                <AffiliateDisclosure />
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="border-b border-border p-4 font-semibold">Parts to Check</div>
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-6 py-3 font-medium">Reference</th>
                    <th className="px-6 py-3 font-medium">Part</th>
                    <th className="px-6 py-3 font-medium">Retailer</th>
                    <th className="px-6 py-3 text-right font-medium">Estimated Price</th>
                    <th className="px-6 py-3 text-right font-medium">Deal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {purchaseParts.map((part, index) => (
                    <tr key={part.id}>
                      <td className="px-6 py-4 font-mono text-xs text-muted-foreground">
                        REF-{(1000 + index).toString()}
                      </td>
                      <td className="px-6 py-4">{part.displayName}</td>
                      <td className="px-6 py-4 text-muted-foreground">{part.retailer ?? "Partner retailer"}</td>
                      <td className="px-6 py-4 text-right font-mono">${part.price.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right">
                        {(part.affiliateLinks ?? []).slice(0, 1).map((link) => (
                          <Button
                            key={`${part.id}-${link.merchant}`}
                            size="sm"
                            variant="secondary"
                            className="rounded-md"
                            onClick={() => void handleAffiliateClick(part, link)}
                          >
                            {link.label ?? "View deal"}
                          </Button>
                        ))}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-right text-sm font-semibold">
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
              <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
                <ClipboardList className="size-4 text-primary" /> Buyer Checklist
              </h3>
              {hasPurchaseChecklist ? (
                <ul className="space-y-2">
                  {CHECKLIST.map((item, index) => {
                    const isOn = checked.has(index);
                    return (
                      <li key={item}>
                        <button
                          onClick={() => toggle(index)}
                          className="flex w-full items-center gap-3 rounded-xl border border-border bg-background/50 p-3 text-left text-sm transition-colors hover:border-primary/40"
                        >
                          <span
                            className={`flex size-5 items-center justify-center rounded-md border ${
                              isOn ? "border-primary bg-primary text-primary-foreground" : "border-border"
                            }`}
                          >
                            {isOn && <Check className="size-3" />}
                          </span>
                          <span className={isOn ? "text-muted-foreground line-through" : ""}>{item}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-2">
                    {CHECKLIST.slice(0, 4).map((item) => (
                      <div
                        key={item}
                        className="rounded-xl border border-border bg-background/40 p-3 text-sm text-muted-foreground"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                  <ProFeatureLock
                    feature="purchase_checklist"
                    label="Full purchase checklist"
                    onUpgraded={() => void refreshEntitlement()}
                  />
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
              <h3 className="mb-3 flex items-center gap-2 text-base font-bold text-primary">
                <ShoppingBag className="size-4" /> Reference Summary
              </h3>
              <dl className="grid grid-cols-2 gap-y-3 text-sm">
                <dt className="text-muted-foreground">Build Ref</dt>
                <dd className="text-right font-mono">#PC-22341</dd>
                <dt className="text-muted-foreground">Budget Room</dt>
                <dd className="text-right font-mono">$342.10</dd>
                <dt className="text-muted-foreground">Items</dt>
                <dd className="text-right font-mono">{purchaseParts.length}</dd>
                <dt className="text-muted-foreground">Compatibility</dt>
                <dd className="text-right font-semibold text-success">Ready</dd>
              </dl>
              {plan === "build_pro" ? (
                <Button className="mt-5 w-full rounded-xl py-5 shadow-glow">Save Reference List</Button>
              ) : (
                <UpgradeCard className="mt-5" compact onUpgraded={() => void refreshEntitlement()} />
              )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function BuildStripItem({
  icon,
  label,
  value,
  highlight,
  success,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
  success?: boolean;
}) {
  return (
    <div className={highlight ? "flex flex-1 basis-[220px] items-center gap-3 bg-primary/[0.04] p-4" : "flex flex-1 basis-[220px] items-center gap-3 p-4"}>
      <span
        className={
          success
            ? "flex size-9 shrink-0 items-center justify-center rounded-lg border border-success/30 bg-success/10 text-success"
            : "flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary"
        }
      >
        {icon}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          {highlight && (
            <Badge className="rounded-md bg-primary/10 px-1.5 py-0 text-[10px] font-medium text-primary">
              <Star className="mr-0.5 size-2.5" /> Main pick
            </Badge>
          )}
        </div>
        <p className={success ? "mt-0.5 text-sm font-semibold text-success" : "mt-0.5 truncate text-sm font-semibold"}>
          {value}
        </p>
      </div>
    </div>
  );
}

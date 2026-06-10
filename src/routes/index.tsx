import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Cpu, ShieldCheck, ShoppingCart, Sparkles, Store } from "lucide-react";
import { TopBar } from "@/components/top-bar";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AI装机助手 — AI PC Build Advisor" },
      {
        name: "description",
        content:
          "Help retail employees and beginner customers configure the perfect custom PC with an AI advisor.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopBar />
      <main className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 -top-40 mx-auto h-[500px] max-w-5xl bg-[radial-gradient(ellipse_at_center,var(--primary)_0%,transparent_60%)] opacity-20 blur-3xl" />
        <section className="relative mx-auto max-w-6xl px-6 pb-20 pt-24 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="size-3 text-primary" /> AI-driven retail PC configurator
          </div>
          <h1 className="mx-auto max-w-4xl text-5xl font-bold tracking-tight md:text-6xl">
            Build the perfect PC.{" "}
            <span className="bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              Powered by an AI advisor.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-balance text-muted-foreground">
            From in-store consultation to cart-ready order, AI装机助手 turns customer needs into
            compatible, profitable PC builds in minutes.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="rounded-xl px-6 shadow-glow">
              <Link to="/consult">
                Start consultation <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary" className="rounded-xl px-6">
              <Link to="/dashboard">Store dashboard</Link>
            </Button>
          </div>

          <div className="mt-20 grid gap-4 md:grid-cols-4">
            {[
              { icon: Cpu, label: "AI build recommendations" },
              { icon: ShieldCheck, label: "Real-time compatibility check" },
              { icon: ShoppingCart, label: "Pre-cart checklist" },
              { icon: Store, label: "Employee sales summary" },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left"
              >
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </div>
                <span className="text-sm">{label}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

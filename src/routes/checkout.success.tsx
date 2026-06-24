import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TopBar } from "@/components/top-bar";
import { Button } from "@/components/ui/button";
import { mockUpgradeToPro } from "@/lib/apiClient";
import { CheckCircle2, LoaderCircle, Sparkles } from "lucide-react";

type CheckoutSuccessSearch = {
  session_id?: string;
  mock?: string;
};

const UNLOCKED_FEATURES = [
  "50 AI questions for this build",
  "25 hardware replacements",
  "Advanced part comparison and reasoning",
  "Purchase checklist",
  "Saved builds and full export",
];

export const Route = createFileRoute("/checkout/success")({
  validateSearch: (search: Record<string, unknown>): CheckoutSuccessSearch => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
    mock: typeof search.mock === "string" ? search.mock : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Build Pro Activated - AI PC Build Advisor" },
      { name: "description", content: "Build Pro checkout success." },
    ],
  }),
  component: CheckoutSuccessPage,
});

function CheckoutSuccessPage() {
  const search = useSearch({ from: "/checkout/success" });
  const [message, setMessage] = useState(
    search.session_id
      ? "Stripe checkout completed. Build Pro will unlock after payment confirmation."
      : "Activating Build Pro for this local checkout...",
  );
  const [isActivating, setIsActivating] = useState(!search.session_id);

  useEffect(() => {
    if (search.session_id) {
      return;
    }

    let active = true;

    async function activateMockEntitlement() {
      try {
        const result = await mockUpgradeToPro();

        if (!active) {
          return;
        }

        setMessage(result.message ?? "Build Pro activated for this session.");
      } catch {
        if (!active) {
          return;
        }

        setMessage("Checkout succeeded, but local activation could not finish. Try Unlock Build Pro again.");
      } finally {
        if (active) {
          setIsActivating(false);
        }
      }
    }

    void activateMockEntitlement();

    return () => {
      active = false;
    };
  }, [search.session_id]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopBar />
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl items-center px-6 py-12">
        <section className="w-full rounded-2xl border border-success/20 bg-success/10 p-8">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-success/30 bg-background text-success">
              {isActivating ? <LoaderCircle className="size-6 animate-spin" /> : <CheckCircle2 className="size-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2 text-success">
                <Sparkles className="size-4" />
                <p className="text-sm font-semibold uppercase tracking-[0.2em]">Build Pro</p>
              </div>
              <h1 className="mt-2 text-3xl font-bold tracking-tight">Build Pro unlocked</h1>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{message}</p>
              <div className="mt-5 rounded-xl border border-success/20 bg-background/70 p-4">
                <p className="text-sm font-semibold">Now available in your advisor</p>
                <ul className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                  {UNLOCKED_FEATURES.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {search.session_id && (
                <p className="mt-2 font-mono text-xs text-muted-foreground">
                  Checkout session: {search.session_id}
                </p>
              )}
              <Button asChild className="mt-6 rounded-xl shadow-glow">
                <Link to="/consult">Back to /consult</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

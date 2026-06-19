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
      ? "Stripe checkout completed. Build Pro will unlock after webhook confirmation."
      : "Activating Build Pro for local checkout...",
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

        setMessage(result.message ?? "Build Pro activated for this mock session.");
      } catch {
        if (!active) {
          return;
        }

        setMessage("Checkout succeeded, but local activation could not finish. Try Unlock Pro again.");
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
              <h1 className="mt-2 text-3xl font-bold tracking-tight">Build Pro activated</h1>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{message}</p>
              {search.session_id && (
                <p className="mt-2 font-mono text-xs text-muted-foreground">
                  Checkout session: {search.session_id}
                </p>
              )}
              <Button asChild className="mt-6 rounded-xl shadow-glow">
                <Link to="/consult">Back to advisor</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

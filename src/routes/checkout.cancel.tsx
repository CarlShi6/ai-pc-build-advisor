import { createFileRoute, Link } from "@tanstack/react-router";
import { TopBar } from "@/components/top-bar";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/checkout/cancel")({
  head: () => ({
    meta: [
      { title: "Checkout Cancelled - AI PC Build Advisor" },
      { name: "description", content: "Build Pro checkout cancelled." },
    ],
  }),
  component: CheckoutCancelPage,
});

function CheckoutCancelPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopBar />
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl items-center px-6 py-12">
        <section className="w-full rounded-2xl border border-warning/25 bg-warning/10 p-8">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-warning/30 bg-background text-warning">
              <AlertTriangle className="size-6" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-warning">
                Checkout cancelled
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight">Payment was cancelled</h1>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                No payment was completed. Your current build and free features are still available.
              </p>
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

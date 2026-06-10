import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { TopBar } from "@/components/top-bar";
import { BuildCardInner, SAMPLE_BUILD } from "@/components/build-card";
import { FocusCard, type FocusPart } from "@/components/focus-card";
import { ComparePanel } from "@/components/compare-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, AlertTriangle, ArrowRight, GitCompare, HelpCircle, X } from "lucide-react";

export const Route = createFileRoute("/build")({
  head: () => ({
    meta: [
      { title: "Build Result — AI装机助手" },
      { name: "description", content: "Recommended PC build with compatibility check and pricing." },
    ],
  }),
  component: BuildPage,
});

const CHECKS = [
  { ok: true, label: "Motherboard socket matches CPU (LGA1700)" },
  { ok: true, label: "PSU wattage covers GPU + CPU peak draw +20%" },
  { ok: true, label: "RAM compatible with motherboard QVL" },
  { ok: false, label: "BIOS update may be required for 14th-gen support" },
];

const FOCUS_DATA: Record<string, FocusPart> = {
  GPU: {
    category: "GPU",
    name: "NVIDIA RTX 4080 Super 16GB",
    tagline: "Best balance of 4K editing throughput and high-FPS gaming at $1,000.",
    priorities: ["High FPS", "CUDA acceleration", "16GB VRAM", "Quiet under load"],
    whyItMatters:
      "The GPU drives every frame your customer will see — for 4K timelines and gaming it's the single biggest performance lever.",
  },
  CPU: {
    category: "CPU",
    name: "Intel Core i9-14900K",
    tagline: "24 cores for heavy multi-track editing and streaming workloads.",
    priorities: ["24 cores", "Up to 6.0 GHz", "Strong single-thread", "DDR5 ready"],
    whyItMatters:
      "More cores = faster Premiere/DaVinci exports. Strong single-thread keeps games snappy too.",
  },
  RAM: {
    category: "RAM",
    name: "Corsair Vengeance 64GB DDR5-6400",
    tagline: "Big enough headroom for 4K timelines with multiple apps open.",
    priorities: ["64 GB", "DDR5-6400", "RGB", "Low latency"],
    whyItMatters:
      "Editing 4K footage with Chrome + Slack + Premiere open needs at least 32GB; 64GB future-proofs the build.",
  },
};

function defaultFocus(category: string): FocusPart {
  return (
    FOCUS_DATA[category] ?? {
      category,
      name: SAMPLE_BUILD.find((p) => p.category === category)?.name ?? category,
      tagline: "Selected for compatibility and value in this build.",
      priorities: ["Compatible", "In stock", "Good value"],
      whyItMatters: "Supporting component — chosen to match the headline CPU/GPU pairing.",
    }
  );
}

function BuildPage() {
  const [focus, setFocus] = useState<string>("GPU");
  const [compareOpen, setCompareOpen] = useState<string | null>("GPU");
  const [toast, setToast] = useState<string | null>(null);
  const focusPart = defaultFocus(focus);

  const openCompare = (category: string) => {
    setFocus(category);
    setCompareOpen(category);
    requestAnimationFrame(() =>
      document.getElementById("compare-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(id);
  }, [toast]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopBar />
      <main className="mx-auto max-w-6xl space-y-12 px-6 py-10">
        <BuildCardInner
          parts={SAMPLE_BUILD}
          focusedCategory={focus}
          onFocus={(c) => openCompare(c)}
          onCompare={(c) => openCompare(c)}
          compact
        />

        <FocusCard
          part={focusPart}
          onCompare={() => openCompare(focus)}
        />

        {compareOpen && (
          <ComparePanel
            category={compareOpen}
            onClose={() => setCompareOpen(null)}
            onConfirm={(msg) => setToast(msg)}
          />
        )}

        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold">Compatibility Check</h3>
              <p className="text-sm text-muted-foreground">
                Automated validation across socket, power, and memory.
              </p>
            </div>
            <Badge className="bg-success/15 text-success">3 of 4 passed</Badge>
          </div>
          <ul className="space-y-2">
            {CHECKS.map((c) => (
              <li
                key={c.label}
                className="flex items-center gap-3 rounded-xl border border-border bg-background/50 p-3 text-sm"
              >
                {c.ok ? (
                  <Check className="size-4 shrink-0 text-success" />
                ) : (
                  <AlertTriangle className="size-4 shrink-0 text-warning" />
                )}
                <span>{c.label}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            className="rounded-xl"
            onClick={() => openCompare("GPU")}
          >
            <GitCompare className="mr-2 size-4" /> Compare GPU options
          </Button>
          <Button variant="secondary" className="rounded-xl" onClick={() => openCompare("CPU")}>
            <GitCompare className="mr-2 size-4" /> Compare CPU options
          </Button>
          <Button variant="secondary" className="rounded-xl" onClick={() => openCompare("RAM")}>
            <GitCompare className="mr-2 size-4" /> Compare RAM
          </Button>
          <Button variant="secondary" className="rounded-xl" onClick={() => openCompare("SSD")}>
            <GitCompare className="mr-2 size-4" /> Compare SSD
          </Button>
          <Button variant="ghost" className="rounded-xl text-muted-foreground">
            <HelpCircle className="mr-2 size-4" /> Why this part?
          </Button>
        </section>

        <div className="flex justify-end">
          <Button asChild size="lg" className="rounded-xl shadow-glow">
            <Link to="/cart">
              Continue to cart execution <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
        </div>
      </main>

      {/* Toast confirmation */}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <div className="pointer-events-auto flex max-w-xl items-start gap-3 rounded-xl border border-primary/40 bg-card/95 px-4 py-3 text-sm shadow-glow backdrop-blur">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" />
            <span className="flex-1">{toast}</span>
            <button
              onClick={() => setToast(null)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Dismiss"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
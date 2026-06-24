import { createCheckoutSession, mockUpgradeToPro } from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CheckCircle2, LoaderCircle, ShieldCheck, Sparkles } from "lucide-react";
import { useState } from "react";

const BUILD_PRO_BULLETS = [
  "50 AI questions per build",
  "25 hardware replacements per build",
  "Advanced part comparison",
  "Purchase checklist",
  "Saved builds and full export",
];

export function UpgradeCard({
  className,
  compact = false,
  onUpgraded,
}: {
  className?: string;
  compact?: boolean;
  onUpgraded?: () => void;
}) {
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleUpgrade() {
    setIsUpgrading(true);
    setMessage(null);

    try {
      const checkout = await createCheckoutSession({ plan: "build_pro" });

      if (checkout.checkoutUrl && !checkout.fallbackUsed) {
        window.location.href = checkout.checkoutUrl;
        return;
      }

      const result = await mockUpgradeToPro();
      setMessage(
        checkout.fallbackUsed
          ? "Local dev checkout is using the mock unlock because Stripe keys are not configured."
          : checkout.message || result.message || "Build Pro unlocked for this session.",
      );
      onUpgraded?.();
    } catch {
      try {
        const result = await mockUpgradeToPro();
        setMessage(result.message ?? "Build Pro unlocked for this session.");
        onUpgraded?.();
      } catch {
        setMessage("Checkout could not finish. Please try again.");
      }
    } finally {
      setIsUpgrading(false);
    }
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-primary/25 bg-primary/5 p-5 shadow-sm",
        compact && "p-4",
        className,
      )}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="size-4" />
            <h3 className="text-lg font-bold">Unlock Build Pro</h3>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            One checkout unlocks the planning tools for this build.
          </p>
          <p className="mt-3 font-mono text-2xl font-bold">$7.99 one-time</p>
        </div>
        <div className="hidden shrink-0 items-center gap-1 rounded-md border border-primary/20 bg-background px-2.5 py-1 text-xs font-medium text-primary sm:flex">
          <ShieldCheck className="size-3.5" />
          One-time
        </div>
      </div>

      <ul className="space-y-2 text-sm text-muted-foreground">
        {BUILD_PRO_BULLETS.map((bullet) => (
          <li key={bullet} className="flex gap-2">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>

      <Button
        className="mt-5 w-full rounded-xl shadow-glow"
        onClick={() => void handleUpgrade()}
        disabled={isUpgrading}
      >
        {isUpgrading ? (
          <>
            <LoaderCircle className="mr-2 size-4 animate-spin" /> Unlocking
          </>
        ) : (
          "Unlock Build Pro"
        )}
      </Button>
      {message && <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{message}</p>}
    </div>
  );
}

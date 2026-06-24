import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import type { AuthSession } from "@/lib/persistence/types";
import type { Entitlement } from "@/types/monetization";

const MODES = [
  { label: "Configuration", to: "/consult" as const },
  { label: "Purchase References", to: "/cart" as const },
];

export function TopBar({
  authSession,
  entitlement,
  onSavedBuildsClick,
  onSignInClick,
  onSignOutClick,
}: {
  authSession?: AuthSession | null;
  entitlement?: Entitlement | null;
  onSavedBuildsClick?: () => void;
  onSignInClick?: () => void;
  onSignOutClick?: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isSignedIn = authSession?.status === "authenticated";
  const accountLabel = isSignedIn ? "Signed in" : "Guest mode";
  const planLabel = entitlement?.active && entitlement.plan === "build_pro" ? "Build Pro active" : "Free";

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-md">
      <Link to="/" className="flex items-center gap-3">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary shadow-glow">
          <div className="size-3 rotate-45 rounded-sm bg-primary-foreground" />
        </div>
        <span className="text-lg font-bold tracking-tight">
          AI装机助手 <span className="font-normal text-muted-foreground">/ ADVISOR</span>
        </span>
      </Link>

      <nav className="flex rounded-full border border-border bg-card p-1">
        {MODES.map((m) => {
          const active = pathname.startsWith(m.to);
          return (
            <Link
              key={m.to}
              to={m.to}
              className={cn(
                "rounded-full px-6 py-1.5 text-sm font-medium transition-all",
                active
                  ? "bg-primary text-primary-foreground shadow-glow"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-4">
        {onSavedBuildsClick ? (
          <button
            type="button"
            className="hidden text-xs text-muted-foreground hover:text-foreground sm:block"
            onClick={onSavedBuildsClick}
          >
            Saved Builds
          </button>
        ) : (
          <Link
            to="/dashboard"
            className="hidden text-xs text-muted-foreground hover:text-foreground sm:block"
          >
            Saved Builds
          </Link>
        )}
        <div className="hidden text-right md:block">
          <p className="text-xs text-muted-foreground">{accountLabel}</p>
          <p className="font-mono text-sm">{planLabel}</p>
        </div>
        <div className="hidden items-center gap-2 lg:flex">
          {isSignedIn ? (
            <button
              type="button"
              className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={onSignOutClick}
            >
              Sign out
            </button>
          ) : (
            <button
              type="button"
              className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={onSignInClick}
            >
              Sign in
            </button>
          )}
        </div>
        <div className="size-10 rounded-full border border-border bg-secondary" />
      </div>
    </header>
  );
}

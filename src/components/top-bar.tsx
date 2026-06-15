import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const MODES = [
  { label: "Configuration", to: "/consult" as const },
  { label: "Purchase References", to: "/cart" as const },
];

export function TopBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
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
        <Link
          to="/dashboard"
          className="hidden text-xs text-muted-foreground hover:text-foreground sm:block"
        >
          Saved Builds
        </Link>
        <div className="hidden text-right sm:block">
          <p className="text-xs text-muted-foreground">Advisor Mode</p>
          <p className="font-mono text-sm">B2C MVP</p>
        </div>
        <div className="size-10 rounded-full border border-border bg-secondary" />
      </div>
    </header>
  );
}

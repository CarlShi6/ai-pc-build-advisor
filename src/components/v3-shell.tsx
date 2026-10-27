import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

// The old workspace keeps its /legacy-workspace route but has no entry in the main navigation.
const links = [
  { to: "/" as const, label: "Explore" },
  { to: "/my-builds" as const, label: "My Builds" },
  { to: "/studio" as const, label: "Build Studio" },
];

export function V3Shell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return (
    <div className="v3-app">
      <header className="v3-header">
        <Link to="/" className="v3-brand" aria-label="AIPC home">
          <span className="v3-mark">A</span>
          <span>
            AIPC <small>BUILD ADVISOR</small>
          </span>
        </Link>
        <nav className="v3-nav" aria-label="Main navigation">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={pathname === link.to ? "active" : ""}
              aria-current={pathname === link.to ? "page" : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <Link className="v3-header-action" to="/start/$mode" params={{ mode: "blank" }}>
          New build <span aria-hidden="true">↗</span>
        </Link>
      </header>
      {children}
      <footer className="v3-footer">
        <span>AIPC v3 preview</span>
        <span>Part fit and prices require source checks before purchase.</span>
      </footer>
    </div>
  );
}

import { Link, createFileRoute } from "@tanstack/react-router";
import { FileText, ListChecks, Plus } from "lucide-react";
import { V3Shell } from "@/components/v3-shell";
import { ImageStartFlow } from "@/components/image-start-flow";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AIPC — Build your version" },
      { name: "description", content: "Turn PC inspiration into an editable build." },
    ],
  }),
  component: HomePage,
});

// PRD §4.2: photo upload is the primary action; the other starts are secondary links.
const otherStarts = [
  { mode: "describe", label: "Describe your dream PC", Icon: FileText },
  { mode: "import", label: "Import a parts list", Icon: ListChecks },
  { mode: "blank", label: "Start from scratch", Icon: Plus },
] as const;

function HomePage() {
  return (
    <V3Shell>
      <main>
        <section className="v3-hero v3-hero-upload" aria-labelledby="v3-hero-title">
          <div className="v3-hero-copy">
            <span className="v3-eyebrow">
              <span className="v3-dot" /> IMAGE TO BUILD · EARLY ACCESS
            </span>
            <h1 id="v3-hero-title">
              See a PC you love.
              <br />
              <em>Build your version.</em>
            </h1>
            <p>
              Upload a photo of a build you like. We point out what is visible, suggest catalog
              parts for you to confirm, and keep the hidden hardware open for you to choose.
            </p>
          </div>
          <div className="v3-hero-drop">
            <ImageStartFlow variant="hero" />
            <nav className="v3-other-starts" aria-label="Other ways to start">
              <span>No photo?</span>
              {otherStarts.map(({ mode, label, Icon }) => (
                <Link key={mode} to="/start/$mode" params={{ mode }}>
                  <Icon size={15} /> {label}
                </Link>
              ))}
            </nav>
          </div>
        </section>
        <section className="v3-trust">
          <span>
            01 <strong>Start with what you know</strong>
          </span>
          <span>
            02 <strong>Review what is uncertain</strong>
          </span>
          <span>
            03 <strong>Build a plan you can check</strong>
          </span>
        </section>
      </main>
    </V3Shell>
  );
}

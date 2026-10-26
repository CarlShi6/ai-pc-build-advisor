import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { FileText, ListChecks, Plus, Sparkles } from "lucide-react";
import { V3Shell } from "@/components/v3-shell";
import { ImageStartFlow } from "@/components/image-start-flow";
import { writeDraft } from "@/lib/v3/draft-session";
import { funnel } from "@/lib/v3/funnel-analytics";
import { createWhiteShowcaseSample } from "@/lib/v3/showcase-sample";

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
  const navigate = useNavigate();
  function openSample() {
    const draft = createWhiteShowcaseSample();
    writeDraft(draft);
    funnel.draftCreated(draft);
    void navigate({ to: "/studio" });
  }
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
              <button type="button" className="v3-sample-start" onClick={openSample}>
                <Sparkles size={15} /> Try the white showcase sample
              </button>
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

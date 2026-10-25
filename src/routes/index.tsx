import { Link, createFileRoute } from "@tanstack/react-router";
import {
  Camera,
  FileText,
  ListChecks,
  Plus,
  ArrowUpRight,
  ShieldCheck,
  Box,
  ScanSearch,
} from "lucide-react";
import { V3Shell } from "@/components/v3-shell";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AIPC — Build your version" },
      { name: "description", content: "Turn PC inspiration into an editable build." },
    ],
  }),
  component: HomePage,
});

const entries = [
  {
    mode: "image",
    title: "Start from an image",
    description: "Preview a reference photo, then build from what you can verify.",
    Icon: Camera,
    label: "PHOTO",
  },
  {
    mode: "describe",
    title: "Describe your PC",
    description: "Set a budget and goal, then choose the parts that fit.",
    Icon: FileText,
    label: "WORDS",
  },
  {
    mode: "import",
    title: "Import a parts list",
    description: "Review exact catalog matches before creating a draft.",
    Icon: ListChecks,
    label: "LIST",
  },
  {
    mode: "blank",
    title: "Start blank",
    description: "Open an empty eight-slot workspace and build at your pace.",
    Icon: Plus,
    label: "BLANK",
  },
] as const;

function HomePage() {
  return (
    <V3Shell>
      <main>
        <section className="v3-hero">
          <div className="v3-hero-copy">
            <span className="v3-eyebrow">
              <span className="v3-dot" /> IMAGE TO BUILD · EARLY ACCESS
            </span>
            <h1>
              See a PC you love.
              <br />
              <em>Build your version.</em>
            </h1>
            <p>
              Start with the look, a goal, or a parts list. Shape a real build with visible choices,
              compatibility checks, and room for the unknowns.
            </p>
            <div className="v3-hero-actions">
              <Link className="v3-primary" to="/start/$mode" params={{ mode: "image" }}>
                Start from an image <ArrowUpRight size={17} />
              </Link>
              <Link className="v3-secondary" to="/studio">
                Open Build Studio <span aria-hidden="true">→</span>
              </Link>
            </div>
            <div className="v3-hero-note">
              <ShieldCheck size={17} /> Review visible details and local catalog alternatives, or
              continue manually.
            </div>
          </div>
          <div className="v3-hero-art" aria-hidden="true">
            <div className="v3-orbit v3-orbit-one" />
            <div className="v3-orbit v3-orbit-two" />
            <div className="v3-tower">
              <span className="v3-tower-glow" />
              <span className="v3-fan v3-fan-one" />
              <span className="v3-fan v3-fan-two" />
              <span className="v3-fan v3-fan-three" />
              <span className="v3-gpu" />
            </div>
            <div className="v3-art-tag v3-tag-top">
              <ScanSearch size={15} /> Inspiration
            </div>
            <div className="v3-art-tag v3-tag-bottom">
              <Box size={15} /> Your build
            </div>
          </div>
        </section>
        <section className="v3-section" aria-labelledby="v3-start-title">
          <div className="v3-section-heading">
            <div>
              <span className="v3-kicker">CHOOSE YOUR START</span>
              <h2 id="v3-start-title">Every build starts somewhere.</h2>
            </div>
            <span>01 / 04</span>
          </div>
          <div className="v3-entry-grid">
            {entries.map(({ mode, title, description, Icon, label }) => (
              <Link className="v3-entry" key={mode} to="/start/$mode" params={{ mode }}>
                <span className="v3-entry-top">
                  <Icon size={25} strokeWidth={1.6} />
                  <small>{label}</small>
                </span>
                <strong>{title}</strong>
                <span>{description}</span>
                <b aria-hidden="true">↗</b>
              </Link>
            ))}
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

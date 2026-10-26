import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, FolderOpen } from "lucide-react";
import { V3Shell } from "@/components/v3-shell";
import { getSavedBuild, getSavedBuilds } from "@/lib/apiClient";
import { fromSavedBuild } from "@/lib/v3/build-document";
import { writeDraft } from "@/lib/v3/draft-session";
import type { SavedBuildSummary } from "@/types/build";

export const Route = createFileRoute("/my-builds")({ component: MyBuildsPage });

function MyBuildsPage() {
  const navigate = useNavigate();
  const [builds, setBuilds] = useState<SavedBuildSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [opening, setOpening] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void getSavedBuilds()
      .then((result) => {
        if (active) setBuilds(result.builds);
      })
      .catch((failure) => {
        if (active)
          setError(failure instanceof Error ? failure.message : "Could not load saved builds.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  async function openBuild(id: string) {
    setOpening(id);
    setError("");
    try {
      const saved = await getSavedBuild(id);
      const document = fromSavedBuild(saved);
      if (!document) throw new Error("This saved build could not be read.");
      writeDraft(document);
      await navigate({ to: "/studio" });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not open this build.");
    } finally {
      setOpening(null);
    }
  }
  return (
    <V3Shell>
      <main className="v3-page">
        <div className="v3-page-intro">
          <span className="v3-icon">
            <FolderOpen size={25} />
          </span>
          <span className="v3-kicker">YOUR WORK</span>
          <h1>My Builds</h1>
          <p>Open a saved build in the new 2D Studio or continue in the current workspace.</p>
        </div>
        {loading && <p className="v3-inline-note">Loading saved builds…</p>}
        {error && (
          <p className="v3-error" role="alert">
            {error}
          </p>
        )}
        {!loading && !error && builds.length === 0 && (
          <div className="v3-form-card v3-empty-saved">
            <h2>No saved builds yet.</h2>
            <p>Create a draft or continue with the current workspace to save a build.</p>
            <Link className="v3-primary" to="/start/$mode" params={{ mode: "blank" }}>
              Start a build <ArrowRight size={16} />
            </Link>
          </div>
        )}
        {builds.length > 0 && (
          <div className="v3-saved-list">
            {builds.map((build) => (
              <article key={build.id}>
                <div>
                  <span className="v3-kicker">SAVED BUILD</span>
                  <h2>{build.name}</h2>
                  <p>
                    {build.targetUseCase.join(" · ") || "No goal recorded"} · Updated{" "}
                    {new Date(build.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <strong>${build.totalPrice.toLocaleString()}</strong>
                  <button
                    className="v3-secondary"
                    type="button"
                    disabled={opening === build.id}
                    onClick={() => void openBuild(build.id)}
                  >
                    {opening === build.id ? "Opening…" : "Open in Studio"} <ArrowRight size={16} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
        <div className="v3-legacy-link">
          <Link to="/legacy-workspace">
            Open current workspace <span aria-hidden="true">↗</span>
          </Link>
          <Link to="/consult">
            Open guided advisor <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </main>
    </V3Shell>
  );
}

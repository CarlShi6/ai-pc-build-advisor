import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, FolderOpen, Trash2 } from "lucide-react";
import { V3Shell } from "@/components/v3-shell";
import { buildsInBrowser, savedBuilds } from "@/lib/v3/build-store";
import { fromSavedBuild } from "@/lib/v3/build-document";
import { readDraft, writeDraft } from "@/lib/v3/draft-session";
import type { SavedBuildSummary } from "@/types/build";

export const Route = createFileRoute("/my-builds")({ component: MyBuildsPage });

function MyBuildsPage() {
  const navigate = useNavigate();
  const [builds, setBuilds] = useState<SavedBuildSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [opening, setOpening] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    void savedBuilds
      .list()
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
      const saved = await savedBuilds.get(id);
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
  async function removeBuild(id: string, name: string) {
    setDeleting(id);
    setError("");
    try {
      const result = await savedBuilds.remove(id);
      setBuilds(result.builds);
      // A draft open in this tab stops pointing at the deleted save, so saving it creates a new one.
      const draft = readDraft();
      if (draft?.savedBuildId === id)
        writeDraft({ ...draft, savedBuildId: undefined, savedVersion: undefined });
      setNotice(`Deleted “${name}”.`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not delete this build.");
    } finally {
      setDeleting(null);
      setConfirmingDelete(null);
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
          <p>Open a saved build in the Build Studio.</p>
          {buildsInBrowser && (
            <p className="v3-inline-note" aria-label="Where builds are saved">
              Saved builds stay in this browser only: another browser or device won't see them, and
              clearing this site's data deletes them.
            </p>
          )}
        </div>
        {loading && <p className="v3-inline-note">Loading saved builds…</p>}
        {notice && (
          <p className="v3-inline-note" role="status">
            {notice}
          </p>
        )}
        {error && (
          <p className="v3-error" role="alert">
            {error}
          </p>
        )}
        {!loading && !error && builds.length === 0 && (
          <div className="v3-form-card v3-empty-saved">
            <h2>No saved builds yet.</h2>
            <p>Create a draft to save a build.</p>
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
                  {confirmingDelete === build.id ? (
                    <span className="v3-delete-confirm" role="group" aria-label="Confirm delete">
                      <small>
                        Deletes this build, its parts list and any saved photo findings. This
                        can&apos;t be undone.
                      </small>
                      <button
                        className="v3-danger"
                        type="button"
                        disabled={deleting === build.id}
                        onClick={() => void removeBuild(build.id, build.name)}
                      >
                        {deleting === build.id ? "Deleting…" : "Delete permanently"}
                      </button>
                      <button
                        className="v3-secondary"
                        type="button"
                        disabled={deleting === build.id}
                        onClick={() => setConfirmingDelete(null)}
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      className="v3-secondary"
                      type="button"
                      aria-label={`Delete ${build.name}`}
                      onClick={() => {
                        setNotice("");
                        setConfirmingDelete(build.id);
                      }}
                    >
                      <Trash2 size={16} /> Delete
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </V3Shell>
  );
}

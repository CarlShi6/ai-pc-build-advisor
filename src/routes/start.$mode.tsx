import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Camera, FileText, ListChecks, Plus } from "lucide-react";
import { V3Shell } from "@/components/v3-shell";
import { ImageStartFlow } from "@/components/image-start-flow";
import {
  createDraft,
  previewPartsList,
  type ImportMatch,
  type SlotId,
} from "@/lib/v3/build-document";
import { writeDraft } from "@/lib/v3/draft-session";
import { funnel } from "@/lib/v3/funnel-analytics";
import { getRecommendedBuild } from "@/lib/apiClient";
import {
  describeUseCases,
  proposeDescribeDraft,
  recommendationInput,
  type DescribeProposal,
  type DescribeRequirements,
  type DescribeUseCase,
} from "@/lib/v3/describe-recommendation";
import type { AppearancePreference, CpuBrandPreference, GpuBrandPreference } from "@/types/api";

export const Route = createFileRoute("/start/$mode")({ component: StartPage });
const modes = ["image", "describe", "import", "blank"] as const;
type Mode = (typeof modes)[number];
const details = {
  image: {
    title: "Build from an image",
    subtitle: "Bring your inspiration. We’ll keep visible details and unknown hardware separate.",
    Icon: Camera,
  },
  describe: {
    title: "Describe your PC",
    subtitle: "Capture your goals, then shape the actual parts in the studio.",
    Icon: FileText,
  },
  import: {
    title: "Import a parts list",
    subtitle: "Check catalog matches before they enter your draft.",
    Icon: ListChecks,
  },
  blank: {
    title: "Start with a blank build",
    subtitle: "Eight clear slots. You decide what goes in each one.",
    Icon: Plus,
  },
};

function StartPage() {
  const { mode: routeMode } = Route.useParams();
  const mode = modes.includes(routeMode as Mode) ? (routeMode as Mode) : "blank";
  const { title, subtitle, Icon } = details[mode];
  const navigate = useNavigate();
  const [budget, setBudget] = useState("2500");
  const [description, setDescription] = useState("");
  const [useCases, setUseCases] = useState<DescribeUseCase[]>([]);
  const [appearance, setAppearance] = useState<AppearancePreference | "">("");
  const [cpuBrand, setCpuBrand] = useState<CpuBrandPreference | "">("");
  const [gpuBrand, setGpuBrand] = useState<GpuBrandPreference | "">("");
  const [describeProposal, setDescribeProposal] = useState<DescribeProposal | null>(null);
  const [recommending, setRecommending] = useState(false);
  const [list, setList] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const matches = useMemo(() => previewPartsList(list), [list]);

  function begin() {
    const parsedBudget = Number(budget);
    if (!Number.isFinite(parsedBudget) || parsedBudget < 0) {
      setError("Enter a valid budget of $0 or more.");
      return;
    }
    if (mode === "describe" && !description.trim() && !useCases.length) {
      setError("Choose a use case or add a short description to continue.");
      return;
    }
    if (mode === "import" && !list.trim()) {
      setError("Paste at least one part before continuing.");
      return;
    }
    if (mode === "image" && !file) {
      setError("Choose an image to preview, or start blank instead.");
      return;
    }
    const selected =
      mode === "import"
        ? matches
            .filter(
              (item): item is ImportMatch & { part: NonNullable<ImportMatch["part"]> } =>
                !!item.part,
            )
            .map((item) => item.part)
        : [];
    const chosen = [...new Map(selected.map((part) => [part.category, part])).values()];
    const draft = createDraft(mode, {
      name:
        mode === "describe"
          ? "Description draft"
          : mode === "import"
            ? "Imported parts draft"
            : mode === "image"
              ? "Reference photo draft"
              : "Untitled build",
      budget: parsedBudget,
      useCases: mode === "describe" ? [...useCases] : [],
      sourceInput: mode === "import" ? list : mode === "describe" ? description : undefined,
      parts: chosen,
      unresolved: mode === "import" ? unresolvedBySlot(matches) : {},
    });
    writeDraft(draft);
    funnel.draftCreated(draft);
    void navigate({ to: "/studio" });
  }

  function describeRequirements(): DescribeRequirements | null {
    const parsedBudget = Number(budget);
    if (!Number.isFinite(parsedBudget) || parsedBudget < 300 || parsedBudget > 20_000) {
      setError("Recommendations need a budget between $300 and $20,000.");
      return null;
    }
    return {
      budget: Math.round(parsedBudget),
      useCases,
      appearance: appearance || undefined,
      cpuBrand: cpuBrand || undefined,
      gpuBrand: gpuBrand || undefined,
    };
  }

  async function previewRecommendation() {
    const requirements = describeRequirements();
    if (!requirements) return;
    setError("");
    setRecommending(true);
    try {
      const recommended = await getRecommendedBuild(recommendationInput(requirements));
      setDescribeProposal(proposeDescribeDraft(recommended, requirements, description));
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Recommendations are unavailable. Create a draft and choose parts yourself.",
      );
    } finally {
      setRecommending(false);
    }
  }

  function confirmRecommendation() {
    if (!describeProposal) return;
    writeDraft(describeProposal.candidate);
    funnel.draftCreated(describeProposal.candidate);
    void navigate({ to: "/studio" });
  }

  function changeRequirements<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setDescribeProposal(null);
    };
  }

  return (
    <V3Shell>
      <main className="v3-page">
        <Link className="v3-back" to="/">
          <ArrowLeft size={16} /> All starting points
        </Link>
        <div className="v3-page-intro">
          <span className="v3-icon">
            <Icon size={25} />
          </span>
          <span className="v3-kicker">NEW BUILD / {mode.toUpperCase()}</span>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <div className="v3-form-layout">
          <section className="v3-form-card">
            {mode === "image" && <ImageStartFlow budget={budget} onFileChange={setFile} />}
            {mode === "describe" && (
              <>
                <fieldset className="v3-field v3-wizard">
                  <legend>What will you use it for?</legend>
                  <div className="v3-chip-row">
                    {describeUseCases.map((item) => (
                      <label key={item} className="v3-chip">
                        <input
                          type="checkbox"
                          checked={useCases.includes(item)}
                          onChange={(event) =>
                            changeRequirements(setUseCases)(
                              event.target.checked
                                ? [...useCases, item]
                                : useCases.filter((value) => value !== item),
                            )
                          }
                        />
                        {item}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="v3-wizard-row">
                  <label className="v3-field">
                    Look
                    <select
                      value={appearance}
                      onChange={(event) =>
                        changeRequirements(setAppearance)(
                          event.target.value as AppearancePreference | "",
                        )
                      }
                    >
                      <option value="">No preference</option>
                      <option value="black">Black</option>
                      <option value="white">White</option>
                      <option value="rgb">RGB lighting</option>
                    </select>
                  </label>
                  <label className="v3-field">
                    CPU brand
                    <select
                      value={cpuBrand}
                      onChange={(event) =>
                        changeRequirements(setCpuBrand)(
                          event.target.value as CpuBrandPreference | "",
                        )
                      }
                    >
                      <option value="">No preference</option>
                      <option value="amd">AMD</option>
                      <option value="intel">Intel</option>
                    </select>
                  </label>
                  <label className="v3-field">
                    GPU brand
                    <select
                      value={gpuBrand}
                      onChange={(event) =>
                        changeRequirements(setGpuBrand)(
                          event.target.value as GpuBrandPreference | "",
                        )
                      }
                    >
                      <option value="">No preference</option>
                      <option value="nvidia">NVIDIA</option>
                      <option value="amd">AMD</option>
                    </select>
                  </label>
                </div>
                <label className="v3-field">
                  Anything else? (saved with the draft, not analyzed)
                  <textarea
                    rows={4}
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="I want a quiet white PC for 1440p gaming…"
                  />
                </label>
                <section className="v3-image-build" aria-label="Recommended parts preview">
                  <span className="v3-kicker">RECOMMENDATION · EXPLICIT CONFIRMATION</span>
                  <h2>Get a starting parts list</h2>
                  <p>
                    Rule-based picks for all eight slots from the local catalog, based on your
                    choices and budget. Nothing is added until you confirm, and you can change any
                    part in the Studio.
                  </p>
                  <button
                    className="v3-secondary"
                    type="button"
                    disabled={recommending}
                    onClick={() => void previewRecommendation()}
                  >
                    {recommending ? "Preparing…" : "Preview recommended parts"}
                  </button>
                  {describeProposal && (
                    <div className="v3-image-build-preview">
                      <h3>Recommended parts · not applied</h3>
                      <ul>
                        {describeProposal.lines.map((line) => (
                          <li key={line.slot}>
                            {line.slot}: {line.name}
                            {line.price === null
                              ? ""
                              : ` · $${line.price.toLocaleString()} seed price`}
                          </li>
                        ))}
                      </ul>
                      <p>
                        Seed catalog total: $
                        {describeProposal.candidate.build.totalPrice.toLocaleString()} · Rule
                        findings: {describeProposal.candidate.build.compatibilityWarnings.length}
                      </p>
                      <div className="v3-image-build-warnings">
                        <strong>Read before confirming</strong>
                        <ul>
                          {describeProposal.notes.map((note) => (
                            <li key={note}>{note}</li>
                          ))}
                        </ul>
                      </div>
                      <button className="v3-primary" type="button" onClick={confirmRecommendation}>
                        Use these parts and open Build Studio
                      </button>
                      <button
                        className="v3-text-button"
                        type="button"
                        onClick={() => setDescribeProposal(null)}
                      >
                        Cancel preview
                      </button>
                    </div>
                  )}
                </section>
              </>
            )}
            {mode === "import" && (
              <>
                <label className="v3-field">
                  Paste one part per line
                  <textarea
                    rows={9}
                    value={list}
                    onChange={(event) => setList(event.target.value)}
                    placeholder="Intel Core i7-14700K&#10;Corsair RM850x…"
                  />
                </label>
                {matches.length > 0 && (
                  <div className="v3-import-preview">
                    <strong>Review before creating</strong>
                    {matches.map((match, index) => (
                      <div key={`${index}-${match.line}`}>
                        <span>{match.line}</span>
                        <small className={match.status}>
                          {match.status === "matched"
                            ? `Catalog match · ${match.part?.displayName}`
                            : match.status === "ambiguous"
                              ? "Needs review"
                              : "Unknown · kept in original list"}
                        </small>
                      </div>
                    ))}
                  </div>
                )}
                <p className="v3-inline-note">
                  Only exact single catalog matches enter slots. Unknown lines stay in the original
                  text for review.
                </p>
              </>
            )}
            {mode === "blank" && (
              <div className="v3-blank-message">
                <Plus size={30} />
                <h2>A clear place to begin.</h2>
                <p>
                  Your draft opens with case, motherboard, CPU, cooler, GPU, memory, storage, and
                  power supply slots. Nothing is selected for you.
                </p>
              </div>
            )}
            <label className="v3-field">
              Target budget (USD)
              <input
                type="number"
                min="0"
                value={budget}
                onChange={(event) => {
                  setBudget(event.target.value);
                  setDescribeProposal(null);
                }}
              />
            </label>
            {error && (
              <p className="v3-error" role="alert">
                {error}
              </p>
            )}
            <div className="v3-form-actions">
              <button className="v3-primary" type="button" onClick={begin}>
                {mode === "import"
                  ? "Create reviewed draft"
                  : mode === "image"
                    ? "Continue manually"
                    : mode === "describe"
                      ? "Create draft with empty slots"
                      : "Create draft"}
                <ArrowRight size={17} />
              </button>
            </div>
          </section>
          <aside className="v3-aside">
            <span className="v3-kicker">WHAT HAPPENS NEXT</span>
            <h2>Your Build Studio</h2>
            <p>
              Each part has a clear status. You can add, replace, or remove catalog parts and review
              compatibility as the plan takes shape.
            </p>
            <div>
              <span>01</span> Create a draft
            </div>
            <div>
              <span>02</span> Choose actual parts
            </div>
            <div>
              <span>03</span> Check the whole build
            </div>
            <Link to="/legacy-workspace">
              Need the current workspace? <span aria-hidden="true">↗</span>
            </Link>
          </aside>
        </div>
      </main>
    </V3Shell>
  );
}

function unresolvedBySlot(matches: ImportMatch[]): Partial<Record<SlotId, string>> {
  const result: Partial<Record<SlotId, string>> = {};
  for (const match of matches) {
    if (match.status === "matched") continue;
    const text = match.line.toLowerCase();
    const slot: SlotId | undefined =
      text.includes("gpu") || text.includes("graphics")
        ? "gpu"
        : text.includes("cpu") || text.includes("processor")
          ? "cpu"
          : text.includes("motherboard")
            ? "motherboard"
            : text.includes("memory") || text.includes("ram")
              ? "memory"
              : text.includes("ssd") || text.includes("storage")
                ? "storage"
                : text.includes("psu") || text.includes("power supply")
                  ? "psu"
                  : text.includes("cooler")
                    ? "cooler"
                    : text.includes("case")
                      ? "case"
                      : undefined;
    if (slot) result[slot] = match.line;
  }
  return result;
}

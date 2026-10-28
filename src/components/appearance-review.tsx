import {
  appearanceFields,
  appearanceValue,
  type AppearanceCategory,
  type AppearanceCorrection,
  type AppearanceParams,
} from "@/lib/v3/appearance-params";

const categoryLabels: Record<AppearanceCategory, string> = {
  case: "Case",
  gpu: "GPU",
  cooler: "Cooler",
  fans: "Case fans",
  memory: "Memory",
  motherboard: "Motherboard",
};

const fieldLabels: Record<string, string> = {
  type: "Type",
  color: "Colour",
  glass: "Glass",
  orientation: "Orientation",
  fanCount: "Fans",
  length: "Length",
  mount: "Mount",
  light: "Light",
  radiatorSize: "Radiator size",
  radiatorPosition: "Radiator position",
  pumpStyle: "Pump",
  front: "Front",
  top: "Top",
  side: "Side",
  bottom: "Bottom",
  rear: "Rear",
  ringColor: "Ring light",
  sticks: "Sticks",
  lightBar: "Light bar",
};

/**
 * Step A on the review page: the photo's look as the AI read it, one dropdown per field with the
 * schema's fixed options (unknown included). A changed field is marked "You set". Nothing applies
 * until the user builds the preview and confirms it; the 3D then draws the edited look.
 */
export function AppearanceReview({
  read,
  value,
  userSet,
  corrections,
  onChange,
}: {
  /** As the analysis returned it (after the automatic consistency check). */
  read: AppearanceParams;
  value: AppearanceParams;
  userSet: string[];
  corrections: AppearanceCorrection[];
  onChange: (path: string, next: string) => void;
}) {
  const categories = [...new Set(appearanceFields.map((field) => field.category))];
  return (
    <section className="v3-appearance-review" aria-label="Appearance from photo">
      <span className="v3-kicker">APPEARANCE FROM PHOTO</span>
      <p className="v3-appearance-note">
        How the 3D will look. Correct anything the photo shows differently; "unknown" leaves it to a
        typical shape. This is the look only, never a model.
      </p>
      {corrections.length > 0 && (
        <ul className="v3-appearance-corrections">
          {corrections.map((correction) => (
            <li key={correction.field}>
              Adjusted {correction.field}: {correction.from} → {correction.to}. {correction.reason}
            </li>
          ))}
        </ul>
      )}
      <div className="v3-appearance-grid">
        {categories.map((category) => (
          <fieldset key={category}>
            <legend>{categoryLabels[category]}</legend>
            {appearanceFields
              .filter((field) => field.category === category)
              .map((field) => {
                const current = appearanceValue(value, field.path);
                const mine = userSet.includes(field.path);
                return (
                  <label key={field.path} data-path={field.path}>
                    <span>{fieldLabels[field.field] ?? field.field}</span>
                    <select
                      value={current}
                      aria-label={`${categoryLabels[category]} ${fieldLabels[field.field] ?? field.field}`}
                      onChange={(event) => onChange(field.path, event.target.value)}
                    >
                      {field.options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    <small className={mine ? "you-set" : "ai-read"}>
                      {mine
                        ? "You set"
                        : appearanceValue(read, field.path) === "unknown"
                          ? "AI read · unknown"
                          : "AI read"}
                    </small>
                  </label>
                );
              })}
          </fieldset>
        ))}
      </div>
    </section>
  );
}

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  BuildFeedbackBoolean,
  BuildFeedbackDifficulty,
  BuildFeedbackIssueLevel,
  PostBuildFeedbackInput,
} from "@/types/build";

const ISSUE_OPTIONS: Array<{ value: BuildFeedbackIssueLevel; label: string }> = [
  { value: "no_issue", label: "No issue" },
  { value: "minor_issue", label: "Minor issue" },
  { value: "major_issue", label: "Major issue" },
  { value: "not_sure", label: "Not sure" },
];

const BOOLEAN_OPTIONS: Array<{ value: BuildFeedbackBoolean; label: string }> = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "not_sure", label: "Not sure" },
];

const DIFFICULTY_OPTIONS: Array<{ value: BuildFeedbackDifficulty; label: string }> = [
  { value: "easy", label: "Easy" },
  { value: "manageable", label: "Manageable" },
  { value: "hard", label: "Hard" },
  { value: "not_sure", label: "Not sure" },
];

type FeedbackDraft = Omit<PostBuildFeedbackInput, "buildId">;

const DEFAULT_DRAFT: FeedbackDraft = {
  completedAt: new Date().toISOString().slice(0, 10),
  bootSuccess: "yes",
  installationDifficulty: "manageable",
  compatibilityIssues: "no_issue",
  thermalExperience: "no_issue",
  noiseExperience: "no_issue",
  cableManagementExperience: "no_issue",
  gpuClearanceIssue: "no_issue",
  coolerFitIssue: "no_issue",
  biosUpdateNeeded: "no",
  driverIssue: "no_issue",
  overallSatisfaction: 5,
  wouldRecommend: "yes",
  notes: "",
};

export function PostBuildFeedbackForm({
  buildId,
  buildName,
  open,
  isSubmitting,
  onOpenChange,
  onSubmit,
}: {
  buildId: string | null;
  buildName?: string;
  open: boolean;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (feedback: PostBuildFeedbackInput) => void;
}) {
  const initialDraft = useMemo(() => ({ ...DEFAULT_DRAFT }), [buildId]);
  const [draft, setDraft] = useState<FeedbackDraft>(initialDraft);

  useEffect(() => {
    if (open) {
      setDraft({ ...DEFAULT_DRAFT, completedAt: new Date().toISOString().slice(0, 10) });
    }
  }, [buildId, open]);

  function update<K extends keyof FeedbackDraft>(key: K, value: FeedbackDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function submit() {
    if (!buildId) {
      return;
    }

    onSubmit({
      ...draft,
      buildId,
      completedAt: draft.completedAt
        ? new Date(`${draft.completedAt}T12:00:00`).toISOString()
        : undefined,
      notes: draft.notes?.trim() || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Report Build Result</DialogTitle>
          <DialogDescription>
            {buildName ?? "This saved build"} gets structured real-world feedback for future review.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Build completed">
            <input
              type="date"
              value={draft.completedAt}
              onChange={(event) => update("completedAt", event.target.value)}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            />
          </Field>
          <SelectField
            label="Did it boot successfully?"
            value={draft.bootSuccess}
            options={BOOLEAN_OPTIONS}
            onChange={(value) => update("bootSuccess", value as BuildFeedbackBoolean)}
          />
          <SelectField
            label="Beginner difficulty"
            value={draft.installationDifficulty}
            options={DIFFICULTY_OPTIONS}
            onChange={(value) => update("installationDifficulty", value as BuildFeedbackDifficulty)}
          />
          <SatisfactionField
            value={draft.overallSatisfaction}
            onChange={(value) => update("overallSatisfaction", value)}
          />
          <SelectField
            label="Compatibility issues"
            value={draft.compatibilityIssues}
            options={ISSUE_OPTIONS}
            onChange={(value) => update("compatibilityIssues", value as BuildFeedbackIssueLevel)}
          />
          <SelectField
            label="Thermals"
            value={draft.thermalExperience}
            options={ISSUE_OPTIONS}
            onChange={(value) => update("thermalExperience", value as BuildFeedbackIssueLevel)}
          />
          <SelectField
            label="Noise"
            value={draft.noiseExperience}
            options={ISSUE_OPTIONS}
            onChange={(value) => update("noiseExperience", value as BuildFeedbackIssueLevel)}
          />
          <SelectField
            label="Cable management"
            value={draft.cableManagementExperience}
            options={ISSUE_OPTIONS}
            onChange={(value) => update("cableManagementExperience", value as BuildFeedbackIssueLevel)}
          />
          <SelectField
            label="GPU clearance"
            value={draft.gpuClearanceIssue}
            options={ISSUE_OPTIONS}
            onChange={(value) => update("gpuClearanceIssue", value as BuildFeedbackIssueLevel)}
          />
          <SelectField
            label="Cooler fit"
            value={draft.coolerFitIssue}
            options={ISSUE_OPTIONS}
            onChange={(value) => update("coolerFitIssue", value as BuildFeedbackIssueLevel)}
          />
          <SelectField
            label="BIOS update needed"
            value={draft.biosUpdateNeeded}
            options={BOOLEAN_OPTIONS}
            onChange={(value) => update("biosUpdateNeeded", value as BuildFeedbackBoolean)}
          />
          <SelectField
            label="Driver issue"
            value={draft.driverIssue}
            options={ISSUE_OPTIONS}
            onChange={(value) => update("driverIssue", value as BuildFeedbackIssueLevel)}
          />
          <SelectField
            label="Would recommend"
            value={draft.wouldRecommend}
            options={BOOLEAN_OPTIONS}
            onChange={(value) => update("wouldRecommend", value as BuildFeedbackBoolean)}
          />
          <Field label="Notes">
            <Textarea
              value={draft.notes}
              onChange={(event) => update("notes", event.target.value)}
              placeholder="Anything surprising, confusing, or worth remembering?"
              className="min-h-24"
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="secondary" className="rounded-md" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="rounded-md" disabled={!buildId || isSubmitting} onClick={submit}>
            {isSubmitting ? "Saving..." : "Save Feedback"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <Field label={label}>
      <Select value={value} onValueChange={(nextValue) => onChange(nextValue as T)}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function SatisfactionField({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <Field label="Satisfaction">
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((score) => (
          <Button
            key={score}
            type="button"
            size="sm"
            variant={score === value ? "default" : "secondary"}
            className="h-9 w-9 rounded-md p-0"
            onClick={() => onChange(score)}
          >
            {score}
          </Button>
        ))}
      </div>
    </Field>
  );
}

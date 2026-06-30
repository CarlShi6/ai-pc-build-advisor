import type {
  BuildFeedbackDifficulty,
  BuildFeedbackIssueLevel,
  PostBuildFeedback,
  PostBuildFeedbackSummary,
} from "@/types/build";

const ISSUE_WEIGHTS: Record<BuildFeedbackIssueLevel, number> = {
  no_issue: 0,
  minor_issue: 1,
  major_issue: 2,
  not_sure: 0,
};

const DIFFICULTY_WEIGHTS: Record<BuildFeedbackDifficulty, number> = {
  easy: 0,
  manageable: 1,
  hard: 2,
  not_sure: 0,
};

export function createPostBuildFeedbackSummary(
  feedback: PostBuildFeedback[],
): PostBuildFeedbackSummary | undefined {
  if (feedback.length === 0) {
    return undefined;
  }

  const sorted = [...feedback].sort(
    (left, right) => Date.parse(right.completedAt) - Date.parse(left.completedAt),
  );
  const latest = sorted[0];
  const issuesReported = feedback.reduce(
    (count, item) =>
      count +
      [
        item.compatibilityIssues,
        item.thermalExperience,
        item.noiseExperience,
        item.cableManagementExperience,
        item.gpuClearanceIssue,
        item.coolerFitIssue,
        item.driverIssue,
      ].filter((value) => ISSUE_WEIGHTS[value] > 0).length,
    0,
  );
  const satisfactionScore =
    feedback.reduce((sum, item) => sum + item.overallSatisfaction, 0) / feedback.length;
  const beginnerDifficulty = [...feedback]
    .sort(
      (left, right) =>
        DIFFICULTY_WEIGHTS[right.installationDifficulty] -
        DIFFICULTY_WEIGHTS[left.installationDifficulty],
    )[0].installationDifficulty;

  return {
    completedAt: latest.completedAt,
    reportCount: feedback.length,
    issuesReported,
    satisfactionScore: Math.round(satisfactionScore * 10) / 10,
    beginnerDifficulty,
    latestFeedbackId: latest.id,
  };
}

export type WorkflowStepStatus = "done" | "active" | "pending";

export type WorkflowStep = {
  id: string;
  label: string;
  status: WorkflowStepStatus;
};

export type BranchGoal = {
  title: string;
  markdown: string;
};

export type RepoMap = {
  name: string;
  detectedStack: string[];
  importantFiles: string[];
  commands: Partial<Record<"dev" | "test" | "typecheck" | "build", string>>;
  runtimeCapabilities: string[];
};

export type StructuredEdit = {
  file: string;
  operation: "replace";
  find: string;
  replacement: string;
  reason: string;
};

export type PatchSafetyChecklist = {
  branchGoalAttached: boolean;
  contextPackReviewed: boolean;
  modelCapabilityAccepted: boolean;
  structuredEditParsed: boolean;
  targetFileExists: boolean;
  targetTextMatched: boolean;
  diffPreviewGenerated: boolean;
  testsRun: boolean;
  gitDiffUpdated: boolean;
};

export type PatchProposal = {
  id: string;
  title: string;
  summary: string;
  status: "ready" | "needs_attention" | "applied" | "rejected";
  edits: StructuredEdit[];
  safety: PatchSafetyChecklist;
};

export type AiTask =
  | "diff_summary"
  | "branch_review"
  | "risk_checklist"
  | "commit_message"
  | "pr_description"
  | "selected_range_patch"
  | "single_file_patch"
  | "conflict_explanation";

export type LlmProvider = "webllm" | "ollama" | "recorded";

export type ModelCapability = {
  provider: LlmProvider;
  modelId: string;
  contextWindow: number;
  speedTier: "slow" | "medium" | "fast";
  qualityTier: "small" | "medium" | "large";
  supportsJsonMode: boolean;
  supportsStreaming: boolean;
  recommendedTasks: AiTask[];
};

export type RuntimeCapability = "webcontainer" | "local_command" | "recorded";

export type RuntimePlan = {
  capability: RuntimeCapability;
  buildCommand?: string;
  devCommand?: string;
  installCommand?: string;
  previewCommand?: string;
  testCommand?: string;
  typecheckCommand?: string;
  confidence: "high" | "medium" | "low";
  warnings: string[];
};

export type ContextPack = {
  branchGoalMarkdown: string;
  currentFile: string;
  fileCount: number;
  gitChangeCount: number;
  assistedMemory: string;
  tokenBudget: {
    limit: number;
    used: number;
  };
};

export type SafetyGateInput = {
  branchPushed: boolean;
  branchGoalSet: boolean;
  contextPackReviewed: boolean;
  modelAccepted: boolean;
  patchReviewed: boolean;
  previewChecked: boolean;
  testsPassed: boolean;
  commitCreated: boolean;
  prDraftGenerated: boolean;
  unresolvedWarnings: number;
};

export type SafetyGateItem = {
  id: string;
  label: string;
  status: "pass" | "warning" | "blocked";
};

export type SafetyGateResult = {
  canCreateCommit: boolean;
  canCreatePullRequest: boolean;
  items: SafetyGateItem[];
  summary: "ready_for_pr" | "ready_for_commit" | "needs_review" | "blocked";
};

export type GitHubRepositorySelection = {
  fullName: string;
  owner: string;
  name: string;
  defaultBranch: string;
  installationId?: string;
};

export type PullRequestDraft = {
  baseBranch: string;
  body: string;
  branch: string;
  title: string;
};

export type PullRequestResult = {
  number: number;
  url: string;
};

export function evaluateSafetyGate(input: SafetyGateInput): SafetyGateResult {
  const items: SafetyGateItem[] = [
    {
      id: "branch-goal",
      label: "Branch Goal",
      status: input.branchGoalSet ? "pass" : "blocked",
    },
    {
      id: "context-pack",
      label: "Context Pack reviewed",
      status: input.contextPackReviewed ? "pass" : "warning",
    },
    {
      id: "model",
      label: "Model capability accepted",
      status: input.modelAccepted ? "pass" : "warning",
    },
    {
      id: "patch",
      label: "Patch / diff reviewed",
      status: input.patchReviewed ? "pass" : "blocked",
    },
    {
      id: "tests",
      label: "Tests passed",
      status: input.testsPassed ? "pass" : "warning",
    },
    {
      id: "preview",
      label: "Local Preview checked",
      status: input.previewChecked ? "pass" : "warning",
    },
    {
      id: "warnings",
      label: "Unresolved warnings",
      status: input.unresolvedWarnings === 0 ? "pass" : "warning",
    },
    {
      id: "commit",
      label: "Commit draft",
      status: input.commitCreated ? "pass" : "warning",
    },
    {
      id: "pr-draft",
      label: "PR draft",
      status: input.prDraftGenerated ? "pass" : "warning",
    },
    {
      id: "branch-pushed",
      label: "Branch pushed",
      status: input.branchPushed ? "pass" : "warning",
    },
  ];

  const blocked = items.some((item) => item.status === "blocked");
  const canCreateCommit = !blocked && input.patchReviewed;
  const canCreatePullRequest =
    canCreateCommit &&
    input.testsPassed &&
    input.previewChecked &&
    input.commitCreated &&
    input.branchPushed &&
    input.prDraftGenerated &&
    input.unresolvedWarnings === 0;

  return {
    canCreateCommit,
    canCreatePullRequest,
    items,
    summary: blocked
      ? "blocked"
      : canCreatePullRequest
        ? "ready_for_pr"
        : canCreateCommit
          ? "ready_for_commit"
          : "needs_review",
  };
}

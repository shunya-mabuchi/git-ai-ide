export type BranchToPrState = {
  repository: string;
  baseBranch: string;
  currentBranch: string;
  hasUncommittedChanges: boolean;
  pushed: boolean;
  pullRequestUrl?: string;
};

export type GitFileStatus = "added" | "modified" | "deleted" | "unchanged";

export type GitStatusEntry = {
  file: string;
  status: GitFileStatus;
};

export type GitWorkingTreeStatus = {
  baseBranch: string;
  branch: string;
  entries: GitStatusEntry[];
  hasChanges: boolean;
};

export type SnapshotGitStatusInput = {
  baseBranch?: string;
  baselineFiles: Record<string, string>;
  branch?: string;
  files: Record<string, string>;
};

export function canCreatePullRequest(state: BranchToPrState) {
  return state.pushed && state.currentBranch !== state.baseBranch;
}

export function createSnapshotGitStatus(input: SnapshotGitStatusInput): GitWorkingTreeStatus {
  const baseBranch = input.baseBranch ?? "main";
  const branch = input.branch ?? "feature/pr-summary";
  const fileNames = new Set([...Object.keys(input.baselineFiles), ...Object.keys(input.files)]);

  const entries = [...fileNames]
    .sort()
    .map((file): GitStatusEntry => {
      if (!(file in input.baselineFiles)) return { file, status: "added" };
      if (!(file in input.files)) return { file, status: "deleted" };
      if (input.baselineFiles[file] !== input.files[file]) return { file, status: "modified" };
      return { file, status: "unchanged" };
    })
    .filter((entry) => entry.status !== "unchanged");

  return {
    baseBranch,
    branch,
    entries,
    hasChanges: entries.length > 0,
  };
}

export function summarizeGitStatus(status: GitWorkingTreeStatus) {
  if (!status.hasChanges) return "No changes";
  const counts = status.entries.reduce<Record<GitFileStatus, number>>(
    (currentCounts, entry) => ({
      ...currentCounts,
      [entry.status]: currentCounts[entry.status] + 1,
    }),
    { added: 0, deleted: 0, modified: 0, unchanged: 0 },
  );

  return [
    counts.modified ? `${counts.modified} modified` : "",
    counts.added ? `${counts.added} added` : "",
    counts.deleted ? `${counts.deleted} deleted` : "",
  ]
    .filter(Boolean)
    .join(" / ");
}

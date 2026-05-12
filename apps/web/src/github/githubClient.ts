export type GitHubSetupStatus = {
  appConfigured: boolean;
  installUrl: string;
  requiredSecrets: string[];
};

export type GitHubRepositoryOption = {
  defaultBranch: string;
  fullName: string;
  installationId?: number;
  name: string;
  owner: string;
};

export type GitHubRepositoryFilesResult = {
  files: Record<string, string>;
  limits: {
    maxFiles: number;
    maxSingleFileBytes: number;
    maxTotalBytes: number;
  };
  mode: "github";
  ref: string;
  repository: string;
  skipped: number;
  truncated: boolean;
};

export type GitHubInstallationOption = {
  accountLogin: string;
  id: number;
};

export type GitHubBranchOption = {
  commitSha: string;
  default: boolean;
  name: string;
  protected: boolean;
};

export type GitHubCommitOption = {
  author: string;
  branch: string;
  message: string;
  sha: string;
  time: string;
  url: string;
};

export type CreatePullRequestInput = {
  baseBranch: string;
  body: string;
  branch: string;
  installationId?: number;
  repository: string;
  title: string;
};

export type PushFilesInput = {
  baseBranch: string;
  branch: string;
  changes: Array<{
    content?: string;
    path: string;
    status: "added" | "deleted" | "modified";
  }>;
  commitMessage: string;
  installationId?: number;
  repository: string;
};

export type CreateGitHubBranchInput = {
  baseBranch: string;
  branch: string;
  installationId?: number;
  repository: string;
};

export type PushFilesResult = {
  commit: {
    branch: string;
    changedFiles: number;
    sha?: string;
  };
  mode: "demo" | "github";
};

export type CreatePullRequestResult = {
  mode: "demo" | "github";
  pullRequest: {
    number: number;
    url: string;
  };
  sessionId: string;
  warning?: string;
};

const workerBaseUrl =
  import.meta.env.VITE_GIT_AI_IDE_WORKER_URL ?? import.meta.env.VITE_LOCALFORGE_WORKER_URL ?? "http://127.0.0.1:8787";

export async function loadGitHubSetup(): Promise<GitHubSetupStatus> {
  const response = await fetch(`${workerBaseUrl}/api/github/setup`);
  if (!response.ok) throw new Error("GitHub setup status を取得できませんでした。");
  return response.json();
}

export async function loadGitHubInstallations(): Promise<GitHubInstallationOption[]> {
  const response = await fetch(`${workerBaseUrl}/api/github/installations`);
  if (!response.ok) throw new Error("GitHub installations を取得できませんでした。");
  const body = (await response.json()) as {
    installations: GitHubInstallationOption[];
  };
  return body.installations;
}

export async function loadGitHubRepositories(installationId?: number): Promise<GitHubRepositoryOption[]> {
  const params = installationId ? `?installation_id=${installationId}` : "";
  const response = await fetch(`${workerBaseUrl}/api/github/repos${params}`);
  if (!response.ok) throw new Error("GitHub repositories を取得できませんでした。");
  const body = (await response.json()) as {
    repositories: GitHubRepositoryOption[];
  };
  return body.repositories;
}

export async function loadGitHubRepositoryFiles(input: {
  defaultBranch?: string;
  installationId?: number;
  repository: string;
}): Promise<GitHubRepositoryFilesResult> {
  const params = new URLSearchParams({
    default_branch: input.defaultBranch ?? "main",
    ref: input.defaultBranch ?? "main",
    repository: input.repository,
  });
  if (input.installationId) params.set("installation_id", String(input.installationId));

  const response = await fetch(`${workerBaseUrl}/api/github/files?${params.toString()}`);
  if (!response.ok) {
    throw new Error(await readGitHubApiError(response, "GitHub repository files を取得できませんでした。"));
  }
  return response.json();
}

export async function loadGitHubBranches(input: {
  defaultBranch?: string;
  installationId?: number;
  repository: string;
}): Promise<GitHubBranchOption[]> {
  const params = new URLSearchParams({
    default_branch: input.defaultBranch ?? "main",
    repository: input.repository,
  });
  if (input.installationId) params.set("installation_id", String(input.installationId));

  const response = await fetch(`${workerBaseUrl}/api/github/branches?${params.toString()}`);
  if (!response.ok) throw new Error("GitHub branches を取得できませんでした。");
  const body = (await response.json()) as {
    branches: GitHubBranchOption[];
  };
  return body.branches;
}

export async function createGitHubBranch(input: CreateGitHubBranchInput): Promise<GitHubBranchOption> {
  const response = await fetch(`${workerBaseUrl}/api/github/branches`, {
    body: JSON.stringify(input),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await readGitHubApiError(response, "GitHub branch を作成できませんでした。"));
  }

  const body = (await response.json()) as {
    branch: GitHubBranchOption;
  };
  return body.branch;
}

export async function loadGitHubCommits(input: {
  branch?: string;
  defaultBranch?: string;
  installationId?: number;
  repository: string;
}): Promise<GitHubCommitOption[]> {
  const params = new URLSearchParams({
    branch: input.branch ?? input.defaultBranch ?? "main",
    default_branch: input.defaultBranch ?? "main",
    repository: input.repository,
  });
  if (input.installationId) params.set("installation_id", String(input.installationId));

  const response = await fetch(`${workerBaseUrl}/api/github/commits?${params.toString()}`);
  if (!response.ok) throw new Error("GitHub commits を取得できませんでした。");
  const body = (await response.json()) as {
    commits: GitHubCommitOption[];
  };
  return body.commits;
}

export async function createGitHubPullRequest(input: CreatePullRequestInput): Promise<CreatePullRequestResult> {
  const response = await fetch(`${workerBaseUrl}/api/github/prs`, {
    body: JSON.stringify(input),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await readGitHubApiError(response, "Pull request を作成できませんでした。"));
  }

  return response.json();
}

export async function pushGitHubFiles(input: PushFilesInput): Promise<PushFilesResult> {
  const response = await fetch(`${workerBaseUrl}/api/github/push-files`, {
    body: JSON.stringify(input),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await readGitHubApiError(response, "Branch に変更を push できませんでした。"));
  }

  return response.json();
}

async function readGitHubApiError(response: Response, fallback: string) {
  const errorBody = (await response.json().catch(() => null)) as { error?: string; github?: string } | null;
  const githubMessage = parseGitHubErrorMessage(errorBody?.github);
  return [errorBody?.error, githubMessage, `HTTP ${response.status}`].filter(Boolean).join(" / ") || fallback;
}

function parseGitHubErrorMessage(value?: string) {
  if (!value) return "";

  try {
    const parsed = JSON.parse(value) as { errors?: Array<{ message?: string }>; message?: string };
    const detail = parsed.errors?.map((error) => error.message).filter(Boolean).join(" / ");
    return detail ? `${parsed.message}: ${detail}` : parsed.message ?? value;
  } catch {
    return value;
  }
}

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

export type GitHubInstallationOption = {
  accountLogin: string;
  id: number;
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
};

const workerBaseUrl = import.meta.env.VITE_LOCALFORGE_WORKER_URL ?? "http://127.0.0.1:8787";

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

export async function createGitHubPullRequest(input: CreatePullRequestInput): Promise<CreatePullRequestResult> {
  const response = await fetch(`${workerBaseUrl}/api/github/prs`, {
    body: JSON.stringify(input),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.error ?? "Pull request を作成できませんでした。");
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
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.error ?? "Branch に変更を push できませんでした。");
  }

  return response.json();
}

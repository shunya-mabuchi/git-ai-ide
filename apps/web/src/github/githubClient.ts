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

export type CreatePullRequestInput = {
  baseBranch: string;
  body: string;
  branch: string;
  installationId?: number;
  repository: string;
  title: string;
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

export async function loadGitHubRepositories(): Promise<GitHubRepositoryOption[]> {
  const response = await fetch(`${workerBaseUrl}/api/github/repos`);
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

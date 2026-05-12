const workerUrl = process.env.GIT_AI_IDE_WORKER_URL ?? "http://127.0.0.1:8787";
const installationIdFromEnv = process.env.GITHUB_E2E_INSTALLATION_ID;
const repositoryFromEnv = process.env.GITHUB_E2E_REPOSITORY;
const baseBranchFromEnv = process.env.GITHUB_E2E_BASE_BRANCH;
const issueNumber = process.env.GITHUB_E2E_ISSUE_NUMBER;
const writeEnabled = process.env.GITHUB_E2E_WRITE === "1";

const runId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const branch = process.env.GITHUB_E2E_BRANCH ?? `git-ai-ide-e2e-${runId}`;

async function request(path, init) {
  const response = await fetch(`${workerUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(`${init?.method ?? "GET"} ${path} failed: ${response.status} ${text}`);
  }

  return body;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function logStep(message) {
  console.log(`[github-real-e2e] ${message}`);
}

const setup = await request("/api/github/setup");
assert(setup.appConfigured === true, "Worker is reachable, but GitHub App credentials are not configured.");
logStep("setup ok: GitHub App credentials are configured");

const installations = await request("/api/github/installations");
assert(installations.mode === "github", "Installations endpoint did not return GitHub mode.");
assert(Array.isArray(installations.installations), "Installations response is missing installations array.");
assert(installations.installations.length > 0, "No GitHub App installations found.");

const installation =
  installations.installations.find((item) => String(item.id) === String(installationIdFromEnv)) ??
  installations.installations[0];

assert(installation.id, "Selected installation is missing id.");
logStep(`installation ok: ${installation.accountLogin ?? installation.id}`);

const repos = await request(`/api/github/repos?installation_id=${installation.id}`);
assert(repos.mode === "github", "Repos endpoint did not return GitHub mode.");
assert(Array.isArray(repos.repositories), "Repos response is missing repositories array.");
assert(repos.repositories.length > 0, "No repositories returned for selected installation.");

const repository =
  repos.repositories.find((item) => item.fullName === repositoryFromEnv) ??
  repos.repositories[0];

assert(repository.fullName, "Selected repository is missing fullName.");
logStep(`repository ok: ${repository.fullName}`);

if (!writeEnabled) {
  logStep("write skipped: set GITHUB_E2E_WRITE=1 to create a branch and PR.");
  process.exit(0);
}

const baseBranch = baseBranchFromEnv ?? repository.defaultBranch ?? "main";
const filePath = "docs/e2e-github-app-check.md";
const content = [
  "# GitHub App E2E check",
  "",
  `- Repository: ${repository.fullName}`,
  `- Branch: ${branch}`,
  `- Run: ${new Date().toISOString()}`,
  "",
  "This file was created by the explicit GitHub App real credentials E2E script.",
  "",
].join("\n");

const push = await request("/api/github/push-files", {
  body: JSON.stringify({
    baseBranch,
    branch,
    changes: [
      {
        content,
        path: filePath,
        status: "added",
      },
    ],
    commitMessage: "test: GitHub App real credentials E2E",
    installationId: Number(installation.id),
    repository: repository.fullName,
  }),
  method: "POST",
});

assert(push.mode === "github", "Push endpoint did not return GitHub mode.");
assert(push.commit?.sha, "Push response is missing commit sha.");
logStep(`push ok: ${push.commit.sha}`);

const prBodyLines = [
  "GitHub App 実 credentials E2E で作成した確認 PR です。",
  "",
  issueNumber ? `Refs #${issueNumber}` : "Refs #54",
];

const pullRequest = await request("/api/github/prs", {
  body: JSON.stringify({
    baseBranch,
    body: prBodyLines.join("\n"),
    branch,
    installationId: Number(installation.id),
    repository: repository.fullName,
    title: "test: GitHub App real credentials E2E",
  }),
  method: "POST",
});

assert(pullRequest.mode === "github", "PR endpoint did not return GitHub mode.");
assert(pullRequest.pullRequest?.url, "PR response is missing URL.");
logStep(`pull request ok: ${pullRequest.pullRequest.url}`);

export interface Env {
  DB: D1Database;
  GITHUB_APP_ID?: string;
  GITHUB_APP_PRIVATE_KEY?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GITHUB_APP_SLUG?: string;
}

type GitHubRepository = {
  defaultBranch: string;
  fullName: string;
  installationId?: number;
  name: string;
  owner: string;
};

type GitHubPullRequestResponse = {
  html_url: string;
  number: number;
};

type GitHubBranch = {
  commitSha: string;
  default: boolean;
  name: string;
  protected: boolean;
};

type GitHubCommit = {
  author: string;
  branch: string;
  message: string;
  sha: string;
  time: string;
  url: string;
};

type GitHubTreeResponse = {
  tree: Array<{
    path: string;
    sha: string;
    size?: number;
    type: "blob" | "tree" | string;
  }>;
  truncated: boolean;
};

type GitHubBlobResponse = {
  content: string;
  encoding: string;
  size: number;
};

const maxRepositoryFiles = 80;
const maxRepositoryBytes = 512_000;
const maxSingleFileBytes = 80_000;

const json = (data: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(data, null, 2), {
    ...init,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type,authorization",
      "content-type": "application/json; charset=utf-8",
      ...init?.headers,
    },
  });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return json({ ok: true });
    }

    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return json({
        githubConfigured: isGitHubConfigured(env),
        ok: true,
        service: "git-ai-ide-worker",
      });
    }

    if (url.pathname === "/api/sessions" && request.method === "GET") {
      const rows = await env.DB.prepare(
        "select id, repository, branch, status, pr_url, created_at from pr_flow_sessions order by created_at desc limit 20",
      ).all();

      return json({ sessions: rows.results });
    }

    if (url.pathname === "/api/github/setup" && request.method === "GET") {
      return json({
        appConfigured: isGitHubConfigured(env),
        installUrl: createInstallUrl(env, url.origin),
        requiredSecrets: ["GITHUB_APP_ID", "GITHUB_APP_PRIVATE_KEY"],
      });
    }

    if (url.pathname === "/api/github/install-url" && request.method === "GET") {
      return json({ url: createInstallUrl(env, url.origin) });
    }

    if (url.pathname === "/api/github/installations" && request.method === "GET") {
      if (!isGitHubConfigured(env)) {
        return json({
          mode: "setup_required",
          installations: [],
          message: "GitHub App secrets are not configured.",
        });
      }

      const installations = await githubRequest<Array<{ account: { login: string }; id: number }>>(
        env,
        "/app/installations",
      );

      return json({
        installations: installations.map((installation) => ({
          accountLogin: installation.account.login,
          id: installation.id,
        })),
        mode: "github",
      });
    }

    if (url.pathname === "/api/github/repos" && request.method === "GET") {
      if (!isGitHubConfigured(env)) {
        return json({
          mode: "demo",
          repositories: [demoRepository()],
        });
      }

      const installationId = Number(url.searchParams.get("installation_id"));

      if (!installationId) {
        return json({ error: "installation_id is required" }, { status: 400 });
      }

      const token = await createInstallationToken(env, installationId);
      const response = await fetch("https://api.github.com/installation/repositories?per_page=100", {
        headers: githubHeaders(token),
      });

      if (!response.ok) {
        return json({ error: "Failed to load GitHub repositories" }, { status: response.status });
      }

      const body = (await response.json()) as {
        repositories: Array<{
          default_branch: string;
          full_name: string;
          name: string;
          owner: { login: string };
        }>;
      };

      const repositories: GitHubRepository[] = body.repositories.map((repository) => ({
        defaultBranch: repository.default_branch,
        fullName: repository.full_name,
        installationId,
        name: repository.name,
        owner: repository.owner.login,
      }));

      return json({ mode: "github", repositories });
    }

    if (url.pathname === "/api/github/files" && request.method === "GET") {
      const repository = url.searchParams.get("repository");
      const installationId = Number(url.searchParams.get("installation_id"));
      const ref = url.searchParams.get("ref") ?? url.searchParams.get("default_branch") ?? "main";

      if (!repository) {
        return json({ error: "repository is required" }, { status: 400 });
      }

      if (!isGitHubConfigured(env)) {
        return json({ error: "GitHub App secrets are not configured." }, { status: 400 });
      }

      if (!installationId) {
        return json({ error: "installation_id is required for GitHub mode" }, { status: 400 });
      }

      try {
        const token = await createInstallationToken(env, installationId);
        const result = await loadRepositoryTextFiles(token, repository, ref);
        return json({
          ...result,
          mode: "github",
          ref,
          repository,
        });
      } catch (error) {
        return json(
          {
            error:
              error instanceof Error
                ? `GitHub repository files を取得できませんでした: ${error.message}`
                : "GitHub repository files を取得できませんでした。",
          },
          { status: 502 },
        );
      }
    }

    if (url.pathname === "/api/github/branches" && request.method === "GET") {
      const repository = url.searchParams.get("repository");
      const installationId = Number(url.searchParams.get("installation_id"));
      const defaultBranch = url.searchParams.get("default_branch") ?? "main";

      if (!repository) {
        return json({ error: "repository is required" }, { status: 400 });
      }

      if (!isGitHubConfigured(env) || repository.startsWith("demo/")) {
        return json({
          branches: demoBranches(defaultBranch),
          mode: "demo",
        });
      }

      if (!installationId) {
        return json({ error: "installation_id is required for GitHub mode" }, { status: 400 });
      }

      const token = await createInstallationToken(env, installationId);
      const response = await fetch(`https://api.github.com/repos/${repository}/branches?per_page=100`, {
        headers: githubHeaders(token),
      });

      if (!response.ok) {
        return json({ error: "Failed to load GitHub branches" }, { status: response.status });
      }

      const body = (await response.json()) as Array<{
        commit: { sha: string };
        name: string;
        protected: boolean;
      }>;
      const branches: GitHubBranch[] = body.map((branch) => ({
        commitSha: branch.commit.sha,
        default: branch.name === defaultBranch,
        name: branch.name,
        protected: branch.protected,
      }));

      return json({ branches, mode: "github" });
    }

    if (url.pathname === "/api/github/branches" && request.method === "POST") {
      const body = (await request.json().catch(() => null)) as
        | {
            baseBranch?: string;
            branch?: string;
            installationId?: number;
            repository?: string;
          }
        | null;

      if (!body?.repository || !body.branch) {
        return json({ error: "repository and branch are required" }, { status: 400 });
      }

      if (!isGitHubConfigured(env) || body.repository.startsWith("demo/")) {
        return json({
          branch: {
            commitSha: `demo-${crypto.randomUUID()}`,
            default: false,
            name: body.branch,
            protected: false,
          },
          mode: "demo",
        });
      }

      if (!body.installationId) {
        return json({ error: "installationId is required for GitHub mode" }, { status: 400 });
      }

      const token = await createInstallationToken(env, body.installationId);
      await ensureBranch(token, body.repository, body.baseBranch ?? "main", body.branch);

      return json({
        branch: {
          commitSha: await readBranchSha(token, body.repository, body.branch),
          default: false,
          name: body.branch,
          protected: false,
        },
        mode: "github",
      });
    }

    if (url.pathname === "/api/github/commits" && request.method === "GET") {
      const repository = url.searchParams.get("repository");
      const branch = url.searchParams.get("branch") ?? url.searchParams.get("default_branch") ?? "main";
      const installationId = Number(url.searchParams.get("installation_id"));

      if (!repository) {
        return json({ error: "repository is required" }, { status: 400 });
      }

      if (!isGitHubConfigured(env) || repository.startsWith("demo/")) {
        return json({
          commits: demoCommits(branch),
          mode: "demo",
        });
      }

      if (!installationId) {
        return json({ error: "installation_id is required for GitHub mode" }, { status: 400 });
      }

      const token = await createInstallationToken(env, installationId);
      const response = await fetch(
        `https://api.github.com/repos/${repository}/commits?sha=${encodeURIComponent(branch)}&per_page=20`,
        {
          headers: githubHeaders(token),
        },
      );

      if (!response.ok) {
        return json({ error: "Failed to load GitHub commits" }, { status: response.status });
      }

      const body = (await response.json()) as Array<{
        commit: {
          author?: { date?: string; name?: string };
          message: string;
        };
        html_url: string;
        sha: string;
      }>;
      const commits: GitHubCommit[] = body.map((commit) => ({
        author: commit.commit.author?.name ?? "unknown",
        branch,
        message: commit.commit.message.split("\n")[0] ?? "Commit",
        sha: commit.sha,
        time: commit.commit.author?.date ?? "",
        url: commit.html_url,
      }));

      return json({ commits, mode: "github" });
    }

    if (url.pathname === "/api/github/prs" && request.method === "POST") {
      const body = (await request.json().catch(() => null)) as
        | {
            baseBranch?: string;
            body?: string;
            branch?: string;
            installationId?: number;
            repository?: string;
            title?: string;
          }
        | null;

      if (!body?.repository || !body.branch || !body.title) {
        return json({ error: "repository, branch, title are required" }, { status: 400 });
      }

      if (!isGitHubConfigured(env) || body.repository.startsWith("demo/")) {
        return createDemoPullRequest(env, body);
      }

      if (!body.installationId) {
        return json({ error: "installationId is required for GitHub mode" }, { status: 400 });
      }

      const token = await createInstallationToken(env, body.installationId);
      const response = await fetch(`https://api.github.com/repos/${body.repository}/pulls`, {
        body: JSON.stringify({
          base: body.baseBranch ?? "main",
          body: body.body ?? "",
          head: body.branch,
          maintainer_can_modify: true,
          title: body.title,
        }),
        headers: githubHeaders(token),
        method: "POST",
      });

      if (!response.ok) {
        const errorBody = await response.text();
        return json({ error: "Failed to create pull request", github: errorBody }, { status: response.status });
      }

      const pullRequest = (await response.json()) as GitHubPullRequestResponse;
      const metadataResult = await savePullRequestMetadata(env, {
        baseBranch: body.baseBranch ?? "main",
        branch: body.branch,
        prNumber: pullRequest.number,
        prUrl: pullRequest.html_url,
        repository: body.repository,
        title: body.title,
      });

      return json({
        mode: "github",
        pullRequest: {
          number: pullRequest.number,
          url: pullRequest.html_url,
        },
        sessionId: metadataResult.sessionId,
        warning: metadataResult.warning,
      });
    }

    if (url.pathname === "/api/github/push-files" && request.method === "POST") {
      const body = (await request.json().catch(() => null)) as
        | {
            baseBranch?: string;
            branch?: string;
            changes?: Array<{
              content?: string;
              path: string;
              status: "added" | "deleted" | "modified";
            }>;
            commitMessage?: string;
            installationId?: number;
            repository?: string;
          }
        | null;

      if (!body?.repository || !body.branch || !body.commitMessage || !body.changes?.length) {
        return json({ error: "repository, branch, commitMessage, changes are required" }, { status: 400 });
      }

      if (!isGitHubConfigured(env) || body.repository.startsWith("demo/")) {
        return json({
          commit: {
            branch: body.branch,
            changedFiles: body.changes.length,
            sha: `demo-${crypto.randomUUID()}`,
          },
          mode: "demo",
        });
      }

      if (!body.installationId) {
        return json({ error: "installationId is required for GitHub mode" }, { status: 400 });
      }

      const token = await createInstallationToken(env, body.installationId);
      const branch = body.branch;
      const baseBranch = body.baseBranch ?? "main";
      await ensureBranch(token, body.repository, baseBranch, branch);

      const commitShas: string[] = [];
      for (const change of body.changes) {
        const result = await writeContentChange(token, {
          branch,
          change,
          commitMessage: body.commitMessage,
          repository: body.repository,
        });
        if (result?.commit?.sha) commitShas.push(result.commit.sha);
      }

      return json({
        commit: {
          branch,
          changedFiles: body.changes.length,
          sha: commitShas.at(-1),
        },
        mode: "github",
      });
    }

    return json({ error: "Not found" }, { status: 404 });
  },
};

function isGitHubConfigured(env: Env) {
  return Boolean(env.GITHUB_APP_ID && env.GITHUB_APP_PRIVATE_KEY);
}

function createInstallUrl(env: Env, origin: string) {
  if (env.GITHUB_APP_SLUG) {
    return `https://github.com/apps/${env.GITHUB_APP_SLUG}/installations/new`;
  }

  return `${origin}/api/github/setup`;
}

function demoRepository(): GitHubRepository {
  return {
    defaultBranch: "main",
    fullName: "demo/pr-helper-mini",
    name: "pr-helper-mini",
    owner: "demo",
  };
}

function demoBranches(defaultBranch: string): GitHubBranch[] {
  return [
    {
      commitSha: "9c12d4e",
      default: true,
      name: defaultBranch,
      protected: false,
    },
    {
      commitSha: "b41f7a2",
      default: false,
      name: "feature/pr-summary",
      protected: false,
    },
  ];
}

function demoCommits(branch: string): GitHubCommit[] {
  return [
    {
      author: "demo",
      branch,
      message: "Add PR summary generator",
      sha: "b41f7a2",
      time: "demo fixture",
      url: "",
    },
    {
      author: "demo",
      branch,
      message: "Create typed summary contract",
      sha: "9c12d4e",
      time: "demo fixture",
      url: "",
    },
  ];
}

async function createDemoPullRequest(
  env: Env,
  body: {
    baseBranch?: string;
    branch?: string;
    repository?: string;
    title?: string;
  },
) {
  const prNumber = Math.floor(100 + Math.random() * 900);
  const repository = body.repository ?? "demo/pr-helper-mini";
  const prUrl = `https://github.com/${repository}/pull/${prNumber}`;
  const sessionId = await savePullRequestMetadata(env, {
    baseBranch: body.baseBranch ?? "main",
    branch: body.branch ?? "feature/demo",
    prNumber,
    prUrl,
    repository,
    title: body.title ?? "Demo pull request",
  });

  return json({
    mode: "demo",
    pullRequest: {
      number: prNumber,
      url: prUrl,
    },
    sessionId,
  });
}

async function savePullRequestMetadata(
  env: Env,
  input: {
    baseBranch: string;
    branch: string;
    prNumber: number;
    prUrl: string;
    repository: string;
    title: string;
  },
) {
  const sessionId = crypto.randomUUID();

  try {
    await env.DB.prepare(
      `insert into pr_flow_sessions (id, repository, branch, base_branch, branch_goal_summary, status, pr_url)
       values (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(sessionId, input.repository, input.branch, input.baseBranch, input.title, "pr_created", input.prUrl)
      .run();

    await env.DB.prepare(
      `insert into created_prs (id, session_id, github_pr_number, pr_url, title)
       values (?, ?, ?, ?, ?)`,
    )
      .bind(crypto.randomUUID(), sessionId, input.prNumber, input.prUrl, input.title)
      .run();

    return { sessionId };
  } catch (error) {
    return {
      sessionId,
      warning:
        error instanceof Error
          ? `PR は作成済みですが metadata 保存に失敗しました。local D1 migration を確認してください: ${error.message}`
          : "PR は作成済みですが metadata 保存に失敗しました。local D1 migration を確認してください。",
    };
  }
}

async function githubRequest<T>(env: Env, path: string): Promise<T> {
  const jwt = await createGitHubAppJwt(env);
  const response = await fetch(`https://api.github.com${path}`, {
    headers: githubHeaders(jwt),
  });

  if (!response.ok) {
    throw new Error(`GitHub request failed: ${response.status}`);
  }

  return response.json();
}

async function createInstallationToken(env: Env, installationId: number) {
  const jwt = await createGitHubAppJwt(env);
  const response = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
    headers: githubHeaders(jwt),
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Failed to create installation token: ${response.status}`);
  }

  const body = (await response.json()) as { token: string };
  return body.token;
}

async function ensureBranch(token: string, repository: string, baseBranch: string, branch: string) {
  const existing = await fetch(`https://api.github.com/repos/${repository}/git/ref/heads/${encodeURIComponent(branch)}`, {
    headers: githubHeaders(token),
  });

  if (existing.ok) return;
  if (existing.status !== 404) {
    throw new Error(`Failed to inspect branch: ${existing.status}`);
  }

  const baseRef = await fetch(
    `https://api.github.com/repos/${repository}/git/ref/heads/${encodeURIComponent(baseBranch)}`,
    {
      headers: githubHeaders(token),
    },
  );

  if (!baseRef.ok) {
    throw new Error(`Failed to load base branch: ${baseRef.status}`);
  }

  const baseRefBody = (await baseRef.json()) as { object: { sha: string } };
  const created = await fetch(`https://api.github.com/repos/${repository}/git/refs`, {
    body: JSON.stringify({
      ref: `refs/heads/${branch}`,
      sha: baseRefBody.object.sha,
    }),
    headers: githubHeaders(token),
    method: "POST",
  });

  if (!created.ok) {
    throw new Error(`Failed to create branch: ${created.status}`);
  }
}

async function readBranchSha(token: string, repository: string, branch: string) {
  const response = await fetch(`https://api.github.com/repos/${repository}/git/ref/heads/${encodeURIComponent(branch)}`, {
    headers: githubHeaders(token),
  });

  if (!response.ok) {
    throw new Error(`Failed to load branch: ${response.status}`);
  }

  const body = (await response.json()) as { object: { sha: string } };
  return body.object.sha;
}

async function loadRepositoryTextFiles(token: string, repository: string, ref: string) {
  const treeResponse = await fetch(
    `https://api.github.com/repos/${repository}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
    {
      headers: githubHeaders(token),
    },
  );

  if (!treeResponse.ok) {
    throw new Error(`tree API returned HTTP ${treeResponse.status}`);
  }

  const treeBody = (await treeResponse.json()) as GitHubTreeResponse;
  const blobCount = treeBody.tree.filter((item) => item.type === "blob").length;
  const candidates = treeBody.tree
    .filter((item) => item.type === "blob")
    .filter((item) => item.size !== undefined && item.size <= maxSingleFileBytes)
    .filter((item) => isLikelyTextPath(item.path))
    .sort((left, right) => compareRepositoryPath(left.path, right.path))
    .slice(0, maxRepositoryFiles);

  const files: Record<string, string> = {};
  let totalBytes = 0;
  let skippedByBudget = 0;

  for (const item of candidates) {
    const nextTotal = totalBytes + (item.size ?? 0);
    if (nextTotal > maxRepositoryBytes) {
      skippedByBudget += 1;
      continue;
    }

    const blobResponse = await fetch(`https://api.github.com/repos/${repository}/git/blobs/${item.sha}`, {
      headers: githubHeaders(token),
    });

    if (!blobResponse.ok) {
      skippedByBudget += 1;
      continue;
    }

    const blob = (await blobResponse.json()) as GitHubBlobResponse;
    if (blob.encoding !== "base64") {
      skippedByBudget += 1;
      continue;
    }

    files[item.path] = base64DecodeUtf8(blob.content);
    totalBytes = nextTotal;
  }

  return {
    files,
    limits: {
      maxFiles: maxRepositoryFiles,
      maxSingleFileBytes,
      maxTotalBytes: maxRepositoryBytes,
    },
    skipped: Math.max(0, blobCount - candidates.length) + skippedByBudget,
    truncated: treeBody.truncated,
  };
}

async function writeContentChange(
  token: string,
  input: {
    branch: string;
    change: {
      content?: string;
      path: string;
      status: "added" | "deleted" | "modified";
    };
    commitMessage: string;
    repository: string;
  },
) {
  const currentFile = await fetch(
    `https://api.github.com/repos/${input.repository}/contents/${encodePath(input.change.path)}?ref=${encodeURIComponent(input.branch)}`,
    {
      headers: githubHeaders(token),
    },
  );
  const currentFileBody = currentFile.ok ? ((await currentFile.json()) as { sha: string }) : undefined;

  if (input.change.status === "deleted") {
    if (!currentFileBody?.sha) return undefined;
    const deleted = await fetch(
      `https://api.github.com/repos/${input.repository}/contents/${encodePath(input.change.path)}`,
      {
        body: JSON.stringify({
          branch: input.branch,
          message: input.commitMessage,
          sha: currentFileBody.sha,
        }),
        headers: githubHeaders(token),
        method: "DELETE",
      },
    );

    if (!deleted.ok) {
      throw new Error(`Failed to delete ${input.change.path}: ${deleted.status}`);
    }

    return deleted.json() as Promise<{ commit?: { sha: string } }>;
  }

  const written = await fetch(
    `https://api.github.com/repos/${input.repository}/contents/${encodePath(input.change.path)}`,
    {
      body: JSON.stringify({
        branch: input.branch,
        content: base64Encode(input.change.content ?? ""),
        message: input.commitMessage,
        sha: currentFileBody?.sha,
      }),
      headers: githubHeaders(token),
      method: "PUT",
    },
  );

  if (!written.ok) {
    throw new Error(`Failed to write ${input.change.path}: ${written.status}`);
  }

  return written.json() as Promise<{ commit?: { sha: string } }>;
}

function encodePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function isLikelyTextPath(path: string) {
  if (/(^|\/)(node_modules|dist|build|coverage|\.git|\.next|\.turbo)\//.test(path)) return false;
  if (/\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|tgz|woff2?|ttf|otf|mp4|mov|wasm)$/i.test(path)) return false;
  if (/(^|\/)(README|LICENSE|CHANGELOG|Dockerfile|Makefile)$/i.test(path)) return true;
  return /\.(ts|tsx|js|jsx|mjs|cjs|json|md|mdx|css|scss|html|yml|yaml|toml|txt|env\.example)$/i.test(path);
}

function compareRepositoryPath(left: string, right: string) {
  return repositoryPathScore(left) - repositoryPathScore(right) || left.localeCompare(right);
}

function repositoryPathScore(path: string) {
  if (/^README(\.|$)/i.test(path)) return 0;
  if (path === "package.json") return 1;
  if (path.startsWith("src/")) return 2;
  if (path.startsWith("apps/") || path.startsWith("packages/")) return 3;
  if (path.startsWith("docs/")) return 4;
  return 5;
}

function base64Encode(text: string) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64DecodeUtf8(value: string) {
  const binary = atob(value.replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder().decode(bytes);
}

function githubHeaders(token: string) {
  return {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "user-agent": "Git AI IDE",
    "x-github-api-version": "2022-11-28",
  };
}

async function createGitHubAppJwt(env: Env) {
  if (!env.GITHUB_APP_ID || !env.GITHUB_APP_PRIVATE_KEY) {
    throw new Error("GitHub App secrets are not configured.");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlJson({ alg: "RS256", typ: "JWT" });
  const payload = base64UrlJson({
    exp: now + 540,
    iat: now - 60,
    iss: env.GITHUB_APP_ID,
  });
  const signingInput = `${header}.${payload}`;
  const key = await importPrivateKey(env.GITHUB_APP_PRIVATE_KEY);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput));

  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
}

async function importPrivateKey(privateKeyPem: string) {
  const normalized = privateKeyPem.replace(/\\n/g, "\n");
  if (normalized.includes("-----BEGIN RSA PRIVATE KEY-----")) {
    throw new Error("GITHUB_APP_PRIVATE_KEY must be PKCS#8 PEM. Convert RSA PRIVATE KEY to PRIVATE KEY.");
  }
  const body = normalized
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const binary = Uint8Array.from(atob(body), (character) => character.charCodeAt(0));

  return crypto.subtle.importKey(
    "pkcs8",
    binary,
    {
      hash: "SHA-256",
      name: "RSASSA-PKCS1-v1_5",
    },
    false,
    ["sign"],
  );
}

function base64UrlJson(value: unknown) {
  return base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

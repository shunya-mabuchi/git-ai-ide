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
      const sessionId = await savePullRequestMetadata(env, {
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
        sessionId,
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

  return sessionId;
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

function base64Encode(text: string) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
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

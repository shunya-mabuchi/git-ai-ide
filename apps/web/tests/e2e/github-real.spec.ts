import { expect, test } from "@playwright/test";

const runRealGitHubE2E = process.env.GIT_AI_IDE_REAL_GITHUB_E2E === "1";
const runRealGitHubWriteE2E = process.env.GIT_AI_IDE_REAL_GITHUB_WRITE_E2E === "1";
const workerBaseUrl = process.env.VITE_GIT_AI_IDE_WORKER_URL ?? "http://127.0.0.1:8787";

test.describe("GitHub App real credentials E2E", () => {
  test.skip(!runRealGitHubE2E, "GIT_AI_IDE_REAL_GITHUB_E2E=1 の環境だけで実 GitHub App E2E を実行します。");

  test("Worker が実 credentials と selected repository を返す", async ({ request }) => {
    const setupResponse = await request.get(`${workerBaseUrl}/api/github/setup`);
    await expect(setupResponse).toBeOK();
    const setup = await setupResponse.json();
    expect(setup.appConfigured).toBe(true);

    const installationsResponse = await request.get(`${workerBaseUrl}/api/github/installations`);
    await expect(installationsResponse).toBeOK();
    const installations = (await installationsResponse.json()).installations as Array<{ id: number }>;
    expect(installations.length).toBeGreaterThan(0);

    const reposResponse = await request.get(`${workerBaseUrl}/api/github/repos?installation_id=${installations[0].id}`);
    await expect(reposResponse).toBeOK();
    const repos = (await reposResponse.json()).repositories as Array<{ fullName: string }>;
    expect(repos.length).toBeGreaterThan(0);
  });

  test("Web UI から branch push と PR 作成まで完走できる", async ({ page }) => {
    test.skip(!runRealGitHubWriteE2E, "GIT_AI_IDE_REAL_GITHUB_WRITE_E2E=1 の環境だけで selected repository へ書き込みます。");

    const branchName = `feature/ui-real-e2e-${Date.now()}`;
    const closeIssueNumber = process.env.GIT_AI_IDE_REAL_GITHUB_CLOSE_ISSUE ?? "77";

    await page.goto("/");
    await page.getByLabel("Git").click();

    await expect(page.getByText("GitHub App configured / selected repo mode")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByLabel(/Selected repository/)).toHaveValue("shunya-mabuchi/git-ai-ide");

    await page.locator(".branch-input").first().locator("input").fill(branchName);
    await page.getByRole("button", { name: "Branch 作成" }).click();
    await expect(page.locator(".branch-list")).toContainText(branchName, { timeout: 30_000 });

    await page.getByLabel("Close issue").fill(closeIssueNumber);
    await page.getByRole("button", { name: "Patch を適用" }).click();
    await page.getByRole("button", { name: /Runtime checks/ }).click();
    await expect(page.locator(".bottom-panel")).toContainText("Runtime checks passed", { timeout: 60_000 });
    await page.getByRole("button", { exact: true, name: "Local Preview" }).click();
    await expect(page.locator(".editor-tabs .preview-tab")).toBeVisible({ timeout: 60_000 });
    await expect(page.locator(".editor-surface .preview-iframe")).toBeVisible({ timeout: 60_000 });
    await page.getByRole("button", { name: "PR 説明を生成" }).click();
    await expect(page.locator(".bottom-panel")).toContainText("Safety gate", { timeout: 30_000 });
    await page.getByRole("button", { name: "Commit draft" }).click();
    await expect(page.locator(".commit-box")).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Push" }).click();
    await expect(page.locator(".github-box")).toContainText("branch pushed", { timeout: 60_000 });
    await expect(page.getByRole("button", { name: "PR 作成" })).toBeEnabled({ timeout: 30_000 });

    await page.getByRole("button", { name: "PR 作成" }).click();

    const prLink = page.locator(".github-box a").filter({ hasText: /github\.com\/shunya-mabuchi\/git-ai-ide\/pull\// });
    await expect(prLink).toBeVisible({ timeout: 60_000 });
    await expect(page.locator(".github-box")).toContainText("GitHub PR created");
  });
});

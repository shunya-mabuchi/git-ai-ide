import { expect, test } from "@playwright/test";

const runRealGitHubE2E = process.env.GIT_AI_IDE_REAL_GITHUB_E2E === "1";
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
});

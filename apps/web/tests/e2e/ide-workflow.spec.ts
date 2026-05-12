import { expect, test } from "@playwright/test";

test.describe("Git AI IDE workflow", () => {
  test("Explorer でファイル操作を行い Git panel で差分と branch context を確認できる", async ({ page }) => {
    await page.goto("/");

    if (!(await page.getByText("New file").isVisible())) {
      await page.getByLabel("Explorer").click();
    }
    await expect(page.getByText("New file")).toBeVisible();

    const newFileInput = page.locator(".file-operation-panel input").first();
    await newFileInput.fill("src/features/pr-summary/e2e-note.md");
    await page.getByTitle("ファイルを作成").click();

    await expect(page.locator(".file-list").getByRole("button", { name: "e2e-note.md" })).toBeVisible();

    await page.getByLabel("Git").click();
    const githubBox = page.locator(".github-box");
    await expect(page.getByText("Demo Source Control")).toBeVisible();
    await expect(page.getByText("実 GitHub repository には接続していません")).toBeVisible();
    await expect(githubBox.getByText("実操作モード setup")).toBeVisible();
    const setupItems = githubBox.locator(".setup-checklist li strong");
    await expect(setupItems.filter({ hasText: "Worker connection" })).toBeVisible();
    await expect(setupItems.filter({ hasText: "GitHub App credentials" })).toBeVisible();
    await expect(setupItems.filter({ hasText: "Installation" })).toBeVisible();
    await expect(setupItems.filter({ hasText: "Selected repository" })).toBeVisible();
    await expect(page.getByText("Branches")).toBeVisible();
    await expect(page.getByText("Merge readiness")).toBeVisible();
    await expect(page.getByRole("heading", { name: "History" })).toBeVisible();
    await expect(page.getByRole("button", { name: /e2e-note\.md added/ })).toBeVisible();

    await page.getByRole("button", { name: "競合デモ" }).click();
    await expect(page.getByText("Conflict handling")).toBeVisible();
  });

  test("Assisted Memory を project key ごとに保存して復元できる", async ({ page }) => {
    await page.goto("/");

    if (!(await page.getByRole("heading", { name: "Assisted Memory" }).isVisible())) {
      await page.getByLabel("AI Assistant を表示").click();
    }
    await expect(page.getByRole("heading", { name: "Assisted Memory" })).toBeVisible();

    const memoryEditor = page.locator(".memory-editor");
    await memoryEditor.fill("PR description では reviewer が見る risk と test plan を先に書く。");
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.getByText("project:")).toBeVisible();

    await page.reload();
    if (!(await page.getByRole("heading", { name: "Assisted Memory" }).isVisible())) {
      await page.getByLabel("AI Assistant を表示").click();
    }
    await expect(memoryEditor).toHaveValue("PR description では reviewer が見る risk と test plan を先に書く。");
  });

  test("Local Preview を editor tab として開き file tab に戻れる", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: /Local Preview/ }).click();

    await expect(page.locator(".editor-tabs .preview-tab")).toBeVisible();
    await expect(page.locator(".editor-surface .preview-panel")).toBeVisible();
    await expect(page.locator(".editor-surface")).toContainText("Local Preview");

    await page.locator(".editor-tabs .tab", { hasText: "generateSummary.ts" }).click();

    await expect(page.locator(".editor-surface .lf-monaco-editor")).toBeVisible();
    await expect(page.locator(".editor-tabs .preview-tab")).toBeVisible();
  });
});

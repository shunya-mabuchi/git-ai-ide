import { expect, test } from "@playwright/test";

test.describe("Git AI IDE workflow", () => {
  test("通常起動では repo 接続導線を表示する", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("Repository を開いてください")).toBeVisible();
    await expect(page.getByText("Demo Source Control")).toHaveCount(0);
    await expect(page.getByText("Demo repository")).toHaveCount(0);
  });

  test("Explorer でファイル操作を行い Git panel で差分と branch context を確認できる", async ({ page }) => {
    await page.goto("/?fixture=demo");

    if (!(await page.getByText("New file").isVisible())) {
      await page.getByLabel("Explorer").click();
    }
    await expect(page.getByText("New file")).toBeVisible();

    const newFileInput = page.locator(".file-operation-panel input").first();
    await newFileInput.fill("src/features/pr-summary/e2e-note.md");
    await page.getByTitle("ファイルを作成").click();

    await expect(page.locator(".file-list").getByRole("button", { name: "e2e-note.md" })).toBeVisible();

    const newFolderInput = page.locator(".file-operation-panel input").nth(1);
    await newFolderInput.fill("src/features/pr-summary/e2e-folder");
    await page.getByTitle("フォルダを作成").click();
    await expect(page.locator(".file-list").getByRole("button", { name: "e2e-folder" })).toBeVisible();

    await page.getByLabel("Git").click();
    const githubBox = page.locator(".github-box");
    await expect(page.getByText(/GitHub Source Control|GitHub connection required/)).toBeVisible();
    await expect(page.getByText("Demo Source Control")).toHaveCount(0);
    await expect(githubBox.getByText("実操作モード setup")).toBeVisible();
    const setupItems = githubBox.locator(".setup-checklist li strong");
    await expect(setupItems.filter({ hasText: "Worker connection" })).toBeVisible();
    await expect(setupItems.filter({ hasText: "GitHub App credentials" })).toBeVisible();
    await expect(setupItems.filter({ hasText: "Installation" })).toBeVisible();
    await expect(setupItems.filter({ hasText: "Selected repository" })).toBeVisible();
    await expect(page.getByText("Branches")).toBeVisible();
    await expect(page.getByText("Merge readiness")).toBeVisible();
    await expect(page.getByRole("heading", { name: "History" })).toBeVisible();
    await page.getByLabel("Close issue").fill("72");
    await expect(page.getByLabel("Close issue")).toHaveValue("72");
    await expect(page.getByRole("button", { name: /e2e-note\.md added/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /e2e-folder\/\.gitkeep added/ })).toBeVisible();

    await page.getByRole("button", { name: "fixture 競合" }).click();
    await expect(page.getByText("Conflict handling")).toBeVisible();
  });

  test("編集 dirty と保存状態は Git diff と分離して扱える", async ({ page }) => {
    await page.goto("/?fixture=demo");

    await page.locator(".monaco-editor").click();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type("export function generateSummary() { return 'edited by e2e'; }\n");

    await expect(page.locator(".editor-tabs .tab", { hasText: "generateSummary.ts *" })).toBeVisible();
    await expect(page.locator(".editor-tab-actions")).toContainText("未保存");

    await page.locator(".editor-tab-actions").getByRole("button", { name: /^保存$/ }).click();

    await expect(page.locator(".editor-tabs .tab", { hasText: "generateSummary.ts *" })).toHaveCount(0);
    await expect(page.locator(".editor-tab-actions")).toContainText("保存済み");

    await page.getByLabel("Git").click();
    await expect(page.getByRole("button", { name: /generateSummary\.ts modified/ })).toBeVisible();
  });

  test("rename と delete 後に tab / selected file / Git diff が同期する", async ({ page }) => {
    await page.goto("/?fixture=demo");

    if (!(await page.getByText("New file").isVisible())) {
      await page.getByLabel("Explorer").click();
    }

    await page.locator(".file-operation-panel input").nth(2).fill("src/features/pr-summary/renamed-note.md");
    await page.getByTitle("選択中ファイルを改名").click();
    await expect(page.locator(".editor-tabs .tab", { hasText: "renamed-note.md" })).toBeVisible();
    await expect(page.locator(".file-list").getByRole("button", { name: "renamed-note.md" })).toBeVisible();

    await page.locator(".file-list").getByRole("button", { name: "renamed-note.md" }).click();
    await page.getByTitle("選択中ファイルを削除").click();
    await expect(page.locator(".editor-tabs .tab", { hasText: "Diff: src/features/pr-summary/renamed-note.md" })).toBeVisible();
    await expect(page.locator(".context-pack-details")).toContainText("README.md");

    await page.getByLabel("Git").click();
    await expect(page.getByRole("button", { name: /generateSummary\.ts deleted/ })).toBeVisible();
  });

  test("WebLLM model load 診断は WebGPU 非対応環境で fallback reason を表示する", async ({ page }) => {
    await page.goto("/?fixture=demo");

    if (!(await page.getByRole("button", { name: /WebLLM model load 診断/ }).isVisible())) {
      await page.getByLabel("AI Assistant を表示").click();
    }

    await page.getByRole("button", { name: /WebLLM model load 診断/ }).click();

    await expect(page.locator(".diagnostic-log").filter({ hasText: "model: Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC" })).toBeVisible();
    await expect(page.locator(".diagnostic-log").filter({ hasText: /mode: (unavailable|webllm)/ })).toBeVisible();
  });

  test("Assisted Memory を project key ごとに保存して復元できる", async ({ page }) => {
    await page.goto("/?fixture=demo");

    if (!(await page.getByRole("heading", { name: "Assisted Memory" }).isVisible())) {
      await page.getByLabel("AI Assistant を表示").click();
    }
    await expect(page.getByRole("heading", { name: "Assisted Memory" })).toBeVisible();

    const memoryEditor = page.locator(".memory-editor");
    await memoryEditor.fill("PR description では reviewer が見る risk と test plan を先に書く。");
    await page.locator(".assistant-panel").getByRole("button", { name: /^保存$/ }).click();
    await expect(page.getByText("project:")).toBeVisible();

    await page.reload();
    if (!(await page.getByRole("heading", { name: "Assisted Memory" }).isVisible())) {
      await page.getByLabel("AI Assistant を表示").click();
    }
    await expect(memoryEditor).toHaveValue("PR description では reviewer が見る risk と test plan を先に書く。");
  });

  test("Local Preview を editor tab として開き file tab に戻れる", async ({ page }) => {
    await page.goto("/?fixture=demo");

    await expect.poll(() => page.evaluate(() => window.crossOriginIsolated)).toBe(true);

    await page.getByRole("button", { name: /Local Preview/ }).click();

    await expect(page.locator(".editor-tabs .preview-tab")).toBeVisible();
    await expect(page.locator(".editor-surface .preview-panel")).toBeVisible();
    await expect(page.getByLabel("Preview URL")).toBeVisible();
    await expect(page.locator(".editor-surface")).not.toContainText("Preview diagnostics");

    await page.getByLabel("Preview URL").fill("localhost:5173");
    await page.locator(".preview-addressbar").getByRole("button", { name: "開く" }).click();
    await expect(page.locator(".editor-surface .preview-iframe")).toBeVisible();
    await expect(page.locator(".editor-surface .preview-iframe")).toHaveAttribute("src", "http://localhost:5173");

    await page.locator(".editor-tabs .tab", { hasText: "generateSummary.ts" }).click();

    await expect(page.locator(".editor-surface .lf-monaco-editor")).toBeVisible();
    await expect(page.locator(".editor-tabs .preview-tab")).toBeVisible();
  });

  test("Patch Queue で複数 proposal を積み、reject と apply ができる", async ({ page }) => {
    await page.goto("/?fixture=demo");

    if (!(await page.getByRole("heading", { name: "Patch Queue" }).isVisible())) {
      await page.getByLabel("AI Assistant を表示").click();
    }

    await expect(page.getByRole("heading", { name: "Patch Queue" })).toBeVisible();
    await page.getByRole("button", { name: "AI patch を生成" }).click();

    await expect(page.locator(".patch-queue-item")).toHaveCount(2);
    await expect(page.locator(".patch-card")).toContainText("source: ai");

    await page.getByRole("button", { name: "Reject" }).click();
    await expect(page.locator(".patch-card")).toContainText("reject");
    await expect(page.locator(".patch-card")).toContainText("reason:");

    await page.locator(".patch-queue-item").nth(1).click();
    await page.getByRole("button", { name: "Diff を確認" }).click();
    await expect(page.locator(".lf-monaco-diff")).toBeVisible();

    await page.getByRole("button", { name: "確認して適用" }).click();
    await expect(page.locator(".patch-card")).toContainText("適用済み");
  });
});

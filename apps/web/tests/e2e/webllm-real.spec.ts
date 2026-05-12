import { expect, test } from "@playwright/test";

const runWebLlmE2E = process.env.GIT_AI_IDE_WEBLLM_E2E === "1";

test.describe("WebLLM model load E2E", () => {
  test.skip(!runWebLlmE2E, "GIT_AI_IDE_WEBLLM_E2E=1 の WebGPU 対応環境だけで実 WebLLM model load を実行します。");

  test("WebGPU 対応ブラウザで model load と completion を確認できる", async ({ page }) => {
    await page.goto("/");

    if (!(await page.getByRole("button", { name: /WebLLM model load 診断/ }).isVisible())) {
      await page.getByLabel("AI Assistant を表示").click();
    }

    await expect.poll(() => page.evaluate(() => Boolean(navigator.gpu))).toBe(true);

    await page.getByRole("button", { name: /WebLLM model load 診断/ }).click();

    const log = page.locator(".diagnostic-log").filter({ hasText: "model: Qwen2.5-0.5B-Instruct-q4f16_1-MLC" });
    await expect(log).toContainText("mode: webllm", { timeout: 180_000 });
    await expect(log).toContainText("completion:");
  });
});

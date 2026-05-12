import { expect, test } from "@playwright/test";

const runWebContainerE2E = process.env.GIT_AI_IDE_WEBCONTAINER_E2E === "1";

test.describe("WebContainer iframe preview E2E", () => {
  test.skip(!runWebContainerE2E, "GIT_AI_IDE_WEBCONTAINER_E2E=1 の環境だけで実 WebContainer preview を実行します。");

  test("dev server URL を Preview tab の iframe に接続できる", async ({ page }) => {
    await page.goto("/?preview=webcontainer");

    await expect.poll(() => page.evaluate(() => window.crossOriginIsolated)).toBe(true);

    await page.getByRole("button", { name: /Local Preview/ }).click();

    const iframe = page.locator(".editor-surface .preview-iframe");
    await expect(iframe).toBeVisible({ timeout: 90_000 });
    await expect.poll(async () => iframe.getAttribute("src"), { timeout: 90_000 }).toMatch(/^https?:\/\//);
  });
});

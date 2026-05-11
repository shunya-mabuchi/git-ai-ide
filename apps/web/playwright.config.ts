import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PORT ?? 5173);

export default defineConfig({
  expect: {
    timeout: 10_000,
  },
  fullyParallel: true,
  outputDir: "test-results",
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { height: 900, width: 1440 },
      },
    },
  ],
  reporter: [["list"]],
  testDir: "tests/e2e",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `pnpm dev -- --port ${port}`,
    reuseExistingServer: true,
    timeout: 120_000,
    url: `http://127.0.0.1:${port}`,
  },
});

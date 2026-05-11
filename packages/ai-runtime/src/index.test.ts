import { describe, expect, it } from "vitest";
import { detectBrowserAiRuntime, planRuntimeFromPackageJson } from "./index";

describe("detectBrowserAiRuntime", () => {
  it("uses recorded mode when WebGPU and Ollama are unavailable", async () => {
    const status = await detectBrowserAiRuntime({
      fetchImpl: async () => {
        throw new Error("connection refused");
      },
      navigatorLike: {},
      timeoutMs: 10,
    });

    expect(status.recommendedProvider).toBe("recorded");
    expect(status.webGpuAvailable).toBe(false);
    expect(status.ollamaAvailable).toBe(false);
    expect(status.providers.find((provider) => provider.provider === "recorded")?.status).toBe("available");
    expect(status.providers.find((provider) => provider.provider === "webllm")?.status).toBe("unavailable");
    expect(status.providers.find((provider) => provider.provider === "ollama")?.status).toBe("unavailable");
  });

  it("recommends WebLLM when WebGPU is available and Ollama is unavailable", async () => {
    const status = await detectBrowserAiRuntime({
      fetchImpl: async () => {
        throw new Error("connection refused");
      },
      navigatorLike: { gpu: {} },
      timeoutMs: 10,
    });

    expect(status.recommendedProvider).toBe("webllm");
    expect(status.webGpuAvailable).toBe(true);
    expect(status.ollamaAvailable).toBe(false);
    expect(status.providers.find((provider) => provider.provider === "webllm")?.status).toBe("available");
  });

  it("recommends Ollama when localhost models are detected", async () => {
    const status = await detectBrowserAiRuntime({
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            models: [{ name: "qwen2.5-coder:7b" }],
          }),
          { status: 200 },
        ),
      navigatorLike: {},
      timeoutMs: 10,
    });

    expect(status.recommendedProvider).toBe("ollama");
    expect(status.ollamaAvailable).toBe(true);
    expect(status.providers.find((provider) => provider.provider === "ollama")?.modelIds).toEqual(["qwen2.5-coder:7b"]);
    expect(status.models.some((model) => model.modelId === "qwen2.5-coder:7b")).toBe(true);
  });
});

describe("planRuntimeFromPackageJson", () => {
  it("uses npm commands when no lockfile is present", () => {
    expect(
      planRuntimeFromPackageJson({
        "package.json": JSON.stringify({
          scripts: {
            build: "vite build",
            dev: "vite --host 0.0.0.0",
            preview: "vite preview",
            test: "vitest run",
            typecheck: "tsc --noEmit",
          },
        }),
      }),
    ).toMatchObject({
      buildCommand: "npm run build",
      devCommand: "npm run dev",
      installCommand: "npm install",
      previewCommand: "npm run preview",
      testCommand: "npm run test",
      typecheckCommand: "npm run typecheck",
    });
  });

  it("uses pnpm commands when pnpm-lock.yaml is present", () => {
    expect(
      planRuntimeFromPackageJson({
        "package.json": JSON.stringify({
          scripts: {
            test: "vitest run",
          },
        }),
        "pnpm-lock.yaml": "lockfileVersion: 9.0",
      }),
    ).toMatchObject({
      installCommand: "pnpm install",
      testCommand: "pnpm run test",
    });
  });
});

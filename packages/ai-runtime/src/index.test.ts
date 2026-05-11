import { describe, expect, it } from "vitest";
import { detectBrowserAiRuntime, generatePatchProposal, parseLlmPatchProposal, planRuntimeFromPackageJson } from "./index";

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

describe("generatePatchProposal", () => {
  it("creates a structured edit for the PR summary demo file", () => {
    const result = generatePatchProposal({
      branchGoalMarkdown: "# Branch Goal\n\nPR summary を改善する",
      currentFile: {
        content: `export function generateSummary(diff: string) {
  const changedFiles = extractChangedFiles(diff);

  return { changedFiles };
}
`,
        path: "src/features/pr-summary/generateSummary.ts",
      },
      mode: "recorded",
    });

    expect(result).toMatchObject({
      ok: true,
      proposal: {
        edits: [
          {
            file: "src/features/pr-summary/generateSummary.ts",
            operation: "replace",
          },
        ],
        status: "ready",
        title: "空の diff 入力を扱う",
      },
    });
  });

  it("returns a safe failure when the current file is empty", () => {
    expect(
      generatePatchProposal({
        branchGoalMarkdown: "# Branch Goal",
        currentFile: {
          content: "",
          path: "README.md",
        },
        mode: "recorded",
      }),
    ).toMatchObject({
      ok: false,
      error: "現在のファイルが空のため、structured edit を生成できません。",
    });
  });
});

describe("parseLlmPatchProposal", () => {
  it("parses valid structured edit JSON into a patch proposal", () => {
    expect(
      parseLlmPatchProposal({
        allowedFiles: ["src/App.tsx"],
        branchGoalMarkdown: "# Branch Goal",
        mode: "ollama",
        rawText: JSON.stringify({
          edits: [
            {
              file: "src/App.tsx",
              find: "const title = 'old';",
              operation: "replace",
              reason: "タイトルを branch goal に合わせるため。",
              replacement: "const title = 'new';",
            },
          ],
          summary: "タイトルを更新します。",
          title: "タイトル更新",
        }),
      }),
    ).toMatchObject({
      ok: true,
      proposal: {
        edits: [
          {
            file: "src/App.tsx",
            operation: "replace",
          },
        ],
        status: "ready",
      },
    });
  });

  it("rejects invalid JSON", () => {
    expect(
      parseLlmPatchProposal({
        branchGoalMarkdown: "# Branch Goal",
        mode: "ollama",
        rawText: "not json",
      }),
    ).toMatchObject({
      ok: false,
      error: "LLM response に JSON object が見つかりませんでした。",
    });
  });

  it("rejects edits outside allowed files", () => {
    expect(
      parseLlmPatchProposal({
        allowedFiles: ["src/App.tsx"],
        branchGoalMarkdown: "# Branch Goal",
        mode: "ollama",
        rawText: JSON.stringify({
          edits: [
            {
              file: "package.json",
              find: "\"name\"",
              operation: "replace",
              reason: "不正な対象を試すため。",
              replacement: "\"private\"",
            },
          ],
          summary: "不正な対象です。",
          title: "対象外 edit",
        }),
      }),
    ).toMatchObject({
      ok: false,
      error: "許可されていない file path への edit です: package.json",
    });
  });
});

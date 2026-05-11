import { describe, expect, it } from "vitest";
import { detectBrowserAiRuntime, generatePatchProposal, parseLlmPatchProposal, planRuntimeFromPackageJson, requestPatchProposal } from "./index";

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

describe("requestPatchProposal", () => {
  it("calls Ollama generate and validates the structured response", async () => {
    const calls: Array<{ body: unknown; url: string }> = [];
    const fetchImpl = (async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
        url: String(url),
      });

      return new Response(
        JSON.stringify({
          response: JSON.stringify({
            edits: [
              {
                file: "src/App.tsx",
                find: "const title = 'old';",
                operation: "replace",
                reason: "Branch Goal に合わせるため。",
                replacement: "const title = 'new';",
              },
            ],
            summary: "タイトルを更新します。",
            title: "タイトル更新",
          }),
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await requestPatchProposal({
      branchGoalMarkdown: "# Branch Goal",
      currentFile: {
        content: "const title = 'old';",
        path: "src/App.tsx",
      },
      fetchImpl,
      mode: "ollama",
      modelId: "qwen2.5-coder:7b",
      ollamaBaseUrl: "http://localhost:11434",
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      body: {
        format: "json",
        model: "qwen2.5-coder:7b",
        stream: false,
      },
      url: "http://localhost:11434/api/generate",
    });
    expect(result).toMatchObject({
      ok: true,
      mode: "ollama",
      proposal: {
        title: "タイトル更新",
      },
    });
  });

  it("falls back to recorded proposal when Ollama fails", async () => {
    const fetchImpl = (async () => new Response("{}", { status: 500 })) as typeof fetch;

    const result = await requestPatchProposal({
      branchGoalMarkdown: "# Branch Goal",
      currentFile: {
        content: `export function generateSummary(diff: string) {
  const changedFiles = extractChangedFiles(diff);
}`,
        path: "src/features/pr-summary/generateSummary.ts",
      },
      fetchImpl,
      mode: "ollama",
      modelId: "qwen2.5-coder:7b",
    });

    expect(result).toMatchObject({
      ok: true,
      mode: "recorded",
      proposal: {
        title: "空の diff 入力を扱う",
      },
    });
    expect(result.warnings[0]).toContain("Ollama request に失敗しました");
  });
});

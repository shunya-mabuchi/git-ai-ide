import type { AiTask, ContextPack, ModelCapability, PatchProposal, RuntimePlan } from "@git-ai-ide/shared";

export type AiRuntimeStatus = {
  webGpuAvailable: boolean;
  ollamaAvailable: boolean;
  recommendedProvider: "webllm" | "ollama" | "recorded";
  models: ModelCapability[];
  providers: AiProviderHealth[];
};

export type AiProviderHealth = {
  provider: "webllm" | "ollama" | "recorded";
  status: "available" | "unavailable" | "checking";
  label: string;
  detail: string;
  modelIds: string[];
};

export function recommendModelForTask(status: AiRuntimeStatus, task: AiTask): ModelCapability | undefined {
  return status.models.find((model) => model.recommendedTasks.includes(task));
}

export type AiExecutionMode = "recorded" | "webllm" | "ollama";

export type AiTaskRequest = {
  context: ContextPack;
  mode: AiExecutionMode;
  task: AiTask;
};

export type AiTaskResult = {
  mode: AiExecutionMode;
  summary: string;
  warnings: string[];
};

export type PatchProposalRequest = {
  branchGoalMarkdown: string;
  currentFile: {
    content: string;
    path: string;
  };
  mode: AiExecutionMode;
};

export type PatchProposalResult =
  | {
      ok: true;
      mode: AiExecutionMode;
      proposal: PatchProposal;
      warnings: string[];
    }
  | {
      ok: false;
      mode: AiExecutionMode;
      error: string;
      warnings: string[];
    };

export const recordedDemoModel: ModelCapability = {
  provider: "recorded",
  modelId: "recorded-demo",
  contextWindow: 8000,
  speedTier: "fast",
  qualityTier: "small",
  supportsJsonMode: true,
  supportsStreaming: true,
  recommendedTasks: [
    "diff_summary",
    "commit_message",
    "pr_description",
    "selected_range_patch",
    "risk_checklist",
  ],
};

export const webLlmSmallModel: ModelCapability = {
  provider: "webllm",
  modelId: "webllm-small-browser",
  contextWindow: 4096,
  speedTier: "medium",
  qualityTier: "small",
  supportsJsonMode: false,
  supportsStreaming: true,
  recommendedTasks: ["diff_summary", "risk_checklist", "commit_message"],
};

export const ollamaLocalModel: ModelCapability = {
  provider: "ollama",
  modelId: "ollama-local-coder",
  contextWindow: 32000,
  speedTier: "medium",
  qualityTier: "large",
  supportsJsonMode: true,
  supportsStreaming: true,
  recommendedTasks: [
    "diff_summary",
    "branch_review",
    "risk_checklist",
    "commit_message",
    "pr_description",
    "selected_range_patch",
    "single_file_patch",
    "conflict_explanation",
  ],
};

export function createDefaultRuntimeStatus(input?: Partial<AiRuntimeStatus>): AiRuntimeStatus {
  return {
    models: [recordedDemoModel, webLlmSmallModel, ollamaLocalModel],
    ollamaAvailable: false,
    providers: [
      {
        detail: "モデル設定なしでもデモ workflow を再生できます。",
        label: "利用可能",
        modelIds: [recordedDemoModel.modelId],
        provider: "recorded",
        status: "available",
      },
      {
        detail: "WebGPU capability check をまだ実行していません。",
        label: "未確認",
        modelIds: [],
        provider: "webllm",
        status: "checking",
      },
      {
        detail: "localhost の Ollama 接続をまだ確認していません。",
        label: "未確認",
        modelIds: [],
        provider: "ollama",
        status: "checking",
      },
    ],
    recommendedProvider: "recorded",
    webGpuAvailable: false,
    ...input,
  };
}

export async function detectBrowserAiRuntime(input?: {
  fetchImpl?: typeof fetch;
  navigatorLike?: { gpu?: unknown };
  ollamaBaseUrl?: string;
  timeoutMs?: number;
}): Promise<AiRuntimeStatus> {
  const fetchImpl = input?.fetchImpl ?? globalThis.fetch;
  const navigatorLike = input?.navigatorLike ?? (globalThis.navigator as { gpu?: unknown } | undefined);
  const ollamaBaseUrl = input?.ollamaBaseUrl ?? "http://localhost:11434";
  const timeoutMs = input?.timeoutMs ?? 1200;
  const webGpuAvailable = Boolean(navigatorLike?.gpu);
  const ollama = await detectOllama(fetchImpl, ollamaBaseUrl, timeoutMs);
  const models = [
    recordedDemoModel,
    ...(webGpuAvailable ? [webLlmSmallModel] : []),
    ...(ollama.available
      ? [
          {
            ...ollamaLocalModel,
            modelId: ollama.modelIds[0] ?? ollamaLocalModel.modelId,
          },
        ]
      : []),
  ];

  return createDefaultRuntimeStatus({
    models,
    ollamaAvailable: ollama.available,
    providers: [
      {
        detail: "モデル設定なしでもデモ workflow を再生できます。",
        label: "利用可能",
        modelIds: [recordedDemoModel.modelId],
        provider: "recorded",
        status: "available",
      },
      {
        detail: webGpuAvailable
          ? "WebGPU を検出しました。WebLLM loading boundary に進めます。"
          : "WebGPU を検出できません。WebLLM はこの端末では fallback 扱いです。",
        label: webGpuAvailable ? "利用可能" : "WebGPU なし",
        modelIds: webGpuAvailable ? [webLlmSmallModel.modelId] : [],
        provider: "webllm",
        status: webGpuAvailable ? "available" : "unavailable",
      },
      {
        detail: ollama.detail,
        label: ollama.available ? "接続済み" : "未接続",
        modelIds: ollama.modelIds,
        provider: "ollama",
        status: ollama.available ? "available" : "unavailable",
      },
    ],
    recommendedProvider: ollama.available ? "ollama" : webGpuAvailable ? "webllm" : "recorded",
    webGpuAvailable,
  });
}

async function detectOllama(fetchImpl: typeof fetch | undefined, baseUrl: string, timeoutMs: number) {
  if (!fetchImpl) {
    return {
      available: false,
      detail: "fetch API を利用できないため Ollama を確認できません。",
      modelIds: [] as string[],
    };
  }

  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(`${baseUrl}/api/tags`, {
      method: "GET",
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        available: false,
        detail: `Ollama は応答しましたが HTTP ${response.status} を返しました。`,
        modelIds: [] as string[],
      };
    }

    const payload = (await response.json()) as { models?: Array<{ name?: string; model?: string }> };
    const modelIds =
      payload.models
        ?.map((model) => model.name ?? model.model)
        .filter((modelId): modelId is string => Boolean(modelId)) ?? [];

    return {
      available: true,
      detail: modelIds.length > 0 ? `${modelIds.length} 件の local model を検出しました。` : "Ollama は起動していますが model は未取得です。",
      modelIds,
    };
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === "AbortError";

    return {
      available: false,
      detail: aborted
        ? "Ollama の応答が timeout しました。Recorded AI に fallback します。"
        : "localhost:11434 に接続できません。Recorded AI に fallback します。",
      modelIds: [] as string[],
    };
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

export function chooseExecutionMode(input: {
  context: ContextPack;
  ollamaAvailable: boolean;
  preferredMode?: AiExecutionMode;
  task: AiTask;
  webGpuAvailable: boolean;
}): AiExecutionMode {
  if (input.preferredMode) return input.preferredMode;

  const budgetRatio = input.context.tokenBudget.used / input.context.tokenBudget.limit;
  const complexTask = input.task === "single_file_patch" || input.task === "branch_review";

  if ((complexTask || budgetRatio > 0.85 || input.context.gitChangeCount > 8) && input.ollamaAvailable) {
    return "ollama";
  }

  if (input.webGpuAvailable && budgetRatio < 0.65 && input.context.gitChangeCount <= 2) {
    return "webllm";
  }

  return "recorded";
}

export function runRecordedTask(request: AiTaskRequest): AiTaskResult {
  const taskLabels: Record<AiTask, string> = {
    branch_review: "branch の目的と現在の差分を照合しました。",
    commit_message: "変更範囲に基づいて commit draft を作成できます。",
    conflict_explanation: "競合説明は recorded mode では未対応です。",
    diff_summary: "差分は小さく、PR 要約生成の入力検証に集中しています。",
    pr_description: "PR 説明 draft を生成できます。",
    risk_checklist: "主なリスクは diff parser の edge case とテスト未実行です。",
    selected_range_patch: "選択範囲への patch proposal を作れます。",
    single_file_patch: "単一ファイル patch を structured edit として提案できます。",
  };

  return {
    mode: request.mode,
    summary: taskLabels[request.task],
    warnings:
      request.context.tokenBudget.used > request.context.tokenBudget.limit
        ? ["context budget を超えています。優先度を下げるか Ollama を使ってください。"]
        : [],
  };
}

export function generatePatchProposal(request: PatchProposalRequest): PatchProposalResult {
  const branchGoalTitle = extractMarkdownTitle(request.branchGoalMarkdown) || "Branch Goal";
  const content = request.currentFile.content;

  if (!content.trim()) {
    return {
      error: "現在のファイルが空のため、structured edit を生成できません。",
      mode: request.mode,
      ok: false,
      warnings: ["別のファイルを開くか、ファイルに内容を追加してから再実行してください。"],
    };
  }

  if (content.includes("export function generateSummary(diff: string)") && !content.includes("Diff input is required")) {
    const find = `export function generateSummary(diff: string) {
  const changedFiles = extractChangedFiles(diff);`;
    const replacement = `export function generateSummary(diff: string) {
  if (!diff.trim()) {
    throw new Error("Diff input is required");
  }

  const changedFiles = extractChangedFiles(diff);`;

    return {
      mode: request.mode,
      ok: true,
      proposal: {
        id: `ai-patch-${Date.now()}`,
        title: "空の diff 入力を扱う",
        summary: `${branchGoalTitle} に沿って、PR summary generator が空入力を明示的に拒否するようにします。`,
        status: "ready",
        safety: {
          branchGoalAttached: Boolean(request.branchGoalMarkdown.trim()),
          contextPackReviewed: true,
          diffPreviewGenerated: true,
          gitDiffUpdated: false,
          modelCapabilityAccepted: request.mode !== "webllm",
          structuredEditParsed: true,
          targetFileExists: true,
          targetTextMatched: true,
          testsRun: false,
        },
        edits: [
          {
            file: request.currentFile.path,
            find,
            operation: "replace",
            reason: "空の diff から誤解を招く PR summary が生成されるのを防ぐため。",
            replacement,
          },
        ],
      },
      warnings:
        request.mode === "webllm"
          ? ["WebLLM は小さなモデル想定のため、適用前に diff review を必ず確認してください。"]
          : [],
    };
  }

  const firstMeaningfulLine = content.split(/\r?\n/).find((line) => line.trim());

  if (!firstMeaningfulLine) {
    return {
      error: "編集対象にできる行が見つかりませんでした。",
      mode: request.mode,
      ok: false,
      warnings: ["空白だけのファイルは patch proposal の対象外です。"],
    };
  }

  return {
    mode: request.mode,
    ok: true,
    proposal: {
      id: `ai-patch-${Date.now()}`,
      title: "Branch Goal メモを追加する",
      summary: "現在のファイルに Branch Goal を意識した確認コメントを追加します。小さく安全に diff review できる fallback proposal です。",
      status: "ready",
      safety: {
        branchGoalAttached: Boolean(request.branchGoalMarkdown.trim()),
        contextPackReviewed: true,
        diffPreviewGenerated: true,
        gitDiffUpdated: false,
        modelCapabilityAccepted: request.mode !== "webllm",
        structuredEditParsed: true,
        targetFileExists: true,
        targetTextMatched: true,
        testsRun: false,
      },
      edits: [
        {
          file: request.currentFile.path,
          find: firstMeaningfulLine,
          operation: "replace",
          reason: "Branch Goal を現在のファイルに紐づけ、後続の AI review で意図を追いやすくするため。",
          replacement: `${firstMeaningfulLine}\n// TODO: ${branchGoalTitle} に沿ってこの変更の影響を確認する。`,
        },
      ],
    },
    warnings: ["汎用 fallback proposal です。実装意図に合うか diff review で確認してください。"],
  };
}

export function planRuntimeFromPackageJson(files: Record<string, string>): RuntimePlan {
  const packageJson = files["package.json"];

  if (!packageJson) {
    return {
      capability: "recorded",
      confidence: "low",
      warnings: ["package.json がないため、実行コマンドは推定できません。"],
    };
  }

  try {
    const parsed = JSON.parse(packageJson) as { scripts?: Record<string, string> };
    const scripts = parsed.scripts ?? {};
    const packageManager = detectPackageManager(files);

    return {
      capability: "webcontainer",
      confidence: scripts.dev || scripts.preview || scripts.test || scripts.typecheck ? "high" : "medium",
      buildCommand: scripts.build ? `${packageManager} run build` : undefined,
      devCommand: scripts.dev ? `${packageManager} run dev` : undefined,
      installCommand: `${packageManager} install`,
      previewCommand: scripts.preview ? `${packageManager} run preview` : undefined,
      testCommand: scripts.test ? `${packageManager} run test` : undefined,
      typecheckCommand: scripts.typecheck ? `${packageManager} run typecheck` : undefined,
      warnings: [
        ...(!scripts.dev && !scripts.preview ? ["dev / preview script が見つかりません。"] : []),
        ...(!scripts.test ? ["test script が見つかりません。"] : []),
      ],
    };
  } catch {
    return {
      capability: "recorded",
      confidence: "low",
      warnings: ["package.json を解析できませんでした。"],
    };
  }
}

function detectPackageManager(files: Record<string, string>) {
  if (files["pnpm-lock.yaml"]) return "pnpm";
  if (files["yarn.lock"]) return "yarn";
  return "npm";
}

function extractMarkdownTitle(markdown: string) {
  return markdown
    .split("\n")
    .find((line) => line.startsWith("# "))
    ?.replace(/^# /, "")
    .trim();
}

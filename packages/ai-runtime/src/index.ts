import type { AiTask, ContextPack, ModelCapability, RuntimePlan } from "@git-ai-ide/shared";

export type AiRuntimeStatus = {
  webGpuAvailable: boolean;
  ollamaAvailable: boolean;
  recommendedProvider: "webllm" | "ollama" | "recorded";
  models: ModelCapability[];
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
    recommendedProvider: "recorded",
    webGpuAvailable: false,
    ...input,
  };
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

    return {
      capability: "webcontainer",
      confidence: scripts.test || scripts.typecheck ? "high" : "medium",
      installCommand: "pnpm install",
      testCommand: scripts.test ? "pnpm test" : undefined,
      typecheckCommand: scripts.typecheck ? "pnpm typecheck" : undefined,
      warnings: scripts.test ? [] : ["test script が見つかりません。"],
    };
  } catch {
    return {
      capability: "recorded",
      confidence: "low",
      warnings: ["package.json を解析できませんでした。"],
    };
  }
}

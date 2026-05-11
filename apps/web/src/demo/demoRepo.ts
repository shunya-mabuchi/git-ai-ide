import type { BranchGoal, PatchProposal, RepoMap, WorkflowStep } from "@git-ai-ide/shared";

export const demoFiles = {
  "package.json": `{
  "name": "pr-helper-mini",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@vitejs/plugin-react": "latest",
    "typescript": "latest",
    "vite": "latest",
    "vitest": "latest"
  }
}
`,
  "src/features/pr-summary/generateSummary.ts": `export type ChangedFileArea = "ui" | "api" | "tests" | "config" | "docs" | "unknown";

export function generateSummary(diff: string) {
  const changedFiles = extractChangedFiles(diff);

  return {
    title: "プロジェクトファイルを更新",
    changedFiles,
    risks: ["PR 作成前に生成された要約を確認する"],
    testPlan: ["diff を手動で確認する"],
  };
}

export function extractChangedFiles(diff: string) {
  return diff
    .split("\\n")
    .filter((line) => line.startsWith("diff --git"))
    .map((line) => line.split(" b/")[1])
    .filter(Boolean);
}
`,
  "src/features/pr-summary/generateSummary.test.ts": `import { describe, expect, it } from "vitest";
import { extractChangedFiles } from "./generateSummary";

describe("extractChangedFiles", () => {
  it("extracts changed files from a git diff", () => {
    const files = extractChangedFiles("diff --git a/src/App.tsx b/src/App.tsx");

    expect(files).toEqual(["src/App.tsx"]);
  });
});
`,
  "README.md": `# PR Helper Mini

Git diff から PR タイトル、説明、リスク、テスト観点を生成する小さなデモアプリです。
`,
} as const;

export const demoRepoMap: RepoMap = {
  name: "pr-helper-mini",
  detectedStack: ["TypeScript", "Vite", "Vitest"],
  importantFiles: ["package.json", "src/features/pr-summary/generateSummary.ts"],
  commands: {
    test: "npm run test",
    typecheck: "npm run typecheck",
    dev: "npm run dev",
  },
  runtimeCapabilities: ["git", "ai_diff_explanation", "patch_proposal", "webcontainer_candidate"],
};

export const demoBranchGoal: BranchGoal = {
  title: "PR 要約生成を改善する",
  markdown: `# Branch Goal

## Goal
PR summary generator が空の diff を扱い、変更ファイルを領域ごとに分類できるようにする。

## Acceptance Criteria
- 空の diff では分かりやすい validation message を表示する。
- 変更ファイルを UI、API、tests、config、docs に分類する。
- 生成される PR description に risk と test plan を含める。
- 既存 tests が引き続き通る。

## Non-goals
- 実際の GitHub API には接続しない。
- 認証は追加しない。

## Risk Areas
- Diff parser の edge case
- ファイル分類の誤り
- 空入力時の UX
`,
};

export const demoWorkflowSteps: WorkflowStep[] = [
  { id: "repo", label: "Repo を開いた", status: "done" },
  { id: "goal", label: "目的を設定", status: "done" },
  { id: "branch", label: "Branch 作成", status: "done" },
  { id: "changes", label: "変更中", status: "active" },
  { id: "review", label: "Diff review", status: "pending" },
  { id: "tests", label: "Tests 実行", status: "pending" },
  { id: "commit", label: "Commit 作成", status: "pending" },
  { id: "push", label: "Push", status: "pending" },
  { id: "pr", label: "PR 作成", status: "pending" },
];

export const demoPatch: PatchProposal = {
  id: "patch-empty-diff",
  title: "空の diff 入力を扱う",
  summary: "diff 入力が空のときに validation message を表示します。",
  status: "ready",
  safety: {
    branchGoalAttached: true,
    contextPackReviewed: true,
    modelCapabilityAccepted: true,
    structuredEditParsed: true,
    targetFileExists: true,
    targetTextMatched: true,
    diffPreviewGenerated: true,
    testsRun: false,
    gitDiffUpdated: false,
  },
  edits: [
    {
      file: "src/features/pr-summary/generateSummary.ts",
      operation: "replace",
      find: `export function generateSummary(diff: string) {
  const changedFiles = extractChangedFiles(diff);

  return {
    title: "プロジェクトファイルを更新",
    changedFiles,
    risks: ["PR 作成前に生成された要約を確認する"],
    testPlan: ["diff を手動で確認する"],
  };
}`,
      replacement: `export function generateSummary(diff: string) {
  if (!diff.trim()) {
    throw new Error("Diff input is required");
  }

  const changedFiles = extractChangedFiles(diff);

  return {
    title: "プロジェクトファイルを更新",
    changedFiles,
    risks: ["PR 作成前に生成された要約を確認する"],
    testPlan: ["diff を手動で確認する"],
  };
}`,
      reason: "空入力から誤解を招く PR summary が生成されるのを防ぐため。",
    },
  ],
};

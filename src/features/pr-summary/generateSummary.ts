export type ChangedFileArea = "ui" | "api" | "tests" | "config" | "docs" | "unknown";

export function generateSummary(diff: string) {
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
}

export function extractChangedFiles(diff: string) {
  return diff
    .split("\n")
    .filter((line) => line.startsWith("diff --git"))
    .map((line) => line.split(" b/")[1])
    .filter(Boolean);
}

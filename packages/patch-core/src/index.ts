import type { StructuredEdit } from "@git-ai-ide/shared";

export type PatchApplyResult =
  | { ok: true; files: Record<string, string> }
  | { ok: false; error: string; file?: string };

export function applyStructuredEdits(
  files: Record<string, string>,
  edits: StructuredEdit[],
): PatchApplyResult {
  const nextFiles = { ...files };

  for (const edit of edits) {
    if (edit.operation !== "replace") {
      return { ok: false, error: `Unsupported operation: ${edit.operation}`, file: edit.file };
    }

    const current = nextFiles[edit.file];
    if (current === undefined) {
      return { ok: false, error: "Target file does not exist", file: edit.file };
    }

    if (!current.includes(edit.find)) {
      return { ok: false, error: "Target text was not found", file: edit.file };
    }

    nextFiles[edit.file] = current.replace(edit.find, edit.replacement);
  }

  return { ok: true, files: nextFiles };
}


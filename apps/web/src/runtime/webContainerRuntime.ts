import type { RuntimePlan } from "@git-ai-ide/shared";
import type { FileSystemTree, WebContainer, WebContainerProcess } from "@webcontainer/api";

export type RuntimeRunMode = "webcontainer" | "recorded";

export type RuntimeRunResult = {
  log: string;
  mode: RuntimeRunMode;
  ok: boolean;
};

export type LocalPreviewResult = {
  log: string;
  mode: RuntimeRunMode;
  ok: boolean;
  preflight: LocalPreviewPreflight;
  url?: string;
};

export type LocalPreviewPreflightItem = {
  detail: string;
  id: "source" | "project" | "command" | "browser";
  label: string;
  status: "pass" | "warning" | "blocked";
};

export type LocalPreviewPreflight = {
  canAttemptWebContainer: boolean;
  command?: string;
  items: LocalPreviewPreflightItem[];
  mode: RuntimeRunMode;
  reason: string;
};

type MutableFileSystemTree = Record<string, { directory?: MutableFileSystemTree; file?: { contents: string } }>;

let webContainerPromise: Promise<WebContainer> | undefined;
let previewProcess: WebContainerProcess | undefined;

export async function runRuntimeChecks(files: Record<string, string>, plan: RuntimePlan): Promise<RuntimeRunResult> {
  if (plan.capability !== "webcontainer") {
    return runRecordedChecks(plan, "WebContainer 対象の JavaScript / TypeScript project として検出されませんでした。");
  }

  if (!canUseWebContainer()) {
    return runRecordedChecks(
      plan,
      "このブラウザ環境では WebContainer に必要な cross-origin isolation が有効ではありません。",
    );
  }

  try {
    const { WebContainer } = await import("@webcontainer/api");
    webContainerPromise ??= WebContainer.boot();
    const container = await webContainerPromise;
    await container.mount(createWebContainerFileTree(files));

    const output: string[] = ["Git AI IDE Runtime", "mode: WebContainer"];
    const installCommand = plan.installCommand ?? "npm install";
    const commands = [installCommand, plan.typecheckCommand, plan.testCommand].filter((command): command is string =>
      Boolean(command),
    );

    for (const command of commands) {
      output.push("", `> ${command}`);
      const result = await runCommand(container, command, (chunk) => output.push(chunk));
      if (result !== 0) {
        output.push(`command failed with exit code ${result}`);
        return {
          log: output.join("\n"),
          mode: "webcontainer",
          ok: false,
        };
      }
    }

    output.push("", "Runtime checks passed.");

    return {
      log: output.join("\n"),
      mode: "webcontainer",
      ok: true,
    };
  } catch (error) {
    return runRecordedChecks(
      plan,
      error instanceof Error ? `WebContainer 実行に失敗しました: ${error.message}` : "WebContainer 実行に失敗しました。",
    );
  }
}

export function canUseWebContainer() {
  return typeof window !== "undefined" && window.crossOriginIsolated && typeof window.SharedArrayBuffer !== "undefined";
}

export function createLocalPreviewPreflight(
  plan: RuntimePlan,
  options: { canUseWebContainer?: boolean; forceRecorded?: boolean } = {},
): LocalPreviewPreflight {
  const previewCommand = plan.devCommand ?? plan.previewCommand;
  const browserReady = options.canUseWebContainer ?? canUseWebContainer();
  const items: LocalPreviewPreflightItem[] = [
    {
      detail: options.forceRecorded
        ? "Test fixture は WebContainer を起動せずに確認します。"
        : "実 repo では WebContainer preview を best-effort で試します。native module / private registry / Docker / backend dependency が必要な repo は fallback します。",
      id: "source",
      label: "Workspace source",
      status: options.forceRecorded ? "warning" : "pass",
    },
    {
      detail:
        plan.capability === "webcontainer"
          ? "package.json から JavaScript / TypeScript project として検出しました。"
          : "package.json がないか、WebContainer 対象として扱えません。",
      id: "project",
      label: "Project capability",
      status: plan.capability === "webcontainer" ? "pass" : "blocked",
    },
    {
      detail: previewCommand ?? "package.json に dev または preview script がありません。",
      id: "command",
      label: "Preview command",
      status: previewCommand ? "pass" : "blocked",
    },
    {
      detail: browserReady
        ? "cross-origin isolation と SharedArrayBuffer が有効です。"
        : "WebContainer には cross-origin isolation と SharedArrayBuffer が必要です。",
      id: "browser",
      label: "Browser isolation",
      status: browserReady ? "pass" : "blocked",
    },
  ];

  const blocked = items.find((item) => item.status === "blocked");
  const forced = options.forceRecorded;
  const canAttemptWebContainer = !forced && !blocked;

  return {
    canAttemptWebContainer,
    command: previewCommand,
    items,
    mode: canAttemptWebContainer ? "webcontainer" : "recorded",
    reason: forced ? items[0].detail : blocked?.detail ?? "WebContainer dev server URL を iframe に best-effort で接続します。",
  };
}

export async function startLocalPreview(
  files: Record<string, string>,
  plan: RuntimePlan,
  options: { forceRecorded?: boolean } = {},
): Promise<LocalPreviewResult> {
  const preflight = createLocalPreviewPreflight(plan, {
    forceRecorded: options.forceRecorded,
  });
  const previewCommand = preflight.command;

  if (!preflight.canAttemptWebContainer) {
    return runRecordedPreview(plan, preflight);
  }

  if (!previewCommand) {
    return runRecordedPreview(plan, {
      ...preflight,
      mode: "recorded",
      reason: "dev / preview script が見つかりません。",
    });
  }

  try {
    const { WebContainer } = await import("@webcontainer/api");
    webContainerPromise ??= WebContainer.boot();
    const container = await webContainerPromise;
    await container.mount(createWebContainerFileTree(files));

    const output: string[] = ["Git AI IDE Local Preview", "mode: WebContainer"];
    const installCommand = plan.installCommand ?? "npm install";
    output.push("", `> ${installCommand}`);
    const installResult = await runCommand(container, installCommand, (chunk) => output.push(chunk));

    if (installResult !== 0) {
      output.push(`install failed with exit code ${installResult}`);
      return {
        log: output.join("\n"),
        mode: "webcontainer",
        ok: false,
        preflight,
      };
    }

    output.push("", `> ${previewCommand}`);
    previewProcess?.kill();
    const { args, binary } = splitCommand(previewCommand);
    previewProcess = await container.spawn(binary, args);
    previewProcess.output.pipeTo(createOutputSink((chunk) => output.push(chunk)));

    const url = await waitForServerReady(container);
    output.push("", `Preview ready: ${url}`);

    return {
      log: output.join("\n"),
      mode: "webcontainer",
      ok: true,
      preflight,
      url,
    };
  } catch (error) {
    return runRecordedPreview(
      plan,
      {
        ...preflight,
        mode: "recorded",
        reason:
          error instanceof Error ? `WebContainer preview に失敗しました: ${error.message}` : "WebContainer preview に失敗しました。",
      },
    );
  }
}

export function createWebContainerFileTree(files: Record<string, string>): FileSystemTree {
  const root: MutableFileSystemTree = {};

  for (const [path, contents] of Object.entries(files)) {
    const parts = path.split("/").filter(Boolean);
    let current = root;

    for (const [index, part] of parts.entries()) {
      const isFile = index === parts.length - 1;

      if (isFile) {
        current[part] = {
          file: {
            contents,
          },
        };
        continue;
      }

      if (!current[part]?.directory) {
        current[part] = {
          directory: {},
        };
      }
      const nextDirectory = current[part].directory;
      if (!nextDirectory) {
        throw new Error(`Failed to create directory node for ${part}`);
      }
      current = nextDirectory;
    }
  }

  return root as FileSystemTree;
}

export function splitCommand(command: string) {
  const [binary, ...args] = command.trim().split(/\s+/);
  return { args, binary };
}

async function runCommand(container: WebContainer, command: string, onOutput: (chunk: string) => void) {
  const { args, binary } = splitCommand(command);
  const process = await container.spawn(binary, args);
  process.output.pipeTo(createOutputSink(onOutput));
  return process.exit;
}

function createOutputSink(onOutput: (chunk: string) => void) {
  return new WritableStream<string>({
    write(data) {
      const cleaned = cleanTerminalOutput(data);
      if (cleaned.trim()) {
        onOutput(cleaned);
      }
    },
  });
}

function waitForServerReady(container: WebContainer) {
  return new Promise<string>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      unsubscribe();
      reject(new Error("dev server の起動待ちが timeout しました。"));
    }, 30_000);

    const unsubscribe = container.on("server-ready", (_port, url) => {
      window.clearTimeout(timeoutId);
      unsubscribe();
      resolve(url);
    });
  });
}

function cleanTerminalOutput(data: string) {
  return data
    .replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/\x1b\][^\x07]*(\x07|\x1b\\)/g, "")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => !/^[\\|/-]$/.test(line.trim()))
    .filter((line) => !line.startsWith("Progress:"))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();
}

function runRecordedChecks(plan: RuntimePlan, reason: string): RuntimeRunResult {
  return {
    log: [
      "Git AI IDE Runtime",
      "mode: Manual fallback",
      reason,
      "",
      `detected capability: ${plan.capability}`,
      `test: ${plan.testCommand ?? "not detected"}`,
      `typecheck: ${plan.typecheckCommand ?? "not detected"}`,
      "",
      "Runtime checks were not executed in this browser environment.",
    ].join("\n"),
    mode: "recorded",
    ok: true,
  };
}

function runRecordedPreview(plan: RuntimePlan, preflight: LocalPreviewPreflight): LocalPreviewResult {
  const previewCommand = plan.devCommand ?? plan.previewCommand;

  return {
    log: [
      "Git AI IDE Local Preview",
      "mode: Manual fallback",
      preflight.reason,
      "",
      "preflight:",
      ...preflight.items.map((item) => `- ${item.status}: ${item.label} - ${item.detail}`),
      "",
      `detected capability: ${plan.capability}`,
      `install: ${plan.installCommand ?? "not detected"}`,
      `dev: ${plan.devCommand ?? "not detected"}`,
      `preview: ${plan.previewCommand ?? "not detected"}`,
      `build: ${plan.buildCommand ?? "not detected"}`,
      "",
      previewCommand
        ? "対応環境では WebContainer dev server URL を iframe に best-effort で接続します。失敗時は理由を表示し、URL bar fallback に切り替えます。"
        : "dev / preview script を追加すると Local Preview の候補になります。",
    ].join("\n"),
    mode: "recorded",
    ok: Boolean(previewCommand),
    preflight,
  };
}

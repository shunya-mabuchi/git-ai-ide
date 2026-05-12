export type WorkspaceSnapshot = {
  files: Record<string, string>;
  name: string;
  openedAt: string;
  source: "demo" | "empty" | "github" | "indexeddb" | "local-directory";
};

type LocalFileSystemFileHandle = {
  getFile(): Promise<File>;
  kind: "file";
  name: string;
};

type LocalFileSystemDirectoryHandle = {
  entries(): AsyncIterableIterator<[string, LocalFileSystemHandle]>;
  kind: "directory";
  name: string;
};

type LocalFileSystemHandle = LocalFileSystemDirectoryHandle | LocalFileSystemFileHandle;

type WindowWithDirectoryPicker = Window & {
  showDirectoryPicker?: () => Promise<LocalFileSystemDirectoryHandle>;
};

type IgnoreRule = {
  directoryOnly: boolean;
  pattern: string;
};

const DB_NAME = "git-ai-ide-workspaces";
const STORE_NAME = "snapshots";
const SNAPSHOT_KEY = "last-opened";
const MAX_FILES = 160;
const MAX_FILE_BYTES = 320_000;
const MAX_TOTAL_BYTES = 2_000_000;

const ignoredDirectories = new Set([
  ".git",
  ".next",
  ".turbo",
  ".wrangler",
  "build",
  "coverage",
  "dist",
  "node_modules",
]);

const readableExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".md",
  ".mjs",
  ".sql",
  ".ts",
  ".tsx",
  ".txt",
  ".yml",
  ".yaml",
]);

const ignoredBinaryExtensions = /\.(avif|bmp|gif|ico|jpe?g|mov|mp3|mp4|otf|pdf|png|tgz|ttf|wasm|webm|webp|woff2?|zip)$/i;

export function supportsLocalDirectoryAccess() {
  return typeof (window as WindowWithDirectoryPicker).showDirectoryPicker === "function";
}

export async function openLocalDirectorySnapshot(): Promise<WorkspaceSnapshot> {
  const picker = (window as WindowWithDirectoryPicker).showDirectoryPicker;

  if (!picker) {
    throw new Error("このブラウザでは File System Access API を使えません。");
  }

  const root = await picker();
  const files: Record<string, string> = {};
  const ignoreRules = await loadGitIgnoreRules(root);
  await readDirectory(root, "", files, ignoreRules, { totalBytes: 0 });

  if (Object.keys(files).length === 0) {
    throw new Error("読み込める text file が見つかりませんでした。.gitignore、file size、binary file の除外条件を確認してください。");
  }

  return {
    files,
    name: root.name,
    openedAt: new Date().toISOString(),
    source: "local-directory",
  };
}

export async function saveWorkspaceSnapshot(snapshot: WorkspaceSnapshot) {
  const db = await openDb();
  await requestToPromise(
    db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(
      {
        ...snapshot,
        source: snapshot.source === "demo" || snapshot.source === "empty" ? snapshot.source : "indexeddb",
      },
      SNAPSHOT_KEY,
    ),
  );
  db.close();
}

export async function loadWorkspaceSnapshot(): Promise<WorkspaceSnapshot | null> {
  const db = await openDb();
  const snapshot = await requestToPromise<WorkspaceSnapshot | undefined>(
    db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(SNAPSHOT_KEY),
  );
  db.close();
  return snapshot ?? null;
}

async function readDirectory(
  directory: LocalFileSystemDirectoryHandle,
  prefix: string,
  files: Record<string, string>,
  ignoreRules: IgnoreRule[],
  budget: { totalBytes: number },
) {
  for await (const [name, handle] of directory.entries()) {
    if (Object.keys(files).length >= MAX_FILES) return;
    if (budget.totalBytes >= MAX_TOTAL_BYTES) return;

    const relativePath = `${prefix}${name}`;

    if (handle.kind === "directory") {
      if (shouldIgnorePath(`${relativePath}/`, true, ignoreRules)) continue;
      await readDirectory(handle, `${relativePath}/`, files, ignoreRules, budget);
      continue;
    }

    if (shouldIgnorePath(relativePath, false, ignoreRules)) continue;
    if (!isReadableFile(name)) continue;

    const file = await handle.getFile();
    if (file.size > MAX_FILE_BYTES) continue;
    if (budget.totalBytes + file.size > MAX_TOTAL_BYTES) continue;

    files[relativePath] = await file.text();
    budget.totalBytes += file.size;
  }
}

function isReadableFile(name: string) {
  const lowerName = name.toLowerCase();
  if (ignoredBinaryExtensions.test(lowerName)) return false;
  if (lowerName === "package.json" || lowerName === "readme.md") return true;
  return [...readableExtensions].some((extension) => lowerName.endsWith(extension));
}

async function loadGitIgnoreRules(root: LocalFileSystemDirectoryHandle) {
  const rules: IgnoreRule[] = [];

  for await (const [name, handle] of root.entries()) {
    if (handle.kind !== "file" || name !== ".gitignore") continue;
    const text = await (await handle.getFile()).text();
    rules.push(...parseGitIgnore(text));
    break;
  }

  return rules;
}

export function parseGitIgnore(text: string): IgnoreRule[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith("!"))
    .map((line) => ({
      directoryOnly: line.endsWith("/"),
      pattern: line.replace(/^\//, "").replace(/\/$/, ""),
    }))
    .filter((rule) => rule.pattern.length > 0);
}

export function shouldIgnorePath(path: string, isDirectory: boolean, rules: IgnoreRule[]) {
  const normalizedPath = path.replace(/\\/g, "/").replace(/\/$/, "");
  const basename = normalizedPath.split("/").at(-1) ?? normalizedPath;

  if (isDirectory && ignoredDirectories.has(basename)) return true;
  if ([...ignoredDirectories].some((directory) => normalizedPath === directory || normalizedPath.startsWith(`${directory}/`) || normalizedPath.includes(`/${directory}/`))) {
    return true;
  }
  if (!isDirectory && ignoredBinaryExtensions.test(basename)) return true;

  return rules.some((rule) => {
    if (rule.directoryOnly && !isDirectory && !normalizedPath.includes(`${rule.pattern}/`)) return false;
    if (rule.pattern.includes("*")) return globLikeMatch(normalizedPath, basename, rule.pattern);
    if (rule.pattern.includes("/")) return normalizedPath === rule.pattern || normalizedPath.startsWith(`${rule.pattern}/`);
    return basename === rule.pattern || normalizedPath.startsWith(`${rule.pattern}/`) || normalizedPath.includes(`/${rule.pattern}/`);
  });
}

function globLikeMatch(path: string, basename: string, pattern: string) {
  const escaped = pattern
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  const regex = new RegExp(`^${escaped}$`);
  return regex.test(basename) || regex.test(path);
}

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
  });
}

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

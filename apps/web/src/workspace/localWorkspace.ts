export type WorkspaceSnapshot = {
  files: Record<string, string>;
  name: string;
  openedAt: string;
  source: "demo" | "empty" | "local-directory" | "indexeddb";
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

const DB_NAME = "git-ai-ide-workspaces";
const STORE_NAME = "snapshots";
const SNAPSHOT_KEY = "last-opened";
const MAX_FILES = 160;
const MAX_FILE_BYTES = 320_000;

const ignoredDirectories = new Set([".git", "node_modules", "dist", "build", ".next", ".turbo", ".wrangler"]);
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

export function supportsLocalDirectoryAccess() {
  return typeof (window as WindowWithDirectoryPicker).showDirectoryPicker === "function";
}

export async function openLocalDirectorySnapshot(): Promise<WorkspaceSnapshot> {
  const picker = (window as WindowWithDirectoryPicker).showDirectoryPicker;

  if (!picker) {
    throw new Error("このブラウザでは File System Access API が使えません。");
  }

  const root = await picker();
  const files: Record<string, string> = {};
  await readDirectory(root, "", files);

  if (Object.keys(files).length === 0) {
    throw new Error("読み込めるテキストファイルが見つかりませんでした。");
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
) {
  for await (const [name, handle] of directory.entries()) {
    if (Object.keys(files).length >= MAX_FILES) return;

    if (handle.kind === "directory") {
      if (ignoredDirectories.has(name)) continue;
      await readDirectory(handle, `${prefix}${name}/`, files);
      continue;
    }

    if (!isReadableFile(name)) continue;

    const file = await handle.getFile();
    if (file.size > MAX_FILE_BYTES) continue;

    files[`${prefix}${name}`] = await file.text();
  }
}

function isReadableFile(name: string) {
  const lowerName = name.toLowerCase();
  if (lowerName === "package.json" || lowerName === "readme.md") return true;
  return [...readableExtensions].some((extension) => lowerName.endsWith(extension));
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

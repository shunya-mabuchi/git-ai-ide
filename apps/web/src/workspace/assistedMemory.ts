export type AssistedMemoryRecord = {
  memory: string;
  projectKey: string;
  savedAt: string;
};

const STORAGE_PREFIX = "git-ai-ide:assisted-memory:";

export function createAssistedMemoryProjectKey(input: { repository: string; workspaceName: string }) {
  const source = input.repository.trim() || input.workspaceName.trim() || "demo";
  return source.toLowerCase().replace(/[^a-z0-9._/-]+/g, "-").replace(/^-+|-+$/g, "");
}

export function loadAssistedMemory(projectKey: string): AssistedMemoryRecord | null {
  const raw = window.localStorage.getItem(storageKey(projectKey));
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AssistedMemoryRecord;
  } catch {
    return null;
  }
}

export function saveAssistedMemory(projectKey: string, memory: string) {
  const record: AssistedMemoryRecord = {
    memory,
    projectKey,
    savedAt: new Date().toISOString(),
  };

  window.localStorage.setItem(storageKey(projectKey), JSON.stringify(record));
  return record;
}

export function clearAssistedMemory(projectKey: string) {
  window.localStorage.removeItem(storageKey(projectKey));
}

function storageKey(projectKey: string) {
  return `${STORAGE_PREFIX}${projectKey}`;
}

const baseUrl = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const modelFromEnv = process.env.OLLAMA_E2E_MODEL;
const timeoutMs = Number(process.env.OLLAMA_E2E_TIMEOUT_MS ?? 60_000);

const currentFile = {
  path: "src/features/pr-summary/generateSummary.ts",
  content: ["export function generateSummary(title: string) {", "  return title.trim();", "}", ""].join("\n"),
};

const branchGoalMarkdown = [
  "# PR 要約生成を改善する",
  "",
  "- 空の title の場合に fallback text を返す",
  "- 返り値を reviewer 向けに少し説明的にする",
].join("\n");

function logStep(message) {
  console.log(`[ollama-real-e2e] ${message}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function fetchJson(path, init = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...init.headers,
      },
      signal: controller.signal,
    });
    const text = await response.text();
    const body = text ? JSON.parse(text) : null;

    if (!response.ok) {
      throw new Error(`${init.method ?? "GET"} ${path} failed: ${response.status} ${text}`);
    }

    return body;
  } finally {
    clearTimeout(timeout);
  }
}

function extractJsonObject(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");

  assert(start >= 0 && end > start, "Ollama response did not contain a JSON object.");
  return JSON.parse(candidate.slice(start, end + 1));
}

function validatePatchProposal(value) {
  assert(value && typeof value === "object", "Patch Proposal must be an object.");
  assert(typeof value.title === "string" && value.title.trim(), "Patch Proposal title is required.");
  assert(typeof value.rationale === "string" && value.rationale.trim(), "Patch Proposal rationale is required.");
  assert(Array.isArray(value.edits) && value.edits.length > 0, "Patch Proposal edits are required.");

  const edit = value.edits[0];
  assert(edit.file === currentFile.path, `Patch edit file must be ${currentFile.path}.`);
  assert(edit.kind === "replace", "Patch edit kind must be replace.");
  assert(typeof edit.find === "string" && currentFile.content.includes(edit.find), "Patch edit find text must exist in the current file.");
  assert(typeof edit.replace === "string" && edit.replace.includes("fallback"), "Patch edit replace text should include fallback handling.");
}

const tags = await fetchJson("/api/tags");
const modelIds =
  tags.models?.map((model) => model.name ?? model.model).filter((modelId) => typeof modelId === "string" && modelId.length > 0) ?? [];

assert(modelIds.length > 0, "Ollama is running, but no local models are available. Run `ollama pull <model>` first.");

const model = modelFromEnv ?? modelIds[0];
logStep(`model ok: ${model}`);

const prompt = [
  "Return only one JSON object. Do not use markdown.",
  "The object must match this shape:",
  '{"title": string, "rationale": string, "edits": [{"file": string, "kind": "replace", "find": string, "replace": string}]}',
  "",
  "Branch goal:",
  branchGoalMarkdown,
  "",
  "Current file:",
  `Path: ${currentFile.path}`,
  "```ts",
  currentFile.content,
  "```",
  "",
  "Create one safe replace edit. The find text must be copied exactly from the current file.",
].join("\n");

const generated = await fetchJson("/api/generate", {
  body: JSON.stringify({
    format: "json",
    model,
    options: {
      temperature: 0,
    },
    prompt,
    stream: false,
  }),
  method: "POST",
});

assert(typeof generated.response === "string", "Ollama response field must be a string.");
const proposal = extractJsonObject(generated.response);
validatePatchProposal(proposal);

logStep("mode: ollama");
logStep(`proposal ok: ${proposal.title}`);

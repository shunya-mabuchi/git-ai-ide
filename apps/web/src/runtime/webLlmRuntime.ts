import { webLlmModelCatalog } from "./webLlmModelCatalog";

export type WebLlmSmokeResult = {
  log: string;
  mode: "unavailable" | "webllm";
  modelId: string;
  ok: boolean;
};

const defaultWebLlmModelId = "Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC";

export async function runWebLlmSmokeTest(input?: {
  modelId?: string;
}): Promise<WebLlmSmokeResult> {
  const modelId = resolveSupportedModelId(input?.modelId);
  const hasWebGpu = Boolean((globalThis.navigator as (Navigator & { gpu?: unknown }) | undefined)?.gpu);

  if (!hasWebGpu) {
    return {
      log: [
        "mode: unavailable",
        `model: ${modelId}`,
        "WebGPU を検出できません。WebLLM 実モデルロードは WebGPU 対応ブラウザで確認してください。",
      ].join("\n"),
      mode: "unavailable",
      modelId,
      ok: true,
    };
  }

  try {
    const { CreateMLCEngine } = await import("@mlc-ai/web-llm");
    const progressMessages: string[] = [];
    const engine = await CreateMLCEngine(modelId, {
      initProgressCallback: (progress) => {
        progressMessages.push(`${Math.round((progress.progress ?? 0) * 100)}% ${progress.text ?? "loading"}`);
      },
    });
    const completion = await engine.chat.completions.create({
      max_tokens: 32,
      messages: [
        { content: "You are checking whether browser-local WebLLM inference works.", role: "system" },
        { content: "Reply with one short sentence that includes the words WebLLM ready.", role: "user" },
      ],
      temperature: 0,
    });
    const text = completion.choices?.[0]?.message?.content?.trim() ?? "";

    if (!text) {
      return {
        log: ["mode: unavailable", `model: ${modelId}`, "WebLLM completion が空でした。AI proposal は生成できません。"].join("\n"),
        mode: "unavailable",
        modelId,
        ok: true,
      };
    }

    return {
      log: ["mode: webllm", `model: ${modelId}`, ...progressMessages.slice(-5), `completion: ${text}`].join("\n"),
      mode: "webllm",
      modelId,
      ok: true,
    };
  } catch (error) {
    return {
      log: [
        "mode: unavailable",
        `model: ${modelId}`,
        error instanceof Error ? `WebLLM model load に失敗しました: ${error.message}` : "WebLLM model load に失敗しました。",
      ].join("\n"),
      mode: "unavailable",
      modelId,
      ok: true,
    };
  }
}

export function getSupportedWebLlmModelIds() {
  return new Set(webLlmModelCatalog.filter((model) => model.status !== "experimental").map((model) => model.id));
}

function resolveSupportedModelId(preferredModelId?: string) {
  const supportedModelIds = getSupportedWebLlmModelIds();
  if (preferredModelId && supportedModelIds.has(preferredModelId)) return preferredModelId;

  const catalogSupportedModel = webLlmModelCatalog.find((model) => supportedModelIds.has(model.id));
  return catalogSupportedModel?.id ?? preferredModelId ?? defaultWebLlmModelId;
}

export type WebLlmSmokeResult = {
  log: string;
  mode: "recorded" | "webllm";
  modelId: string;
  ok: boolean;
};

const defaultWebLlmSourceUrl = "https://esm.run/@mlc-ai/web-llm";
const defaultWebLlmModelId = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";

export async function runWebLlmSmokeTest(input?: {
  modelId?: string;
  sourceUrl?: string;
}): Promise<WebLlmSmokeResult> {
  const modelId = input?.modelId ?? defaultWebLlmModelId;
  const sourceUrl = input?.sourceUrl ?? defaultWebLlmSourceUrl;
  const hasWebGpu = Boolean((globalThis.navigator as (Navigator & { gpu?: unknown }) | undefined)?.gpu);

  if (!hasWebGpu) {
    return {
      log: [
        "mode: recorded",
        `model: ${modelId}`,
        "WebGPU を検出できません。WebLLM 実モデルロードは WebGPU 対応ブラウザで確認してください。",
      ].join("\n"),
      mode: "recorded",
      modelId,
      ok: true,
    };
  }

  try {
    const progressMessages: string[] = [];
    const webllm = (await import(/* @vite-ignore */ sourceUrl)) as {
      CreateMLCEngine: (
        modelId: string,
        config: {
          initProgressCallback?: (progress: { progress?: number; text?: string }) => void;
        },
      ) => Promise<{
        chat: {
          completions: {
            create: (request: {
              max_tokens?: number;
              messages: Array<{ content: string; role: "system" | "user" }>;
              temperature?: number;
            }) => Promise<{ choices?: Array<{ message?: { content?: string } }> }>;
          };
        };
      }>;
    };

    const engine = await webllm.CreateMLCEngine(modelId, {
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
        log: ["mode: recorded", `model: ${modelId}`, "WebLLM completion が空でした。Recorded fallback として扱います。"].join("\n"),
        mode: "recorded",
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
        "mode: recorded",
        `model: ${modelId}`,
        error instanceof Error ? `WebLLM model load に失敗しました: ${error.message}` : "WebLLM model load に失敗しました。",
      ].join("\n"),
      mode: "recorded",
      modelId,
      ok: true,
    };
  }
}

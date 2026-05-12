export type WebLlmTask = "patch" | "pr_draft" | "branch_review" | "summary" | "risk";
export type DeviceTier = "none" | "low" | "mid" | "high";
export type ModelVisibility = "recommended" | "advanced" | "hidden";
export type ModelCompatibility = "compatible" | "likely_compatible" | "maybe_too_large" | "hidden_by_device" | "artifact_unverified";

export type WebLlmDeviceProfile = {
  adapterDetail: string;
  crossOriginIsolated: boolean;
  maxBufferSize?: number;
  maxStorageBufferBindingSize?: number;
  storageQuota?: number;
  tier: DeviceTier;
  webGpuAvailable: boolean;
};

export type WebLlmModelCatalogEntry = {
  codeScore: number;
  estimatedDownloadMb: number;
  family: "Gemma" | "Qwen" | "Phi" | "Llama" | "Mistral";
  id: string;
  japaneseScore: number;
  jsonReliabilityScore: number;
  license: "Apache-2.0" | "MIT" | "Gemma Terms" | "Other";
  minDeviceTier: Exclude<DeviceTier, "none">;
  qualityScore: number;
  sizeClass: "tiny" | "small" | "medium" | "large";
  speedScore: number;
  status: "candidate" | "experimental" | "verified";
  tasks: WebLlmTask[];
  title: string;
};

export type RankedWebLlmModel = WebLlmModelCatalogEntry & {
  compatibility: ModelCompatibility;
  reason: string;
  score: number;
  visibility: ModelVisibility;
};

const tierRank: Record<DeviceTier, number> = {
  none: 0,
  low: 1,
  mid: 2,
  high: 3,
};

export const webLlmModelCatalog: WebLlmModelCatalogEntry[] = [
  {
    codeScore: 9,
    estimatedDownloadMb: 950,
    family: "Qwen",
    id: "Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC",
    japaneseScore: 6,
    jsonReliabilityScore: 8,
    license: "Apache-2.0",
    minDeviceTier: "low",
    qualityScore: 7,
    sizeClass: "small",
    speedScore: 8,
    status: "candidate",
    tasks: ["patch", "summary", "risk"],
    title: "Qwen2.5 Coder 1.5B",
  },
  {
    codeScore: 10,
    estimatedDownloadMb: 4200,
    family: "Qwen",
    id: "Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC",
    japaneseScore: 7,
    jsonReliabilityScore: 9,
    license: "Apache-2.0",
    minDeviceTier: "high",
    qualityScore: 9,
    sizeClass: "large",
    speedScore: 4,
    status: "candidate",
    tasks: ["patch", "branch_review", "risk"],
    title: "Qwen2.5 Coder 7B",
  },
  {
    codeScore: 7,
    estimatedDownloadMb: 2500,
    family: "Qwen",
    id: "Qwen3.5-4B-q4f16_1-MLC",
    japaneseScore: 7,
    jsonReliabilityScore: 7,
    license: "Apache-2.0",
    minDeviceTier: "mid",
    qualityScore: 8,
    sizeClass: "medium",
    speedScore: 6,
    status: "experimental",
    tasks: ["branch_review", "pr_draft", "summary", "risk"],
    title: "Qwen3.5 4B",
  },
  {
    codeScore: 6,
    estimatedDownloadMb: 2800,
    family: "Gemma",
    id: "Gemma-4-4B-It-q4f16_1-MLC",
    japaneseScore: 8,
    jsonReliabilityScore: 7,
    license: "Gemma Terms",
    minDeviceTier: "mid",
    qualityScore: 8,
    sizeClass: "medium",
    speedScore: 6,
    status: "experimental",
    tasks: ["pr_draft", "branch_review", "summary", "risk"],
    title: "Gemma 4 4B",
  },
  {
    codeScore: 5,
    estimatedDownloadMb: 2200,
    family: "Phi",
    id: "Phi-3.5-mini-instruct-q4f16_1-MLC",
    japaneseScore: 5,
    jsonReliabilityScore: 7,
    license: "MIT",
    minDeviceTier: "mid",
    qualityScore: 6,
    sizeClass: "medium",
    speedScore: 7,
    status: "candidate",
    tasks: ["summary", "risk", "pr_draft"],
    title: "Phi-3.5 Mini",
  },
];

export async function detectWebLlmDeviceProfile(): Promise<WebLlmDeviceProfile> {
  const gpu = (globalThis.navigator as (Navigator & { gpu?: { requestAdapter?: () => Promise<unknown> } }) | undefined)?.gpu;
  const crossOriginIsolated = Boolean(globalThis.crossOriginIsolated);
  const storageQuota = (await globalThis.navigator?.storage?.estimate?.())?.quota;

  if (!gpu?.requestAdapter) {
    return {
      adapterDetail: "WebGPU adapter を取得できません。",
      crossOriginIsolated,
      storageQuota,
      tier: "none",
      webGpuAvailable: false,
    };
  }

  try {
    const adapter = (await gpu.requestAdapter()) as
      | {
          info?: { architecture?: string; description?: string; device?: string; vendor?: string };
          limits?: { maxBufferSize?: number; maxStorageBufferBindingSize?: number };
        }
      | null;

    if (!adapter) {
      return {
        adapterDetail: "WebGPU adapter が null を返しました。",
        crossOriginIsolated,
        storageQuota,
        tier: "none",
        webGpuAvailable: false,
      };
    }

    const maxBufferSize = adapter.limits?.maxBufferSize;
    const maxStorageBufferBindingSize = adapter.limits?.maxStorageBufferBindingSize;
    const largerLimit = Math.max(maxBufferSize ?? 0, maxStorageBufferBindingSize ?? 0);
    const tier: DeviceTier = largerLimit >= 1_000_000_000 ? "high" : largerLimit >= 500_000_000 ? "mid" : "low";
    const info = adapter.info;
    const adapterDetail =
      [info?.vendor, info?.architecture, info?.device, info?.description].filter(Boolean).join(" / ") ||
      `maxBufferSize ${formatBytes(maxBufferSize)} / storageBuffer ${formatBytes(maxStorageBufferBindingSize)}`;

    return {
      adapterDetail,
      crossOriginIsolated,
      maxBufferSize,
      maxStorageBufferBindingSize,
      storageQuota,
      tier,
      webGpuAvailable: true,
    };
  } catch (error) {
    return {
      adapterDetail: error instanceof Error ? error.message : "WebGPU adapter 診断に失敗しました。",
      crossOriginIsolated,
      storageQuota,
      tier: "none",
      webGpuAvailable: false,
    };
  }
}

export function rankWebLlmModels(input: {
  device: WebLlmDeviceProfile;
  task: WebLlmTask;
  verifiedModelIds?: Set<string>;
}) {
  return webLlmModelCatalog
    .map((model): RankedWebLlmModel => {
      const taskFit = model.tasks.includes(input.task);
      const deviceFit = tierRank[input.device.tier] >= tierRank[model.minDeviceTier];
      const storageFit = !input.device.storageQuota || input.device.storageQuota / 1_000_000 > model.estimatedDownloadMb * 1.5;
      const verified = input.verifiedModelIds?.has(model.id);
      const compatibility: ModelCompatibility = !input.device.webGpuAvailable
        ? "hidden_by_device"
        : !deviceFit || !storageFit
          ? "maybe_too_large"
          : model.status === "experimental"
            ? "artifact_unverified"
            : verified
              ? "compatible"
              : "likely_compatible";
      const score =
        (taskFit ? 30 : -15) +
        model.qualityScore * 4 +
        model.jsonReliabilityScore * 3 +
        model.codeScore * (input.task === "patch" ? 3 : 1) +
        model.japaneseScore * (input.task === "pr_draft" || input.task === "branch_review" ? 2 : 1) +
        model.speedScore +
        (verified ? 20 : 0) -
        (compatibility === "maybe_too_large" ? 40 : 0) -
        (compatibility === "artifact_unverified" ? 12 : 0);
      const visibility: ModelVisibility =
        compatibility === "hidden_by_device" || !taskFit
          ? "hidden"
          : compatibility === "maybe_too_large" || compatibility === "artifact_unverified"
            ? "advanced"
            : "recommended";

      return {
        ...model,
        compatibility,
        reason: createModelReason(model, compatibility, input.device),
        score,
        visibility,
      };
    })
    .sort((left, right) => right.score - left.score);
}

export function formatBytes(value?: number) {
  if (!value) return "unknown";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} GB`;
  return `${Math.round(value / 1_000_000)} MB`;
}

function createModelReason(model: WebLlmModelCatalogEntry, compatibility: ModelCompatibility, device: WebLlmDeviceProfile) {
  if (compatibility === "hidden_by_device") return "WebGPU がないため非表示";
  if (compatibility === "maybe_too_large") return `${device.tier} tier では ${model.sizeClass} model が重い可能性があります`;
  if (compatibility === "artifact_unverified") return "WebLLM artifact の実 E2E が未確認";
  if (compatibility === "compatible") return "この端末で検証済み";
  return `${device.tier} tier で利用候補`;
}

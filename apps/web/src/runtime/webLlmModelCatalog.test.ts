import { describe, expect, it } from "vitest";
import { rankWebLlmModels, type WebLlmDeviceProfile } from "./webLlmModelCatalog";

const highTierDevice: WebLlmDeviceProfile = {
  adapterDetail: "test gpu",
  crossOriginIsolated: true,
  maxBufferSize: 1_500_000_000,
  maxStorageBufferBindingSize: 1_500_000_000,
  storageQuota: 20_000_000_000,
  tier: "high",
  webGpuAvailable: true,
};

describe("rankWebLlmModels", () => {
  it("hides models that failed to load on this device", () => {
    const ranked = rankWebLlmModels({
      device: highTierDevice,
      failedModelIds: new Set(["Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC"]),
      task: "patch",
    });

    const failed = ranked.find((model) => model.id === "Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC");
    expect(failed).toMatchObject({
      compatibility: "failed_on_device",
      visibility: "hidden",
    });
  });

  it("keeps heavy models visible for high tier devices when they have not failed", () => {
    const ranked = rankWebLlmModels({
      device: highTierDevice,
      failedModelIds: new Set(),
      task: "patch",
    });

    const candidate = ranked.find((model) => model.id === "Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC");
    expect(candidate?.visibility).not.toBe("hidden");
  });
});

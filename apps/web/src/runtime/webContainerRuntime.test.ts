import { describe, expect, it } from "vitest";
import { createLocalPreviewPreflight, createWebContainerFileTree, splitCommand } from "./webContainerRuntime";

describe("createWebContainerFileTree", () => {
  it("converts slash separated workspace files into a WebContainer tree", () => {
    expect(
      createWebContainerFileTree({
        "package.json": "{}",
        "src/index.ts": "export {};",
      }),
    ).toEqual({
      "package.json": {
        file: {
          contents: "{}",
        },
      },
      src: {
        directory: {
          "index.ts": {
            file: {
              contents: "export {};",
            },
          },
        },
      },
    });
  });
});

describe("splitCommand", () => {
  it("splits a simple package script command", () => {
    expect(splitCommand("npm run test")).toEqual({
      args: ["run", "test"],
      binary: "npm",
    });
  });
});

describe("createLocalPreviewPreflight", () => {
  it("allows WebContainer preview when project, command, and browser are ready", () => {
    const preflight = createLocalPreviewPreflight(
      {
        capability: "webcontainer",
        confidence: "high",
        devCommand: "npm run dev",
        installCommand: "npm install",
        warnings: [],
      },
      { canUseWebContainer: true },
    );

    expect(preflight).toMatchObject({
      canAttemptWebContainer: true,
      command: "npm run dev",
      mode: "webcontainer",
    });
    expect(preflight.items.every((item) => item.status === "pass")).toBe(true);
    expect(preflight.reason).toBe("WebContainer dev server URL を iframe に best-effort で接続します。");
  });

  it("records why preview falls back when browser isolation is missing", () => {
    const preflight = createLocalPreviewPreflight(
      {
        capability: "webcontainer",
        confidence: "high",
        devCommand: "npm run dev",
        installCommand: "npm install",
        warnings: [],
      },
      { canUseWebContainer: false },
    );

    expect(preflight).toMatchObject({
      canAttemptWebContainer: false,
      mode: "manual",
    });
    expect(preflight.items.find((item) => item.id === "browser")).toMatchObject({
      status: "blocked",
    });
    expect(preflight.reason).toContain("cross-origin isolation");
  });

  it("records why preview falls back when no preview command exists", () => {
    const preflight = createLocalPreviewPreflight(
      {
        capability: "webcontainer",
        confidence: "medium",
        installCommand: "npm install",
        warnings: ["dev / preview script が見つかりません。"],
      },
      { canUseWebContainer: true },
    );

    expect(preflight.canAttemptWebContainer).toBe(false);
    expect(preflight.items.find((item) => item.id === "command")).toMatchObject({
      status: "blocked",
    });
  });
});

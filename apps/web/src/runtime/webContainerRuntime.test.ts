import { describe, expect, it } from "vitest";
import { createWebContainerFileTree, splitCommand } from "./webContainerRuntime";

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

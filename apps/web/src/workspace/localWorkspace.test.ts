import { describe, expect, it } from "vitest";
import { parseGitIgnore, shouldIgnorePath } from "./localWorkspace";

describe("local folder ignore rules", () => {
  it("ignores default heavy folders and binary files", () => {
    expect(shouldIgnorePath("node_modules/react/index.js", false, [])).toBe(true);
    expect(shouldIgnorePath(".git/", true, [])).toBe(true);
    expect(shouldIgnorePath("assets/logo.png", false, [])).toBe(true);
  });

  it("applies simple root .gitignore patterns", () => {
    const rules = parseGitIgnore(`
# comment
dist/
*.log
.env
!keep.log
`);

    expect(shouldIgnorePath("dist/", true, rules)).toBe(true);
    expect(shouldIgnorePath("dist/app.js", false, rules)).toBe(true);
    expect(shouldIgnorePath("debug.log", false, rules)).toBe(true);
    expect(shouldIgnorePath(".env", false, rules)).toBe(true);
    expect(shouldIgnorePath("src/index.ts", false, rules)).toBe(false);
  });
});

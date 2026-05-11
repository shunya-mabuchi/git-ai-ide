import { describe, expect, it } from "vitest";
import { evaluatePullRequestFlow, evaluateSafetyGate } from "./index";

const readyInput = {
  branchGoalSet: true,
  branchPushed: true,
  commitCreated: true,
  contextPackReviewed: true,
  modelAccepted: true,
  patchReviewed: true,
  previewChecked: true,
  prDraftGenerated: true,
  testsPassed: true,
  unresolvedWarnings: 0,
};

describe("evaluateSafetyGate", () => {
  it("allows pull request creation when the full workflow is checked", () => {
    expect(evaluateSafetyGate(readyInput)).toMatchObject({
      canCreateCommit: true,
      canCreatePullRequest: true,
      summary: "ready_for_pr",
    });
  });

  it("blocks pull request creation until branch is pushed", () => {
    const result = evaluateSafetyGate({
      ...readyInput,
      branchPushed: false,
    });

    expect(result).toMatchObject({
      canCreateCommit: true,
      canCreatePullRequest: false,
      summary: "ready_for_commit",
    });
    expect(result.items.find((item) => item.id === "branch-pushed")).toMatchObject({
      status: "warning",
    });
  });

  it("keeps pull request creation unavailable until Local Preview is checked", () => {
    const result = evaluateSafetyGate({
      ...readyInput,
      previewChecked: false,
    });

    expect(result).toMatchObject({
      canCreateCommit: true,
      canCreatePullRequest: false,
      summary: "ready_for_commit",
    });
    expect(result.items.find((item) => item.id === "preview")).toMatchObject({
      status: "warning",
    });
  });
});

describe("evaluatePullRequestFlow", () => {
  it("marks demo mode ready when safety gate and branch push are complete", () => {
    expect(
      evaluatePullRequestFlow({
        baseBranch: "main",
        branch: "feature/demo",
        branchPushed: true,
        githubConfigured: false,
        installationSelected: false,
        repository: "demo/pr-helper-mini",
        safetyGateReady: true,
      }),
    ).toMatchObject({
      canCreatePullRequest: true,
      mode: "demo",
      summary: "ready",
    });
  });

  it("waits for branch push before PR creation", () => {
    const result = evaluatePullRequestFlow({
      baseBranch: "main",
      branch: "feature/demo",
      branchPushed: false,
      githubConfigured: false,
      installationSelected: false,
      repository: "demo/pr-helper-mini",
      safetyGateReady: true,
    });

    expect(result).toMatchObject({
      canCreatePullRequest: false,
      summary: "waiting",
    });
    expect(result.items.find((item) => item.id === "push")).toMatchObject({
      status: "warning",
    });
  });

  it("blocks GitHub App mode until an installation is selected", () => {
    const result = evaluatePullRequestFlow({
      baseBranch: "main",
      branch: "feature/demo",
      branchPushed: true,
      githubConfigured: true,
      installationSelected: false,
      repository: "owner/repo",
      safetyGateReady: true,
    });

    expect(result.canCreatePullRequest).toBe(false);
    expect(result.items.find((item) => item.id === "mode")).toMatchObject({
      status: "blocked",
    });
  });
});

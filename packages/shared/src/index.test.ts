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
  it("blocks PR creation until GitHub setup is ready", () => {
    expect(
      evaluatePullRequestFlow({
        baseBranch: "main",
        branch: "feature/change",
        branchPushed: true,
        githubConfigured: false,
        installationSelected: false,
        repository: "shunya-mabuchi/git-ai-ide",
        safetyGateReady: true,
      }),
    ).toMatchObject({
      canCreatePullRequest: false,
      mode: "setup_required",
      summary: "waiting",
    });
  });

  it("waits for branch push before PR creation", () => {
    const result = evaluatePullRequestFlow({
      baseBranch: "main",
      branch: "feature/change",
      branchPushed: false,
      githubConfigured: true,
      installationSelected: true,
      repository: "shunya-mabuchi/git-ai-ide",
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

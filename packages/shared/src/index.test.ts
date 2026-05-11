import { describe, expect, it } from "vitest";
import { evaluateSafetyGate } from "./index";

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

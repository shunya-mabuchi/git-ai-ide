import {
  Bot,
  CheckCircle2,
  Circle,
  Code2,
  Files,
  GitBranch,
  GitPullRequest,
  Play,
  Search,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";
import type { PointerEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import Editor, { DiffEditor } from "@monaco-editor/react";
import { planRuntimeFromPackageJson } from "@git-ai-ide/ai-runtime";
import { createSnapshotGitStatus, summarizeGitStatus } from "@git-ai-ide/git-core";
import { applyStructuredEdits } from "@git-ai-ide/patch-core";
import { evaluateSafetyGate } from "@git-ai-ide/shared";
import { demoBranchGoal, demoFiles, demoPatch, demoRepoMap } from "./demo/demoRepo";
import {
  createGitHubPullRequest,
  loadGitHubRepositories,
  loadGitHubSetup,
  type GitHubRepositoryOption,
} from "./github/githubClient";
import {
  loadWorkspaceSnapshot,
  openLocalDirectorySnapshot,
  saveWorkspaceSnapshot,
  supportsLocalDirectoryAccess,
  type WorkspaceSnapshot,
} from "./workspace/localWorkspace";

type FileName = string;
type SidePanelMode = "explorer" | "search" | "git";
type BottomPanelMode = "problems" | "terminal" | "output";
type DiffMode = "patch" | "file";
type PrDraftMode = "preview" | "raw";
type AiRuntimeMode = "recorded" | "webllm" | "ollama";
type TaskPriority = "fast" | "balanced" | "deep";

const aiMessages = [
  {
    title: "差分の説明",
    body:
      "このブランチでは PR 要約生成の改善を行います。最初の安全な変更として、diff を解析する前に空入力を検出します。",
  },
  {
    title: "小さな修正案",
    body:
      "generateSummary.ts 向けに構造化された編集案を作りました。変更対象は 1 関数だけで、適用前に diff review が必要です。",
  },
];

export function App() {
  const [selectedFile, setSelectedFile] = useState<FileName>("src/features/pr-summary/generateSummary.ts");
  const [files, setFiles] = useState<Record<string, string>>(demoFiles);
  const [baselineFiles, setBaselineFiles] = useState<Record<string, string>>(demoFiles);
  const [workspaceName, setWorkspaceName] = useState("PR Helper Mini");
  const [workspaceSource, setWorkspaceSource] = useState<WorkspaceSnapshot["source"]>("demo");
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [isOpeningWorkspace, setIsOpeningWorkspace] = useState(false);
  const [workspaceRestored, setWorkspaceRestored] = useState(false);
  const [patchApplied, setPatchApplied] = useState(false);
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffMode, setDiffMode] = useState<DiffMode>("patch");
  const [diffFile, setDiffFile] = useState<FileName>("src/features/pr-summary/generateSummary.ts");
  const [explorerWidth, setExplorerWidth] = useState(260);
  const [assistantWidth, setAssistantWidth] = useState(360);
  const [explorerVisible, setExplorerVisible] = useState(true);
  const [sidePanelMode, setSidePanelMode] = useState<SidePanelMode>("explorer");
  const [assistantVisible, setAssistantVisible] = useState(true);
  const [bottomPanelMode, setBottomPanelMode] = useState<BottomPanelMode>("terminal");
  const [bottomPanelCollapsed, setBottomPanelCollapsed] = useState(false);
  const [testsRun, setTestsRun] = useState(false);
  const [prDraftGenerated, setPrDraftGenerated] = useState(false);
  const [prDraftMode, setPrDraftMode] = useState<PrDraftMode>("preview");
  const [branchName, setBranchName] = useState("feature/pr-summary");
  const [branchGoalMarkdown, setBranchGoalMarkdown] = useState(demoBranchGoal.markdown);
  const [commitMessage, setCommitMessage] = useState("");
  const [commitCreated, setCommitCreated] = useState(false);
  const [branchPushed, setBranchPushed] = useState(false);
  const [createdPrUrl, setCreatedPrUrl] = useState("");
  const [githubConfigured, setGithubConfigured] = useState(false);
  const [githubInstallUrl, setGithubInstallUrl] = useState("");
  const [githubRepositories, setGithubRepositories] = useState<GitHubRepositoryOption[]>([]);
  const [selectedRepository, setSelectedRepository] = useState("demo/pr-helper-mini");
  const [selectedInstallationId, setSelectedInstallationId] = useState<number | undefined>();
  const [githubStatusMessage, setGithubStatusMessage] = useState("GitHub Worker 未確認");
  const [isCreatingPr, setIsCreatingPr] = useState(false);
  const [aiRuntimeMode, setAiRuntimeMode] = useState<AiRuntimeMode>("recorded");
  const [taskPriority, setTaskPriority] = useState<TaskPriority>("balanced");
  const [assistedMemory, setAssistedMemory] = useState(
    "この repo では、AI は structured edit を提案し、ユーザーが diff review 後に適用する。",
  );

  useEffect(() => {
    if (window.innerWidth < 1180) {
      setExplorerVisible(false);
      setAssistantVisible(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    Promise.all([loadGitHubSetup(), loadGitHubRepositories()])
      .then(([setup, repositories]) => {
        if (cancelled) return;
        setGithubConfigured(setup.appConfigured);
        setGithubInstallUrl(setup.installUrl);
        setGithubRepositories(repositories);
        const firstRepository = repositories[0];
        if (firstRepository) {
          setSelectedRepository(firstRepository.fullName);
          setSelectedInstallationId(firstRepository.installationId);
        }
        setGithubStatusMessage(setup.appConfigured ? "GitHub App configured" : "Demo mode: GitHub secrets 未設定");
      })
      .catch(() => {
        if (cancelled) return;
        setGithubRepositories([
          {
            defaultBranch: "main",
            fullName: "demo/pr-helper-mini",
            name: "pr-helper-mini",
            owner: "demo",
          },
        ]);
        setGithubStatusMessage("Worker 未起動: demo mode fallback");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    loadWorkspaceSnapshot()
      .then((snapshot) => {
        if (!snapshot || cancelled) return;
        setFiles(snapshot.files);
        setBaselineFiles(snapshot.files);
        setWorkspaceName(snapshot.name);
        setWorkspaceSource(snapshot.source);
        setSelectedFile(selectPreferredFile(snapshot.files));
        setDiffFile(selectPreferredFile(snapshot.files));
        setWorkspaceRestored(true);
      })
      .catch(() => {
        if (!cancelled) {
          setWorkspaceError("前回の workspace を復元できませんでした。");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void saveWorkspaceSnapshot({
      files,
      name: workspaceName,
      openedAt: new Date().toISOString(),
      source: workspaceSource,
    }).catch(() => {
      setWorkspaceError("workspace snapshot を保存できませんでした。");
    });
  }, [files, workspaceName, workspaceSource]);

  const fileNames = useMemo(() => Object.keys(files).sort(), [files]);
  const gitStatus = useMemo(
    () =>
      createSnapshotGitStatus({
        baselineFiles,
        branch: branchName,
        files,
      }),
    [baselineFiles, branchName, files],
  );
  const sourceControlSummary = summarizeGitStatus(gitStatus);
  const currentFile = files[selectedFile] ?? "";
  const preview = useMemo(() => applyStructuredEdits(files, demoPatch.edits), [files]);
  const primaryEdit = demoPatch.edits[0];
  const patchTargetAvailable = Boolean(files[primaryEdit.file]);
  const previewFile = preview.ok ? preview.files[primaryEdit.file] : undefined;
  const activeDiffFile = diffMode === "patch" ? primaryEdit.file : diffFile;
  const diffOriginal = diffMode === "patch" ? files[primaryEdit.file] : baselineFiles[activeDiffFile] ?? "";
  const diffModified = diffMode === "patch" ? previewFile ?? "Patch preview を生成できませんでした。" : files[activeDiffFile] ?? "";
  const diffReason =
    diffMode === "patch"
      ? primaryEdit.reason
      : `${activeDiffFile} の baseline との差分です。commit すると baseline が更新されます。`;
  const contextBudget = useMemo(
    () =>
      createContextBudget({
        assistedMemory,
        branchGoalMarkdown,
        currentFile,
        fileCount: fileNames.length,
        gitChangeCount: gitStatus.entries.length,
        priority: taskPriority,
      }),
    [assistedMemory, branchGoalMarkdown, currentFile, fileNames.length, gitStatus.entries.length, taskPriority],
  );
  const runtimeSuggestion = suggestRuntimeMode({
    budgetRatio: contextBudget.used / contextBudget.limit,
    changeCount: gitStatus.entries.length,
    fileCount: fileNames.length,
    priority: taskPriority,
  });
  const selectedRuntimeLabel = runtimeLabels[aiRuntimeMode];
  const runtimePlan = useMemo(() => planRuntimeFromPackageJson(files), [files]);
  const safetyGate = useMemo(
    () =>
      evaluateSafetyGate({
        branchGoalSet: Boolean(branchGoalMarkdown.trim()),
        commitCreated,
        contextPackReviewed: true,
        modelAccepted: true,
        patchReviewed: patchApplied || commitCreated,
        prDraftGenerated,
        testsPassed: testsRun,
        unresolvedWarnings: runtimePlan.warnings.length,
      }),
    [branchGoalMarkdown, commitCreated, patchApplied, prDraftGenerated, runtimePlan.warnings.length, testsRun],
  );
  const currentStep = commitCreated ? "Commit draft 作成済み" : testsRun ? "PR 作成待ち" : patchApplied ? "Tests 実行待ち" : "変更中";
  const safetyStatus = testsRun
    ? commitCreated
      ? "Commit draft 作成済み"
      : "Tests 通過"
    : patchApplied
      ? "Patch 適用済み / Tests 未実行"
      : "Patch review が必要";

  const openDiffPreview = () => {
    if (!patchTargetAvailable) {
      setSidePanelMode("git");
      setExplorerVisible(true);
      setWorkspaceError("このデモ patch の対象ファイルは、現在の workspace にはありません。");
      return;
    }

    setSelectedFile(primaryEdit.file);
    setDiffFile(primaryEdit.file);
    setDiffMode("patch");
    setDiffOpen(true);
  };

  const openChangedFileDiff = (file: string) => {
    setDiffFile(file);
    setDiffMode("file");
    if (file in files) {
      setSelectedFile(file);
    }
    setDiffOpen(true);
  };

  const toggleSidePanel = (mode: SidePanelMode) => {
    if (explorerVisible && sidePanelMode === mode) {
      setExplorerVisible(false);
      return;
    }

    setSidePanelMode(mode);
    setExplorerVisible(true);
  };

  const applyPatch = () => {
    if (!preview.ok) return;
    setFiles(preview.files);
    setPatchApplied(true);
    setTestsRun(false);
    setPrDraftGenerated(false);
    setCommitCreated(false);
    setBranchPushed(false);
    setCreatedPrUrl("");
    setDiffOpen(false);
  };

  const runDemoTests = () => {
    if (!patchApplied) return;
    setTestsRun(true);
    setBottomPanelMode("terminal");
  };

  const pushBranch = () => {
    if (!commitCreated) {
      setBottomPanelMode("problems");
      setBottomPanelCollapsed(false);
      return;
    }

    setBranchPushed(true);
    setBottomPanelMode("output");
    setBottomPanelCollapsed(false);
  };

  const openLocalWorkspace = async () => {
    setIsOpeningWorkspace(true);
    setWorkspaceError(null);

    try {
      const snapshot = await openLocalDirectorySnapshot();
      setFiles(snapshot.files);
      setBaselineFiles(snapshot.files);
      setWorkspaceName(snapshot.name);
      setWorkspaceSource(snapshot.source);
      setSelectedFile(selectPreferredFile(snapshot.files));
      setDiffFile(selectPreferredFile(snapshot.files));
      setDiffOpen(false);
      setPatchApplied(false);
      setTestsRun(false);
      setPrDraftGenerated(false);
      setCommitMessage("");
      setCommitCreated(false);
      setBranchPushed(false);
      setCreatedPrUrl("");
      setWorkspaceRestored(false);
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "repo を開けませんでした。");
    } finally {
      setIsOpeningWorkspace(false);
    }
  };

  const restoreDemoWorkspace = () => {
    setFiles(demoFiles);
    setBaselineFiles(demoFiles);
    setWorkspaceName("PR Helper Mini");
    setWorkspaceSource("demo");
    setSelectedFile("src/features/pr-summary/generateSummary.ts");
    setDiffFile("src/features/pr-summary/generateSummary.ts");
    setDiffOpen(false);
    setPatchApplied(false);
    setTestsRun(false);
    setPrDraftGenerated(false);
    setBranchName("feature/pr-summary");
    setCommitMessage("");
    setCommitCreated(false);
    setBranchPushed(false);
    setCreatedPrUrl("");
    setWorkspaceError(null);
    setWorkspaceRestored(false);
  };

  const updateCurrentFile = (value?: string) => {
    setFiles((currentFiles) => ({
      ...currentFiles,
      [selectedFile]: value ?? "",
    }));
    setTestsRun(false);
    setPrDraftGenerated(false);
    setCommitCreated(false);
    setBranchPushed(false);
    setCreatedPrUrl("");
  };

  const generatePrDraft = () => {
    if (!testsRun) {
      setBottomPanelMode("problems");
      return;
    }

    setPrDraftGenerated(true);
    setPrDraftMode("preview");
    setBottomPanelMode("output");
    setBottomPanelCollapsed(false);
  };

  const createCommitDraft = () => {
    if (!gitStatus.hasChanges) {
      setBottomPanelMode("problems");
      setBottomPanelCollapsed(false);
      return;
    }

    const nextMessage = `Improve PR summary generation\n\n- Update ${gitStatus.entries.length} file(s)\n- Keep changes scoped to ${branchName}`;
    setCommitMessage(nextMessage);
    setCommitCreated(true);
    setBranchPushed(false);
    setCreatedPrUrl("");
    setBaselineFiles(files);
    setPatchApplied(false);
    setPrDraftGenerated(false);
    setBottomPanelMode("output");
    setBottomPanelCollapsed(false);
  };

  const createPullRequest = async () => {
    if (!safetyGate.canCreatePullRequest || !branchPushed) {
      setBottomPanelMode("problems");
      setBottomPanelCollapsed(false);
      return;
    }

    setIsCreatingPr(true);

    try {
      const result = await createGitHubPullRequest({
        baseBranch: "main",
        body: demoPrDraft,
        branch: branchName,
        installationId: selectedInstallationId,
        repository: selectedRepository,
        title: extractMarkdownTitle(branchGoalMarkdown) || "Git AI IDE PR",
      });
      setCreatedPrUrl(result.pullRequest.url);
      setGithubStatusMessage(result.mode === "github" ? "GitHub PR created" : "Demo PR created");
      setBottomPanelMode("output");
      setBottomPanelCollapsed(false);
    } catch (error) {
      const fallbackUrl = `https://github.com/${selectedRepository}/pull/128`;
      setCreatedPrUrl(fallbackUrl);
      setGithubStatusMessage(error instanceof Error ? `Worker fallback: ${error.message}` : "Worker fallback");
      setBottomPanelMode("output");
      setBottomPanelCollapsed(false);
    } finally {
      setIsCreatingPr(false);
    }
  };

  const startExplorerResize = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = explorerWidth;

    const onMove = (moveEvent: globalThis.PointerEvent) => {
      const nextWidth = clamp(startWidth + moveEvent.clientX - startX, 200, 420);
      setExplorerWidth(nextWidth);
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const startAssistantResize = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = assistantWidth;

    const onMove = (moveEvent: globalThis.PointerEvent) => {
      const nextWidth = clamp(startWidth - (moveEvent.clientX - startX), 280, 520);
      setAssistantWidth(nextWidth);
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const bodyGridTemplateColumns = [
    "48px",
    explorerVisible ? `${explorerWidth}px` : "",
    explorerVisible ? "6px" : "",
    "minmax(0, 1fr)",
    assistantVisible ? "6px" : "",
    assistantVisible ? `${assistantWidth}px` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <main className="ide-shell">
      <header className="titlebar">
        <div className="brand">
          <Code2 size={18} />
          <strong>Git AI IDE</strong>
          <span>{workspaceName}</span>
        </div>
        <div className="titlebar-center">
        <span><GitBranch size={14} /> {branchName}</span>
          <span>{demoBranchGoal.title}</span>
          <span><ShieldCheck size={14} /> {safetyStatus}</span>
        </div>
        <div className="titlebar-actions">
          <button className="titlebar-action" onClick={generatePrDraft}><GitPullRequest size={15} /> PR 説明を生成</button>
        </div>
      </header>

      <section className="ide-body" style={{ gridTemplateColumns: bodyGridTemplateColumns }}>
        <nav className="activity-bar" aria-label="主要ナビゲーション">
          <button
            className={explorerVisible && sidePanelMode === "explorer" ? "activity-button active" : "activity-button"}
            aria-label="Explorer"
            onClick={() => toggleSidePanel("explorer")}
          >
            <Files size={21} />
          </button>
          <button
            className={explorerVisible && sidePanelMode === "search" ? "activity-button active" : "activity-button"}
            aria-label="Search"
            onClick={() => toggleSidePanel("search")}
          >
            <Search size={21} />
          </button>
          <button
            className={explorerVisible && sidePanelMode === "git" ? "activity-button active" : "activity-button"}
            aria-label="Git"
            onClick={() => toggleSidePanel("git")}
          >
            <GitBranch size={21} />
          </button>
          <button
            className={assistantVisible ? "activity-button active" : "activity-button"}
            aria-label={assistantVisible ? "AI Assistant を隠す" : "AI Assistant を表示"}
            onClick={() => setAssistantVisible((visible) => !visible)}
          >
            <Bot size={21} />
          </button>
        </nav>

        {explorerVisible ? (
          <>
            <aside className="explorer">
              {sidePanelMode === "explorer" ? (
                <>
                  <section className="explorer-section">
                    <PanelTitle title="Explorer" />
                    <div className="repo-heading">
                      <strong>{workspaceName}</strong>
                      <span>{workspaceRestored ? "IndexedDB から復元" : workspaceSourceLabel(workspaceSource)}</span>
                    </div>
                    <div className="workspace-actions">
                      <button
                        className="button secondary"
                        disabled={!supportsLocalDirectoryAccess() || isOpeningWorkspace}
                        onClick={openLocalWorkspace}
                      >
                        {isOpeningWorkspace ? "読み込み中" : "ローカル repo を開く"}
                      </button>
                      <button className="button ghost" onClick={restoreDemoWorkspace}>デモ repo</button>
                    </div>
                    {workspaceError ? <div className="workspace-error">{workspaceError}</div> : null}
                    <nav className="file-list">
                      {fileNames.map((file) => (
                        <button
                          className={file === selectedFile ? "file-item active" : "file-item"}
                          key={file}
                          onClick={() => {
                            setSelectedFile(file);
                            setDiffOpen(false);
                          }}
                        >
                          {file}
                        </button>
                      ))}
                    </nav>
                  </section>

                  <section className="explorer-section">
                    <PanelTitle title="Repo Map" />
                    <div className="repo-map">
                      <span>{workspaceName} / {fileNames.length} files</span>
                      <span>{demoRepoMap.detectedStack.join(" / ")}</span>
                      <span>test: {demoRepoMap.commands.test}</span>
                      <span>typecheck: {demoRepoMap.commands.typecheck}</span>
                    </div>
                  </section>
                </>
              ) : null}

              {sidePanelMode === "search" ? (
                <section className="explorer-section">
                  <PanelTitle title="Search" />
                  <label className="search-box">
                    <Search size={15} />
                    <input placeholder="ファイル名やコードを検索" />
                  </label>
                  <div className="empty-state">
                    <strong>検索は次の実装対象です</strong>
                    <p>まずはファイル名、次にコード全文検索と Context Pack への追加に対応します。</p>
                  </div>
                </section>
              ) : null}

              {sidePanelMode === "git" ? (
                <section className="explorer-section">
                  <PanelTitle title="Source Control" />
                  <div className="git-summary">
                    <span><GitBranch size={14} /> {gitStatus.branch}</span>
                    <strong>{sourceControlSummary}</strong>
                    <small>baseline: {gitStatus.baseBranch}</small>
                  </div>
                  <label className="branch-input">
                    <span>Branch</span>
                    <input value={branchName} onChange={(event) => setBranchName(event.target.value)} />
                  </label>
                  <div className="branch-goal-card">
                    <span>Branch Goal</span>
                    <strong>{extractMarkdownTitle(branchGoalMarkdown) || demoBranchGoal.title}</strong>
                  </div>
                  <PanelTitle title="Changes" />
                  <div className="change-list">
                    {gitStatus.entries.length > 0 ? (
                      gitStatus.entries.map((entry) => (
                        <button
                          className="change-item"
                          key={entry.file}
                          onClick={() => {
                            openChangedFileDiff(entry.file);
                          }}
                        >
                          <span>{entry.file}</span>
                          <strong>{entry.status}</strong>
                        </button>
                      ))
                    ) : (
                      <div className="empty-change">workspace に変更はありません</div>
                    )}
                    {!patchApplied ? (
                      <button className="change-item proposed" onClick={openDiffPreview}>
                        <span>{primaryEdit.file}</span>
                        <strong>{patchTargetAvailable ? "proposed patch" : "not in workspace"}</strong>
                      </button>
                    ) : null}
                  </div>
                  <div className="git-actions">
                    <button className="button secondary" disabled={!patchTargetAvailable} onClick={openDiffPreview}>Diff を確認</button>
                    <button className="button" disabled={!patchTargetAvailable || !preview.ok || patchApplied} onClick={applyPatch}>
                      Patch を適用
                    </button>
                    <button className="button secondary" disabled={!gitStatus.hasChanges} onClick={createCommitDraft}>
                      Commit draft
                    </button>
                    <button className="button secondary" disabled={!commitCreated || branchPushed} onClick={pushBranch}>
                      Push
                    </button>
                    <button className="button" disabled={!safetyGate.canCreatePullRequest || !branchPushed || Boolean(createdPrUrl) || isCreatingPr} onClick={createPullRequest}>
                      {isCreatingPr ? "作成中" : "PR 作成"}
                    </button>
                  </div>
                  <div className="github-box">
                    <strong>GitHub Integration</strong>
                    <label className="repo-select">
                      <span>Repository</span>
                      <select
                        value={selectedRepository}
                        onChange={(event) => {
                          const repository = githubRepositories.find((item) => item.fullName === event.target.value);
                          setSelectedRepository(event.target.value);
                          setSelectedInstallationId(repository?.installationId);
                        }}
                      >
                        {githubRepositories.map((repository) => (
                          <option key={repository.fullName} value={repository.fullName}>
                            {repository.fullName}
                          </option>
                        ))}
                      </select>
                    </label>
                    <span>{githubConfigured ? "GitHub App configured" : "Demo mode"}</span>
                    <span>{githubStatusMessage}</span>
                    {githubInstallUrl ? <a href={githubInstallUrl}>GitHub App install</a> : null}
                    <span>{branchPushed ? "branch pushed" : "push pending"}</span>
                    {createdPrUrl ? <a href={createdPrUrl}>{createdPrUrl}</a> : null}
                  </div>
                  {commitCreated ? (
                    <div className="commit-box">
                      <strong>Commit draft</strong>
                      <pre>{commitMessage}</pre>
                    </div>
                  ) : null}
                </section>
              ) : null}
            </aside>
            <div
              aria-label="Explorer の幅を調整"
              className="resize-handle explorer-resize"
              role="separator"
              onPointerDown={startExplorerResize}
            />
          </>
        ) : null}

        <section className={bottomPanelCollapsed ? "workbench bottom-collapsed" : "workbench"}>
          <div className="branch-status-bar">
            <span><Circle size={14} /> 現在: {currentStep}</span>
            <span>{testsRun ? "PR 作成前チェックを確認できます" : patchApplied ? "次はテスト実行に進めます" : "AI patch を確認してから適用します"}</span>
          </div>

          <div className="editor-tabs">
            <button className="tab active">{diffOpen ? `Diff: ${activeDiffFile}` : selectedFile}</button>
          </div>

          <div className="editor-surface">
            {diffOpen ? (
              <div className="diff-panel">
                <div className="editor-toolbar">
                  <span>Diff Preview</span>
                  <button className="icon-button" aria-label="Diff preview を閉じる" onClick={() => setDiffOpen(false)}>
                    <X size={16} />
                  </button>
                </div>
                <DiffEditor
                  className="lf-monaco-diff"
                  height="100%"
                  language={languageForFile(activeDiffFile)}
                  modified={diffModified}
                  original={diffOriginal}
                  theme="vs-dark"
                  options={monacoDiffOptions}
                />
                <div className="diff-footer">
                  <span>{diffReason}</span>
                  <div className="patch-actions">
                    <button className="button secondary" onClick={() => setDiffOpen(false)}>戻る</button>
                    {diffMode === "patch" ? (
                      <button className="button" disabled={!preview.ok || patchApplied} onClick={applyPatch}>
                        確認して適用
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <div className="editor-card">
                <Editor
                  className="lf-monaco-editor"
                  height="100%"
                  key={selectedFile}
                  language={languageForFile(selectedFile)}
                  onChange={updateCurrentFile}
                  options={monacoEditorOptions}
                  path={selectedFile}
                  theme="vs-dark"
                  value={currentFile}
                />
              </div>
            )}
          </div>

          <footer className={bottomPanelCollapsed ? "bottom-panel collapsed" : "bottom-panel"}>
            <div className="bottom-tabs">
              <button
                className={bottomPanelMode === "problems" ? "bottom-tab active" : "bottom-tab"}
                onClick={() => setBottomPanelMode("problems")}
              >
                問題
              </button>
              <button
                className={bottomPanelMode === "terminal" ? "bottom-tab active" : "bottom-tab"}
                onClick={() => setBottomPanelMode("terminal")}
              >
                ターミナル
              </button>
              <button
                className={bottomPanelMode === "output" ? "bottom-tab active" : "bottom-tab"}
                onClick={() => setBottomPanelMode("output")}
              >
                出力
              </button>
              <button className="button secondary run-tests" disabled={!patchApplied || testsRun} onClick={runDemoTests}>
                <Play size={15} /> デモテストを実行
              </button>
              <button className="button ghost collapse-bottom" onClick={() => setBottomPanelCollapsed((collapsed) => !collapsed)}>
                {bottomPanelCollapsed ? "開く" : "閉じる"}
              </button>
            </div>
            {!bottomPanelCollapsed ? <div className="bottom-content">
              {bottomPanelMode === "problems" ? (
                safetyGate.canCreatePullRequest ? (
                  <div className="problem-row success"><CheckCircle2 size={15} /> 問題は検出されていません</div>
                ) : runtimePlan.warnings.length > 0 ? (
                  <div className="problem-row warning"><TriangleAlert size={15} /> {runtimePlan.warnings.join(" / ")}</div>
                ) : !branchPushed && commitCreated ? (
                  <div className="problem-row warning"><TriangleAlert size={15} /> PR 作成前に branch push が必要です</div>
                ) : gitStatus.hasChanges ? (
                  <div className="problem-row warning"><TriangleAlert size={15} /> commit 前にテストまたは差分確認が必要です</div>
                ) : !patchApplied ? (
                  <div className="problem-row warning"><TriangleAlert size={15} /> PR 説明の生成前に Patch review と適用が必要です</div>
                ) : (
                  <div className="problem-row warning"><TriangleAlert size={15} /> PR 説明の生成前にテスト実行が必要です</div>
                )
              ) : null}
              {bottomPanelMode === "terminal" ? (
                <pre className="terminal-view">{testsRun ? demoTestLogPassed : demoTestLogIdle}</pre>
              ) : null}
              {bottomPanelMode === "output" ? (
                prDraftGenerated ? (
                  <div className="pr-draft-panel">
                    <div className="preview-toolbar">
                      <button className={prDraftMode === "preview" ? "bottom-tab active" : "bottom-tab"} onClick={() => setPrDraftMode("preview")}>Preview</button>
                      <button className={prDraftMode === "raw" ? "bottom-tab active" : "bottom-tab"} onClick={() => setPrDraftMode("raw")}>Raw</button>
                    </div>
                    {prDraftMode === "preview" ? <MarkdownPreview markdown={demoPrDraft} /> : <pre className="terminal-view">{demoPrDraft}</pre>}
                  </div>
                ) : createdPrUrl ? (
                  <pre className="terminal-view">{`Pull request created\n\n${createdPrUrl}`}</pre>
                ) : branchPushed ? (
                  <pre className="terminal-view">{`Branch pushed\n\n${branchName} -> origin/${branchName}\nReady to create pull request.`}</pre>
                ) : commitCreated ? (
                  <pre className="terminal-view">{`Commit draft created\n\n${commitMessage}`}</pre>
                ) : (
                  <pre className="terminal-view">{testsRun ? demoOutputPassed : demoOutputIdle}</pre>
                )
              ) : null}
            </div> : null}
          </footer>
        </section>

        {assistantVisible ? (
          <>
            <div
              aria-label="AI Assistant の幅を調整"
              className="resize-handle assistant-resize"
              role="separator"
              onPointerDown={startAssistantResize}
            />
            <aside className="assistant-panel">
              <section className="assistant-section">
                <div className="assistant-header">
                  <PanelTitle title="AI Assistant" />
                  <button className="icon-button" aria-label="AI Assistant を閉じる" onClick={() => setAssistantVisible(false)}>
                    <X size={16} />
                  </button>
                </div>
                <div className="chat-list">
                  {aiMessages.map((message) => (
                    <article className="chat-message" key={message.title}>
                      <strong>{message.title}</strong>
                      <p>{message.body}</p>
                    </article>
                  ))}
                </div>
              </section>

              <section className="assistant-section">
                <PanelTitle title="Context Pack" />
                <div className="segmented-control">
                  <button className={taskPriority === "fast" ? "active" : ""} onClick={() => setTaskPriority("fast")}>Fast</button>
                  <button className={taskPriority === "balanced" ? "active" : ""} onClick={() => setTaskPriority("balanced")}>Balanced</button>
                  <button className={taskPriority === "deep" ? "active" : ""} onClick={() => setTaskPriority("deep")}>Deep</button>
                </div>
                <div className="budget">
                  <div className="budget-bar"><span style={{ width: `${contextBudget.percent}%` }} /></div>
                  <span>{formatTokenCount(contextBudget.used)} / {formatTokenCount(contextBudget.limit)} tokens 使用中</span>
                </div>
                <ul className="check-list">
                  <li><CheckCircle2 size={15} /> Branch Goal</li>
                  <li><CheckCircle2 size={15} /> 現在のファイル</li>
                  <li>{gitStatus.hasChanges ? <CheckCircle2 size={15} /> : <Circle size={15} />} Git diff</li>
                  <li>{assistedMemory.trim() ? <CheckCircle2 size={15} /> : <Circle size={15} />} Assisted Memory</li>
                </ul>
              </section>

              <section className="assistant-section">
                <PanelTitle title="Model Routing" />
                <div className="runtime-grid">
                  {(["recorded", "webllm", "ollama"] as const).map((runtime) => (
                    <button
                      className={aiRuntimeMode === runtime ? "runtime-card active" : "runtime-card"}
                      key={runtime}
                      onClick={() => setAiRuntimeMode(runtime)}
                    >
                      <strong>{runtimeLabels[runtime]}</strong>
                      <span>{runtimeDescriptions[runtime]}</span>
                    </button>
                  ))}
                </div>
                <div className="routing-note">
                  <strong>Suggestion: {runtimeLabels[runtimeSuggestion]}</strong>
                  <span>Selected: {selectedRuntimeLabel}</span>
                </div>
              </section>

              <section className="assistant-section">
                <PanelTitle title="Runtime Plan" />
                <div className="runtime-plan">
                  <span>capability: {runtimePlan.capability}</span>
                  <span>confidence: {runtimePlan.confidence}</span>
                  <span>test: {runtimePlan.testCommand ?? "not detected"}</span>
                  <span>typecheck: {runtimePlan.typecheckCommand ?? "not detected"}</span>
                </div>
              </section>

              <section className="assistant-section">
                <PanelTitle title="Branch Goal" />
                <textarea
                  className="markdown-editor"
                  value={branchGoalMarkdown}
                  onChange={(event) => setBranchGoalMarkdown(event.target.value)}
                />
              </section>

              <section className="assistant-section">
                <PanelTitle title="Assisted Memory" />
                <textarea
                  className="memory-editor"
                  value={assistedMemory}
                  onChange={(event) => setAssistedMemory(event.target.value)}
                />
              </section>

              <section className="assistant-section patch-section">
                <PanelTitle title="Patch Queue" />
                <article className="patch-card">
                  <div className="patch-heading">
                    <strong>{demoPatch.title}</strong>
                    <span>{patchApplied ? "適用済み" : preview.ok ? "レビュー可能" : "確認が必要"}</span>
                  </div>
                  <p>{demoPatch.summary}</p>
                  <ul className="check-list">
                    <li><CheckCircle2 size={15} /> 構造化 edit を解析済み</li>
                    <li>{patchTargetAvailable ? <CheckCircle2 size={15} /> : <TriangleAlert size={15} />} 対象ファイル</li>
                    <li>{preview.ok ? <CheckCircle2 size={15} /> : <TriangleAlert size={15} />} 対象テキストが一致</li>
                    <li>{preview.ok ? <CheckCircle2 size={15} /> : <TriangleAlert size={15} />} Diff preview を生成済み</li>
                    <li>{testsRun ? <CheckCircle2 size={15} /> : <TriangleAlert size={15} />} {testsRun ? "テスト通過" : "テスト未実行"}</li>
                  </ul>
                  <div className="patch-actions">
                    <button className="button secondary" disabled={!patchTargetAvailable} onClick={openDiffPreview}>Diff を確認</button>
                    <button className="button" disabled={!patchTargetAvailable || !preview.ok || patchApplied} onClick={applyPatch}>
                      適用
                    </button>
                  </div>
                </article>
              </section>

              <section className="assistant-section">
                <PanelTitle title="PR 作成前チェック" />
                <div className="soft-gate">
                  {safetyGate.items.map((item) => (
                    <span key={item.id}>
                      {item.status === "pass" ? <CheckCircle2 size={15} /> : item.status === "blocked" ? <TriangleAlert size={15} /> : <Circle size={15} />}
                      {item.label}
                    </span>
                  ))}
                  <span>{branchPushed ? <CheckCircle2 size={15} /> : <Circle size={15} />} Branch pushed</span>
                  <span>{createdPrUrl ? <CheckCircle2 size={15} /> : <Circle size={15} />} PR created</span>
                </div>
              </section>
            </aside>
          </>
        ) : null}
      </section>
    </main>
  );
}

function PanelTitle({ title }: { title: string }) {
  return <h2 className="panel-title">{title}</h2>;
}

function MarkdownPreview({ markdown }: { markdown: string }) {
  const blocks = markdown.split(/\n(?=##? )/);

  return (
    <div className="markdown-preview">
      {blocks.map((block) => {
        const lines = block.trim().split("\n");
        const heading = lines[0] ?? "";
        const body = lines.slice(1);

        if (heading.startsWith("# ")) {
          return (
            <section key={block}>
              <h1>{heading.replace(/^# /, "")}</h1>
              {body.map((line) => renderMarkdownLine(line))}
            </section>
          );
        }

        if (heading.startsWith("## ")) {
          return (
            <section key={block}>
              <h2>{heading.replace(/^## /, "")}</h2>
              {body.map((line) => renderMarkdownLine(line))}
            </section>
          );
        }

        return <section key={block}>{lines.map((line) => renderMarkdownLine(line))}</section>;
      })}
    </div>
  );
}

function renderMarkdownLine(line: string) {
  if (!line.trim()) return null;
  if (line.startsWith("- ")) return <p className="markdown-list-item" key={line}>{line.replace(/^- /, "")}</p>;
  return <p key={line}>{line}</p>;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function languageForFile(fileName: string) {
  if (fileName.endsWith(".ts") || fileName.endsWith(".tsx")) return "typescript";
  if (fileName.endsWith(".json")) return "json";
  if (fileName.endsWith(".md")) return "markdown";
  return "plaintext";
}

function selectPreferredFile(files: Record<string, string>) {
  const fileNames = Object.keys(files).sort();
  return (
    fileNames.find((file) => file.endsWith("/generateSummary.ts")) ??
    fileNames.find((file) => file.endsWith("package.json")) ??
    fileNames.find((file) => file.toLowerCase().endsWith("readme.md")) ??
    fileNames[0] ??
    ""
  );
}

function workspaceSourceLabel(source: WorkspaceSnapshot["source"]) {
  if (source === "local-directory") return "Local Directory";
  if (source === "indexeddb") return "Browser Snapshot";
  return "Demo Repo";
}

function createContextBudget(input: {
  assistedMemory: string;
  branchGoalMarkdown: string;
  currentFile: string;
  fileCount: number;
  gitChangeCount: number;
  priority: TaskPriority;
}) {
  const limitByPriority: Record<TaskPriority, number> = {
    fast: 4_000,
    balanced: 8_000,
    deep: 16_000,
  };
  const used =
    700 +
    estimateTokens(input.currentFile) +
    estimateTokens(input.branchGoalMarkdown) +
    estimateTokens(input.assistedMemory) +
    input.fileCount * 24 +
    input.gitChangeCount * 180;
  const limit = limitByPriority[input.priority];

  return {
    limit,
    percent: Math.min(100, Math.round((used / limit) * 100)),
    used,
  };
}

function suggestRuntimeMode(input: {
  budgetRatio: number;
  changeCount: number;
  fileCount: number;
  priority: TaskPriority;
}): AiRuntimeMode {
  if (input.priority === "deep" || input.budgetRatio > 0.85 || input.changeCount > 8 || input.fileCount > 80) {
    return "ollama";
  }

  if (input.priority === "fast" && input.changeCount <= 1 && input.budgetRatio < 0.55) {
    return "webllm";
  }

  return "recorded";
}

function estimateTokens(text: string) {
  return Math.ceil(text.length / 4);
}

function formatTokenCount(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
}

function extractMarkdownTitle(markdown: string) {
  return markdown
    .split("\n")
    .find((line) => line.startsWith("# "))
    ?.replace(/^# /, "");
}

const runtimeLabels: Record<AiRuntimeMode, string> = {
  ollama: "Ollama",
  recorded: "Recorded AI",
  webllm: "WebLLM",
};

const runtimeDescriptions: Record<AiRuntimeMode, string> = {
  ollama: "ローカル常駐モデルで重い判断を担当",
  recorded: "デモが必ず成立する再生モード",
  webllm: "ブラウザ内で小さな判断を担当",
};

const monacoEditorOptions = {
  automaticLayout: true,
  fontFamily: '"Cascadia Code", "SFMono-Regular", Consolas, monospace',
  fontSize: 13,
  lineHeight: 22,
  minimap: { enabled: false },
  padding: { top: 12, bottom: 12 },
  scrollBeyondLastLine: false,
  smoothScrolling: true,
  tabSize: 2,
  wordWrap: "off",
} as const;

const monacoDiffOptions = {
  ...monacoEditorOptions,
  renderSideBySide: true,
  readOnly: true,
} as const;

const demoTestLogIdle = `PS git-ai-ide> pnpm test
テストはまだ実行されていません。
Patch を適用すると、ここからデモテストを実行できます。`;

const demoTestLogPassed = `PS git-ai-ide> pnpm test

> pr-helper-mini@0.1.0 test
> vitest run

✓ generateSummary handles empty diff input
✓ generateSummary keeps existing summary format

Test Files  1 passed
Tests       2 passed
Duration    642ms`;

const demoOutputIdle = `Git AI IDE Runtime
WebContainer / local command runner の出力をここに集約します。`;

const demoOutputPassed = `Git AI IDE Runtime
Patch proposal applied.
Safety checklist updated.
Branch is ready for commit draft.`;

const demoPrDraft = `# PR 要約生成を改善する

## 概要
- PR 要約生成の入力 diff が空の場合に、明示的なエラーとして扱うようにしました。
- 変更対象は generateSummary の入力検証のみです。

## 変更内容
- generateSummary(diff) の先頭で空文字・空白のみの diff を検出
- 空入力時は "Diff input is required" を返して、無効な PR 要約を作らない

## 安全確認
- Patch Queue: 確認済み
- Tests: 通過
- 影響範囲: src/features/pr-summary/generateSummary.ts の 1 関数

## テスト
- generateSummary handles empty diff input
- generateSummary keeps existing summary format`;

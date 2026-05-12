import {
  Bot,
  CheckCircle2,
  ChevronRight,
  Circle,
  Code2,
  File,
  FilePlus2,
  Files,
  Folder,
  FolderPlus,
  FolderOpen,
  GitBranch,
  GitPullRequest,
  History,
  Merge,
  Pencil,
  Play,
  Save,
  Search,
  ShieldCheck,
  TriangleAlert,
  Trash2,
  X,
} from "lucide-react";
import type { PointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Editor, { DiffEditor, type OnMount } from "@monaco-editor/react";
import { createDefaultRuntimeStatus, detectBrowserAiRuntime, planRuntimeFromPackageJson, requestPatchProposal } from "@git-ai-ide/ai-runtime";
import { createSnapshotGitStatus, summarizeGitStatus } from "@git-ai-ide/git-core";
import { applyStructuredEdits } from "@git-ai-ide/patch-core";
import { evaluatePullRequestFlow, evaluateSafetyGate, type ContextPack, type PatchProposal } from "@git-ai-ide/shared";
import { demoFiles, demoPatch } from "./demo/demoRepo";
import {
  createGitHubPullRequest,
  createGitHubBranch,
  loadGitHubBranches,
  loadGitHubCommits,
  loadGitHubInstallations,
  loadGitHubRepositories,
  loadGitHubSetup,
  pushGitHubFiles,
  type GitHubBranchOption,
  type GitHubCommitOption,
  type GitHubInstallationOption,
  type GitHubRepositoryOption,
} from "./github/githubClient";
import {
  loadWorkspaceSnapshot,
  openLocalDirectorySnapshot,
  saveWorkspaceSnapshot,
  supportsLocalDirectoryAccess,
  type WorkspaceSnapshot,
} from "./workspace/localWorkspace";
import { clearAssistedMemory, createAssistedMemoryProjectKey, loadAssistedMemory, saveAssistedMemory } from "./workspace/assistedMemory";
import { createLocalPreviewPreflight, runRuntimeChecks, startLocalPreview } from "./runtime/webContainerRuntime";
import { getSupportedWebLlmModelIds, runWebLlmSmokeTest } from "./runtime/webLlmRuntime";
import {
  detectWebLlmDeviceProfile,
  formatBytes,
  rankWebLlmModels,
  type WebLlmDeviceProfile,
  type WebLlmTask,
} from "./runtime/webLlmModelCatalog";

type FileName = string;
type SidePanelMode = "explorer" | "search" | "git";
type BottomPanelMode = "problems" | "terminal" | "preview" | "output";
type DiffMode = "patch" | "file";
type EditorView = "file" | "preview";
type GitHubSetupState = "checking" | "worker-offline" | "secrets-missing" | "installation-missing" | "repository-missing" | "ready";
type PrDraftMode = "preview" | "raw";
type AiRuntimeMode = "recorded" | "webllm" | "ollama";
type TaskPriority = "fast" | "balanced" | "deep";
type VisibleAiRuntimeMode = Exclude<AiRuntimeMode, "ollama">;
type PatchQueueSource = "fixture" | "ai";

type PatchQueueItem = {
  failureReason?: string;
  proposal: PatchProposal;
  source: PatchQueueSource;
};

type SearchResult = {
  file: string;
  line: number;
  matchType: "filename" | "content";
  preview: string;
};

type ExplorerNode = {
  children: ExplorerNode[];
  name: string;
  path: string;
  type: "directory" | "file";
};

type RuntimeDiagnosticItem = {
  detail: string;
  group: "github" | "webllm" | "webcontainer";
  id: string;
  label: string;
  status: "pass" | "warning" | "blocked";
};

type BranchSummary = {
  ahead: number;
  behind: number;
  label: string;
  name: string;
  role: "base" | "working" | "review";
  status: "current" | "ready" | "needs-work";
};

type CommitHistoryItem = {
  author: string;
  branch: string;
  message: string;
  sha: string;
  time: string;
};

type MergeReadinessItem = {
  detail: string;
  id: string;
  label: string;
  status: "pass" | "warning" | "blocked";
};

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

const defaultWebLlmDeviceProfile: WebLlmDeviceProfile = {
  adapterDetail: "WebGPU device 診断はまだ実行していません。",
  crossOriginIsolated: false,
  tier: "none",
  webGpuAvailable: false,
};

const webLlmFailedModelsStorageKey = "git-ai-ide.webllm.failed-models";

const emptyPatchProposal: PatchProposal = {
  edits: [
    {
      file: "",
      find: "",
      operation: "replace",
      reason: "WebLLM から proposal を生成するまで diff はありません。",
      replacement: "",
    },
  ],
  id: "no-patch-proposal",
  safety: {
    branchGoalAttached: false,
    contextPackReviewed: false,
    diffPreviewGenerated: false,
    gitDiffUpdated: false,
    modelCapabilityAccepted: false,
    structuredEditParsed: false,
    targetFileExists: false,
    targetTextMatched: false,
    testsRun: false,
  },
  status: "needs_attention",
  summary: "WebLLM が利用可能になったら、選択中の file と Branch Goal から structured edit proposal を生成します。",
  title: "Patch proposal はまだありません",
};

export function App() {
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const forceWebContainerPreview = useMemo(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("preview") === "webcontainer";
  }, []);
  const testFixtureEnabled = useMemo(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("fixture") === "demo";
  }, []);
  const initialFile = testFixtureEnabled ? "src/features/pr-summary/generateSummary.ts" : "";
  const initialFiles = testFixtureEnabled ? demoFiles : {};
  const [selectedFile, setSelectedFile] = useState<FileName>(initialFile);
  const [openFiles, setOpenFiles] = useState<FileName[]>(initialFile ? [initialFile] : []);
  const [editorTarget, setEditorTarget] = useState<{ file: FileName; line: number } | null>(null);
  const [files, setFiles] = useState<Record<string, string>>(initialFiles);
  const [baselineFiles, setBaselineFiles] = useState<Record<string, string>>(initialFiles);
  const [savedFiles, setSavedFiles] = useState<Record<string, string>>(initialFiles);
  const [workspaceName, setWorkspaceName] = useState(testFixtureEnabled ? "PR Helper Mini" : "No workspace");
  const [workspaceSource, setWorkspaceSource] = useState<WorkspaceSnapshot["source"]>(testFixtureEnabled ? "demo" : "empty");
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [isOpeningWorkspace, setIsOpeningWorkspace] = useState(false);
  const [workspaceRestored, setWorkspaceRestored] = useState(false);
  const [patchApplied, setPatchApplied] = useState(false);
  const [patchQueue, setPatchQueue] = useState<PatchQueueItem[]>(testFixtureEnabled ? [{ proposal: demoPatch, source: "fixture" }] : []);
  const [activePatchId, setActivePatchId] = useState(testFixtureEnabled ? demoPatch.id : emptyPatchProposal.id);
  const [patchGenerationState, setPatchGenerationState] = useState<"idle" | "running">("idle");
  const [patchGenerationMessage, setPatchGenerationMessage] = useState(
    testFixtureEnabled ? "Test fixture patch を読み込み済みです。" : "WebLLM を使って patch proposal を生成してください。",
  );
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffMode, setDiffMode] = useState<DiffMode>("patch");
  const [diffFile, setDiffFile] = useState<FileName>("src/features/pr-summary/generateSummary.ts");
  const [explorerWidth, setExplorerWidth] = useState(260);
  const [assistantWidth, setAssistantWidth] = useState(360);
  const [explorerVisible, setExplorerVisible] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set(["src", "src/features", "src/features/pr-summary"]));
  const [sidePanelMode, setSidePanelMode] = useState<SidePanelMode>("explorer");
  const [searchQuery, setSearchQuery] = useState("");
  const [assistantVisible, setAssistantVisible] = useState(true);
  const [bottomPanelMode, setBottomPanelMode] = useState<BottomPanelMode>("terminal");
  const [bottomPanelCollapsed, setBottomPanelCollapsed] = useState(false);
  const [testsRun, setTestsRun] = useState(false);
  const [runtimeRunState, setRuntimeRunState] = useState<"idle" | "running">("idle");
  const [runtimeLog, setRuntimeLog] = useState(fixtureTestLogIdle);
  const [previewRunState, setPreviewRunState] = useState<"idle" | "running" | "ready">("idle");
  const [previewLog, setPreviewLog] = useState("Local Preview はまだ起動していません。");
  const [previewMode, setPreviewMode] = useState<"candidate" | "manual" | "webcontainer">("candidate");
  const [previewTabOpen, setPreviewTabOpen] = useState(false);
  const [editorView, setEditorView] = useState<EditorView>("file");
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewAddress, setPreviewAddress] = useState("http://localhost:5173");
  const [prDraftGenerated, setPrDraftGenerated] = useState(false);
  const [prDraftMode, setPrDraftMode] = useState<PrDraftMode>("preview");
  const [prDraftMarkdown, setPrDraftMarkdown] = useState("");
  const [branchName, setBranchName] = useState("feature/change");
  const [branchGoalMarkdown, setBranchGoalMarkdown] = useState(
    "# Branch Goal\n\n- 変更目的を書く\n- 確認したい挙動を書く\n- PR で閉じる issue があれば記録する\n",
  );
  const [newFilePath, setNewFilePath] = useState("src/features/pr-summary/notes.md");
  const [newFolderPath, setNewFolderPath] = useState("src/features/pr-summary/docs");
  const [renameFilePath, setRenameFilePath] = useState("src/features/pr-summary/generateSummary.ts");
  const [mergeTargetBranch, setMergeTargetBranch] = useState("main");
  const [conflictFixtureEnabled, setConflictFixtureEnabled] = useState(false);
  const [fileOperationMessage, setFileOperationMessage] = useState("選択中のファイルに対して作成・改名・削除できます。");
  const [lastSavedAt, setLastSavedAt] = useState("");
  const [commitMessage, setCommitMessage] = useState("");
  const [commitCreated, setCommitCreated] = useState(false);
  const [branchPushed, setBranchPushed] = useState(false);
  const [createdPrUrl, setCreatedPrUrl] = useState("");
  const [pushedCommitSha, setPushedCommitSha] = useState("");
  const [closeIssueNumber, setCloseIssueNumber] = useState("");
  const [githubConfigured, setGithubConfigured] = useState(false);
  const [githubInstallUrl, setGithubInstallUrl] = useState("");
  const [githubInstallations, setGithubInstallations] = useState<GitHubInstallationOption[]>([]);
  const [githubRepositories, setGithubRepositories] = useState<GitHubRepositoryOption[]>([]);
  const [githubBranches, setGithubBranches] = useState<GitHubBranchOption[]>([]);
  const [githubCommits, setGithubCommits] = useState<GitHubCommitOption[]>([]);
  const [githubSetupState, setGithubSetupState] = useState<GitHubSetupState>("checking");
  const [selectedRepository, setSelectedRepository] = useState("");
  const [selectedInstallationId, setSelectedInstallationId] = useState<number | undefined>();
  const [githubStatusMessage, setGithubStatusMessage] = useState("GitHub Worker 未確認");
  const [isLoadingGitHubRepositories, setIsLoadingGitHubRepositories] = useState(false);
  const [isLoadingRemoteGit, setIsLoadingRemoteGit] = useState(false);
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);
  const [isPushingBranch, setIsPushingBranch] = useState(false);
  const [isCreatingPr, setIsCreatingPr] = useState(false);
  const [aiRuntimeMode, setAiRuntimeMode] = useState<AiRuntimeMode>("webllm");
  const [aiRuntimeStatus, setAiRuntimeStatus] = useState(createDefaultRuntimeStatus());
  const [aiRuntimeCheckState, setAiRuntimeCheckState] = useState<"checking" | "ready">("checking");
  const [webLlmDiagnosticState, setWebLlmDiagnosticState] = useState<"idle" | "running">("idle");
  const [webLlmDiagnosticLog, setWebLlmDiagnosticLog] = useState("WebLLM 実モデルロード診断はまだ実行していません。");
  const [webLlmDeviceProfile, setWebLlmDeviceProfile] = useState<WebLlmDeviceProfile>(defaultWebLlmDeviceProfile);
  const [selectedWebLlmModelId, setSelectedWebLlmModelId] = useState("Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC");
  const [failedWebLlmModelIds, setFailedWebLlmModelIds] = useState<Set<string>>(() => loadFailedWebLlmModelIds());
  const [taskPriority, setTaskPriority] = useState<TaskPriority>("balanced");
  const [assistedMemory, setAssistedMemory] = useState(
    "この repo では、AI は structured edit を提案し、ユーザーが diff review 後に適用する。",
  );
  const [memoryStatusMessage, setMemoryStatusMessage] = useState("Project memory は未保存です。");
  const [memorySavedAt, setMemorySavedAt] = useState("");

  const assistedMemoryProjectKey = useMemo(
    () =>
      createAssistedMemoryProjectKey({
        repository: selectedRepository,
        workspaceName,
      }),
    [selectedRepository, workspaceName],
  );

  const applyGitHubRepositories = (repositories: GitHubRepositoryOption[]) => {
    setGithubRepositories(repositories);
    const firstRepository = repositories[0];
    if (firstRepository) {
      setSelectedRepository(firstRepository.fullName);
      setSelectedInstallationId(firstRepository.installationId);
    }
  };

  useEffect(() => {
    if (window.innerWidth < 1180) {
      setExplorerVisible(false);
      setAssistantVisible(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    setAiRuntimeCheckState("checking");
    detectBrowserAiRuntime()
      .then((status) => {
        if (cancelled) return;
        setAiRuntimeStatus(status);
        setAiRuntimeMode("webllm");
        setAiRuntimeCheckState("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setAiRuntimeStatus(createDefaultRuntimeStatus());
        setAiRuntimeMode("webllm");
        setAiRuntimeCheckState("ready");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    detectWebLlmDeviceProfile().then((profile) => {
      if (cancelled) return;
      setWebLlmDeviceProfile(profile);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    loadGitHubSetup()
      .then(async (setup) => {
        if (cancelled) return;
        setGithubConfigured(setup.appConfigured);
        setGithubInstallUrl(setup.installUrl);

        if (!setup.appConfigured) {
          setGithubRepositories([]);
          setSelectedRepository("");
          setSelectedInstallationId(undefined);
          setGithubSetupState("secrets-missing");
          setGithubStatusMessage("GitHub App credentials 未設定");
          return;
        }

        const installations = await loadGitHubInstallations();
        if (cancelled) return;
        setGithubInstallations(installations);

        const firstInstallation = installations[0];
        if (!firstInstallation) {
          setGithubRepositories([]);
          setSelectedInstallationId(undefined);
          setGithubSetupState("installation-missing");
          setGithubStatusMessage("GitHub App configured / installation 未検出");
          return;
        }

        setSelectedInstallationId(firstInstallation.id);
        setIsLoadingGitHubRepositories(true);
        const repositories = await loadGitHubRepositories(firstInstallation.id);
        if (cancelled) return;
        setIsLoadingGitHubRepositories(false);
        setGithubRepositories(repositories);
        applyGitHubRepositories(repositories);
        setGithubSetupState(repositories.length > 0 ? "ready" : "repository-missing");
        setGithubStatusMessage(`GitHub App configured / ${firstInstallation.accountLogin}`);
      })
      .catch(() => {
        if (cancelled) return;
        setGithubRepositories([]);
        setSelectedRepository("");
        setSelectedInstallationId(undefined);
        setIsLoadingGitHubRepositories(false);
        setGithubSetupState("worker-offline");
        setGithubStatusMessage("Worker 未起動");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (testFixtureEnabled) return;

    loadWorkspaceSnapshot()
      .then((snapshot) => {
        if (!snapshot || cancelled) return;
        if (snapshot.source === "demo") return;
        setFiles(snapshot.files);
        setBaselineFiles(snapshot.files);
        setSavedFiles(snapshot.files);
        setWorkspaceName(snapshot.name);
        setWorkspaceSource(snapshot.source);
        const preferredFile = selectPreferredFile(snapshot.files);
        openFile(preferredFile);
        setDiffFile(preferredFile);
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
  }, [testFixtureEnabled]);

  useEffect(() => {
    if (workspaceSource === "empty") return;
    void saveWorkspaceSnapshot({
      files,
      name: workspaceName,
      openedAt: new Date().toISOString(),
      source: workspaceSource,
    }).catch(() => {
      setWorkspaceError("workspace snapshot を保存できませんでした。");
    });
  }, [files, workspaceName, workspaceSource]);

  useEffect(() => {
    const record = loadAssistedMemory(assistedMemoryProjectKey);
    if (!record) {
      setMemorySavedAt("");
      setMemoryStatusMessage("Project memory は未保存です。");
      return;
    }

    setAssistedMemory(record.memory);
    setMemorySavedAt(record.savedAt);
    setMemoryStatusMessage("Project memory を復元しました。");
  }, [assistedMemoryProjectKey]);

  useEffect(() => {
    if (!editorTarget || editorTarget.file !== selectedFile || diffOpen) return;
    revealEditorLine(editorRef.current, editorTarget.line);
  }, [diffOpen, editorTarget, selectedFile]);

  useEffect(() => {
    setRenameFilePath(selectedFile);
  }, [selectedFile]);

  const fileNames = useMemo(() => Object.keys(files).sort(), [files]);
  const explorerTree = useMemo(() => buildExplorerTree(fileNames), [fileNames]);
  const searchResults = useMemo(() => searchWorkspace(files, searchQuery), [files, searchQuery]);
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
  const dirtyFiles = useMemo(() => createDirtyFileSet(savedFiles, files), [files, savedFiles]);
  const selectedFileDirty = dirtyFiles.has(selectedFile);
  const repositoryIsSelectable = githubRepositories.some((repository) => repository.fullName === selectedRepository);
  const selectedRepositoryOption = githubRepositories.find((repository) => repository.fullName === selectedRepository);
  const realGitHubMode = githubSetupState === "ready" && githubConfigured && Boolean(selectedInstallationId) && repositoryIsSelectable;
  const sourceControlModeLabel = realGitHubMode ? "GitHub Source Control" : "GitHub connection required";
  const sourceControlModeDetail = realGitHubMode
    ? "選択した GitHub repository に branch push / PR 作成を行います。"
    : "GitHub App を接続するか、ローカルフォルダを開いて workspace を読み込んでください。未接続時は push / PR 作成を実行しません。";
  const githubOperationLabel = realGitHubMode ? "Real GitHub operation" : "Setup required";
  const githubSetupChecklist = useMemo(
    () => [
      {
        detail:
          githubSetupState === "worker-offline"
            ? "Cloudflare Worker に接続できません。Worker を起動するか deploy URL を設定してください。"
            : githubSetupState === "checking"
              ? "GitHub Worker の setup state を確認中です。"
              : "GitHub Worker に接続できています。",
        id: "worker",
        label: "Worker connection",
        status: githubSetupState === "worker-offline" ? "blocked" : githubSetupState === "checking" ? "warning" : "pass",
      },
      {
        detail: githubConfigured
          ? "GitHub App secrets は Worker 側で設定済みです。"
          : "GITHUB_APP_ID / GITHUB_APP_PRIVATE_KEY / GITHUB_APP_SLUG を Worker secret に設定すると実操作に進めます。",
        id: "secrets",
        label: "GitHub App credentials",
        status: githubConfigured ? "pass" : "blocked",
      },
      {
        detail: selectedInstallationId
          ? "GitHub App installation を選択済みです。"
          : githubConfigured
            ? "GitHub App を対象 repository に install してください。"
            : "credentials 設定後に installation を選択できます。",
        id: "installation",
        label: "Installation",
        status: selectedInstallationId ? "pass" : githubConfigured ? "blocked" : "warning",
      },
      {
        detail: realGitHubMode
          ? `${selectedRepository} を実操作対象として選択中です。`
          : githubConfigured && selectedInstallationId
            ? "selected repository を読み込めていません。installation の権限を確認してください。"
            : "GitHub App の credentials / installation / repository を設定してください。",
        id: "repository",
        label: "Selected repository",
        status: realGitHubMode ? "pass" : githubConfigured && selectedInstallationId ? "blocked" : "warning",
      },
    ],
    [githubConfigured, githubSetupState, realGitHubMode, selectedInstallationId, selectedRepository],
  );
  const branchSummaries = useMemo<BranchSummary[]>(
    () => {
      if (realGitHubMode && githubBranches.length > 0) {
        return githubBranches.map((branch) => ({
          ahead: branch.name === branchName && (commitCreated || branchPushed) ? 1 : 0,
          behind: 0,
          label: branch.default ? "default branch" : branch.protected ? "protected branch" : "remote branch",
          name: branch.name,
          role: branch.default ? "base" : branch.name === branchName ? "working" : "review",
          status: branch.name === branchName ? "current" : "ready",
        }));
      }

      return [
        {
          ahead: 0,
          behind: 0,
          label: realGitHubMode ? "base branch" : "local base",
          name: "main",
          role: "base",
          status: branchName === "main" ? "current" : "ready",
        },
        {
          ahead: commitCreated ? 1 : gitStatus.hasChanges ? 0 : branchPushed ? 1 : 0,
          behind: 0,
          label: realGitHubMode ? "working branch" : "local working branch",
          name: branchName,
          role: "working",
          status: gitStatus.hasChanges ? "needs-work" : "current",
        },
        {
          ahead: branchPushed ? 1 : 0,
          behind: branchPushed ? 0 : 1,
          label: realGitHubMode ? "PR branch" : "PR branch pending",
          name: realGitHubMode ? `${branchName}-review` : branchName,
          role: "review",
          status: branchPushed ? "ready" : "needs-work",
        },
      ];
    },
    [branchName, branchPushed, commitCreated, gitStatus.hasChanges, githubBranches, realGitHubMode],
  );
  const commitHistory = useMemo<CommitHistoryItem[]>(
    () => {
      if (realGitHubMode && githubCommits.length > 0) {
        return githubCommits.map((commit) => ({
          author: commit.author,
          branch: commit.branch,
          message: commit.message,
          sha: commit.sha.slice(0, 7),
          time: commit.time ? formatDateTime(commit.time) : "remote",
        }));
      }

      return [
        ...(commitCreated
          ? [
              {
                author: realGitHubMode ? "You + GitHub" : "local draft",
                branch: branchName,
                message: commitMessage.split("\n")[0] || "Improve PR summary generation",
                sha: pushedCommitSha.slice(0, 7) || "local01",
                time: branchPushed ? "pushed" : "local draft",
              },
            ]
          : []),
        {
          author: realGitHubMode ? "remote" : "local baseline",
          branch: "main",
          message: "Add PR summary generator",
          sha: "b41f7a2",
          time: realGitHubMode ? "remote base" : "baseline",
        },
        {
          author: realGitHubMode ? "remote" : "local baseline",
          branch: "main",
          message: "Create typed summary contract",
          sha: "9c12d4e",
          time: realGitHubMode ? "remote base" : "baseline",
        },
      ];
    },
    [branchName, branchPushed, commitCreated, commitMessage, githubCommits, pushedCommitSha, realGitHubMode],
  );
  const mergeReadiness = useMemo<MergeReadinessItem[]>(
    () => [
      {
        detail: gitStatus.hasChanges ? `${gitStatus.entries.length} 件の未 commit 変更があります。` : "working tree は clean です。",
        id: "clean-tree",
        label: "Working tree",
        status: gitStatus.hasChanges ? "warning" : "pass",
      },
      {
        detail: testsRun ? "テスト実行済みです。" : "merge 前に Tests を実行してください。",
        id: "tests",
        label: "Tests",
        status: testsRun ? "pass" : "blocked",
      },
      {
        detail: previewRunState === "ready" ? "Local Preview 確認済みです。" : "UI 変更は preview 確認が必要です。",
        id: "preview",
        label: "Preview",
        status: previewRunState === "ready" ? "pass" : "warning",
      },
      {
        detail: conflictFixtureEnabled
          ? "test fixture で同じ行を変更した想定です。解消方針を確認してください。"
          : "既知の conflict はありません。",
        id: "conflict",
        label: "Conflict",
        status: conflictFixtureEnabled ? "blocked" : "pass",
      },
      {
        detail: branchPushed ? `${mergeTargetBranch} へ PR 作成可能です。` : "remote branch push 後に PR / merge へ進めます。",
        id: "remote",
        label: "Remote branch",
        status: branchPushed ? "pass" : "warning",
      },
    ],
    [branchPushed, conflictFixtureEnabled, gitStatus.entries.length, gitStatus.hasChanges, mergeTargetBranch, previewRunState, testsRun],
  );
  const currentFile = files[selectedFile] ?? "";
  const activePatchItem = patchQueue.find((item) => item.proposal.id === activePatchId) ?? patchQueue[0] ?? { proposal: emptyPatchProposal, source: "ai" };
  const activePatch = activePatchItem.proposal;
  const hasActivePatchProposal = patchQueue.length > 0;
  const preview = useMemo(() => applyStructuredEdits(files, activePatch.edits), [activePatch.edits, files]);
  const primaryEdit = activePatch.edits[0] ?? emptyPatchProposal.edits[0];
  const patchTargetAvailable = Boolean(files[primaryEdit.file]);
  const activePatchRejected = activePatch.status === "rejected";
  const canReviewPatch = hasActivePatchProposal && patchTargetAvailable && !activePatchRejected;
  const canApplyPatch = canReviewPatch && preview.ok && !patchApplied;
  const patchFailureReason = activePatchItem.failureReason ?? (!preview.ok ? preview.error : "");
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
  const contextPack = useMemo<ContextPack>(
    () => ({
      assistedMemory,
      branchGoalMarkdown,
      currentFile,
      fileCount: fileNames.length,
      gitChangeCount: gitStatus.entries.length,
      tokenBudget: {
        limit: contextBudget.limit,
        used: contextBudget.used,
      },
    }),
    [assistedMemory, branchGoalMarkdown, contextBudget.limit, contextBudget.used, currentFile, fileNames.length, gitStatus.entries.length],
  );
  const runtimeSuggestion = suggestRuntimeMode({
    aiRuntimeStatus,
    budgetRatio: contextBudget.used / contextBudget.limit,
    changeCount: gitStatus.entries.length,
    fileCount: fileNames.length,
    priority: taskPriority,
  });
  const webLlmTask: WebLlmTask = taskPriority === "deep" ? "branch_review" : gitStatus.entries.length > 0 ? "patch" : "pr_draft";
  const supportedWebLlmModelIds = useMemo(() => getSupportedWebLlmModelIds(), []);
  const rankedWebLlmModels = useMemo(
    () =>
      rankWebLlmModels({
        device: webLlmDeviceProfile,
        failedModelIds: failedWebLlmModelIds,
        task: webLlmTask,
        verifiedModelIds: new Set(),
      }),
    [failedWebLlmModelIds, webLlmDeviceProfile, webLlmTask],
  );
  const visibleWebLlmModels = rankedWebLlmModels.filter((model) => model.visibility !== "hidden").slice(0, 4);
  const hiddenFailedWebLlmModelCount = rankedWebLlmModels.filter((model) => model.compatibility === "failed_on_device").length;
  const recommendedWebLlmModel = rankedWebLlmModels.find((model) => model.visibility === "recommended") ?? rankedWebLlmModels[0];
  const selectedRuntimeLabel = runtimeLabels[aiRuntimeMode];
  const selectedRuntimeHealth = aiRuntimeStatus.providers.find((provider) => provider.provider === aiRuntimeMode);
  const selectedRuntimeAvailable = aiRuntimeMode === "webllm" && selectedRuntimeHealth?.status === "available";
  useEffect(() => {
    if (!recommendedWebLlmModel) return;
    setSelectedWebLlmModelId((current) =>
      current && visibleWebLlmModels.some((model) => model.id === current) ? current : recommendedWebLlmModel.id,
    );
  }, [recommendedWebLlmModel, visibleWebLlmModels]);
  const runtimePlan = useMemo(() => planRuntimeFromPackageJson(files), [files]);
  const previewPreflight = useMemo(
    () =>
      createLocalPreviewPreflight(runtimePlan, {
        forceManual: false,
      }),
    [forceWebContainerPreview, runtimePlan, workspaceSource],
  );
  const safetyGate = useMemo(
    () =>
      evaluateSafetyGate({
        branchPushed,
        branchGoalSet: Boolean(branchGoalMarkdown.trim()),
        commitCreated,
        contextPackReviewed: true,
        modelAccepted: selectedRuntimeAvailable,
        patchReviewed: patchApplied || commitCreated,
        previewChecked: previewRunState === "ready",
        prDraftGenerated,
        testsPassed: testsRun,
        unresolvedWarnings: runtimePlan.warnings.length,
      }),
    [branchGoalMarkdown, branchPushed, commitCreated, patchApplied, previewRunState, prDraftGenerated, runtimePlan.warnings.length, selectedRuntimeAvailable, testsRun],
  );
  const pullRequestFlow = useMemo(
    () =>
      evaluatePullRequestFlow({
        baseBranch: "main",
        branch: branchName,
        branchPushed,
        createdPrUrl,
        githubConfigured,
        installationSelected: Boolean(selectedInstallationId),
        repository: selectedRepository,
        safetyGateReady: safetyGate.canCreatePullRequest,
      }),
    [branchName, branchPushed, createdPrUrl, githubConfigured, safetyGate.canCreatePullRequest, selectedInstallationId, selectedRepository],
  );
  const runtimeDiagnostics = useMemo<RuntimeDiagnosticItem[]>(() => {
    const webllmHealth = aiRuntimeStatus.providers.find((provider) => provider.provider === "webllm");
    const githubModeReady = githubConfigured && Boolean(selectedInstallationId);
    const webContainerBlocked = previewPreflight.items.find((item) => item.status === "blocked");
    const webContainerWarning = previewPreflight.items.find((item) => item.status === "warning");

    return [
      {
        detail: githubConfigured
          ? selectedInstallationId
            ? `${selectedRepository} の installation を選択済みです。`
            : "GitHub App mode では installation 選択が必要です。"
          : "GitHub App credentials が未設定です。実 repo 操作には Worker secrets が必要です。",
        group: "github",
        id: "github-credentials",
        label: "GitHub App credentials",
        status: githubModeReady ? "pass" : "blocked",
      },
      {
        detail: branchPushed
          ? `branch push 済み${pushedCommitSha ? `: ${pushedCommitSha.slice(0, 12)}` : ""}`
          : "実 PR 作成前に branch push を確認します。",
        group: "github",
        id: "github-branch-push",
        label: "Branch push E2E",
        status: branchPushed ? "pass" : "warning",
      },
      {
        detail: createdPrUrl || "PR 作成後に URL と issue close keyword を確認します。",
        group: "github",
        id: "github-pr",
        label: "PR creation / issue close",
        status: createdPrUrl ? "pass" : "warning",
      },
      {
        detail: webllmHealth?.detail ?? "WebLLM runtime をまだ確認していません。",
        group: "webllm",
        id: "webllm-webgpu",
        label: "WebGPU / WebLLM readiness",
        status: webllmHealth?.status === "available" ? "pass" : "blocked",
      },
      {
        detail:
          webllmHealth?.status === "available"
            ? `${visibleWebLlmModels.length} 件の候補を device / task で推薦しています。`
            : "WebGPU 対応端末で model loading を確認します。",
        group: "webllm",
        id: "webllm-model-load",
        label: "Model catalog / cache",
        status: webllmHealth?.status === "available" ? "warning" : "blocked",
      },
      {
        detail: previewPreflight.reason,
        group: "webcontainer",
        id: "webcontainer-preflight",
        label: "WebContainer preflight",
        status: webContainerBlocked ? "blocked" : webContainerWarning ? "warning" : "pass",
      },
      {
        detail: previewUrl || "WebContainer dev server URL は Local Preview 実行後に表示されます。",
        group: "webcontainer",
        id: "webcontainer-iframe",
        label: "iframe preview",
        status: previewMode === "webcontainer" && previewUrl ? "pass" : "warning",
      },
    ];
  }, [
    aiRuntimeStatus.providers,
    branchPushed,
    createdPrUrl,
    githubConfigured,
    previewMode,
    previewPreflight.items,
    previewPreflight.reason,
    previewUrl,
    pushedCommitSha,
    selectedInstallationId,
    selectedRepository,
    visibleWebLlmModels.length,
  ]);
  const currentStep = commitCreated ? "Commit draft 作成済み" : testsRun ? "PR 作成待ち" : patchApplied ? "Tests 実行待ち" : "変更中";
  const safetyStatus = testsRun
    ? commitCreated
      ? "Commit draft 作成済み"
      : "Tests 通過"
    : patchApplied
      ? "Patch 適用済み / Tests 未実行"
      : "Patch review が必要";
  const previewCommand = runtimePlan.devCommand ?? runtimePlan.previewCommand;
  const previewAvailable = Boolean(previewCommand);
  const currentPrDraftMarkdown = useMemo(
    () =>
      createPrDraftMarkdown({
        assistedMemory,
        branchGoalMarkdown,
        branchName,
        changedFiles: gitStatus.entries,
        closeIssueNumber: normalizeIssueNumber(closeIssueNumber),
        contextBudget,
        contextPriority: taskPriority,
        previewChecked: previewRunState === "ready",
        runtimeLabel: selectedRuntimeLabel,
        safetyReady: safetyGate.canCreatePullRequest,
        selectedFile,
        testsPassed: testsRun,
        title: extractMarkdownTitle(branchGoalMarkdown) || "Git AI IDE PR",
        warnings: runtimePlan.warnings,
      }),
    [
      assistedMemory,
      branchGoalMarkdown,
      branchName,
      closeIssueNumber,
      contextBudget,
      gitStatus.entries,
      previewRunState,
      runtimePlan.warnings,
      safetyGate.canCreatePullRequest,
      selectedRuntimeLabel,
      selectedFile,
      taskPriority,
      testsRun,
    ],
  );

  const resetPatchQueue = () => {
    setPatchQueue(testFixtureEnabled ? [{ proposal: demoPatch, source: "fixture" }] : []);
    setActivePatchId(testFixtureEnabled ? demoPatch.id : emptyPatchProposal.id);
  };

  const queuePatchProposal = (proposal: PatchProposal, source: PatchQueueSource, failureReason?: string) => {
    setPatchQueue((currentQueue) => [
      { failureReason, proposal, source },
      ...currentQueue.filter((item) => item.proposal.id !== proposal.id),
    ]);
    setActivePatchId(proposal.id);
  };

  const updateActivePatchQueueItem = (updates: Partial<PatchQueueItem> & { proposal?: PatchProposal }) => {
    setPatchQueue((currentQueue) =>
      currentQueue.map((item) => (item.proposal.id === activePatch.id ? { ...item, ...updates } : item)),
    );
  };

  const openDiffPreview = () => {
    if (!patchTargetAvailable) {
      setSidePanelMode("git");
      setExplorerVisible(true);
      setWorkspaceError("このデモ patch の対象ファイルは、現在の workspace にはありません。");
      return;
    }

    if (activePatchRejected) {
      setWorkspaceError("Reject 済みの patch proposal は Diff review できません。別の proposal を選択してください。");
      return;
    }

    openFile(primaryEdit.file);
    setDiffFile(primaryEdit.file);
    setDiffMode("patch");
    setDiffOpen(true);
  };

  const generateAiPatchProposal = async () => {
    setPatchGenerationState("running");
    const result = await requestPatchProposal({
      allowedFiles: [selectedFile],
      branchGoalMarkdown,
      currentFile: {
        content: currentFile,
        path: selectedFile,
      },
      context: contextPack,
      modelId: aiRuntimeMode === "webllm" ? selectedWebLlmModelId : selectedRuntimeHealth?.modelIds[0],
      mode: aiRuntimeMode,
    });

    if (!result.ok) {
      setPatchGenerationMessage(`${result.error}${result.warnings.length ? ` ${result.warnings.join(" / ")}` : ""}`);
      setPatchGenerationState("idle");
      return;
    }

    queuePatchProposal(result.proposal, "ai", result.warnings.length ? result.warnings.join(" / ") : undefined);
    setPatchApplied(false);
    setTestsRun(false);
    setRuntimeLog(fixtureTestLogIdle);
    setPrDraftGenerated(false);
    setCommitCreated(false);
    setBranchPushed(false);
    setPushedCommitSha("");
    setCreatedPrUrl("");
    setDiffMode("patch");
    setDiffFile(result.proposal.edits[0]?.file ?? selectedFile);
    setDiffOpen(false);
    setPatchGenerationMessage(
      `${runtimeLabels[result.mode]} で patch proposal を queue に追加しました。${result.warnings.length ? ` ${result.warnings.join(" / ")}` : ""}`,
    );
    setPatchGenerationState("idle");
  };

  const runWebLlmDiagnostic = async () => {
    setWebLlmDiagnosticState("running");
    setWebLlmDiagnosticLog("WebLLM 実モデルロード診断を実行中...");

    const result = await runWebLlmSmokeTest({ modelId: selectedWebLlmModelId });
    setWebLlmDiagnosticLog(result.log);
    setFailedWebLlmModelIds((current) => {
      const next = new Set(current);
      if (result.mode === "webllm") {
        next.delete(result.modelId);
      } else if (webLlmDeviceProfile.webGpuAvailable) {
        next.add(result.modelId);
      }
      saveFailedWebLlmModelIds(next);
      return next;
    });
    setAiRuntimeMode("webllm");
    setWebLlmDiagnosticState("idle");
  };

  const openChangedFileDiff = (file: string) => {
    setDiffFile(file);
    setDiffMode("file");
    if (file in files) {
      openFile(file);
    }
    setDiffOpen(true);
  };

  const openFile = (file: FileName) => {
    if (!file) return;
    setSelectedFile(file);
    setEditorView("file");
    setOpenFiles((currentFiles) => (currentFiles.includes(file) ? currentFiles : [...currentFiles, file]));
  };

  const openFileAtLine = (file: FileName, line: number) => {
    openFile(file);
    setEditorTarget({ file, line });
    setDiffOpen(false);
  };

  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor;
    if (editorTarget?.file === selectedFile && !diffOpen) {
      revealEditorLine(editor, editorTarget.line);
    }
  };

  const closeFileTab = (file: FileName) => {
    setOpenFiles((currentFiles) => {
      if (currentFiles.length <= 1) return currentFiles;
      const fileIndex = currentFiles.indexOf(file);
      const nextFiles = currentFiles.filter((currentFileName) => currentFileName !== file);

      if (file === selectedFile) {
        const fallbackFile = nextFiles[Math.max(0, fileIndex - 1)] ?? nextFiles[0];
        if (fallbackFile) {
          setSelectedFile(fallbackFile);
          setDiffOpen(false);
        }
      }

      return nextFiles;
    });
  };

  const resetWorkflowAfterFileOperation = () => {
    setTestsRun(false);
    setRuntimeLog(fixtureTestLogIdle);
    setPreviewRunState("idle");
    setPreviewUrl("");
    setPrDraftGenerated(false);
    setCommitCreated(false);
    setBranchPushed(false);
    setPushedCommitSha("");
    setCreatedPrUrl("");
    setPatchApplied(false);
  };

  const createWorkspaceFile = () => {
    const nextPath = normalizeWorkspacePath(newFilePath);

    if (!nextPath) {
      setFileOperationMessage("作成するファイルパスを入力してください。");
      return;
    }

    if (files[nextPath] !== undefined) {
      setFileOperationMessage(`${nextPath} はすでに存在します。`);
      return;
    }

    const content = createInitialFileContent(nextPath);
    setFiles((currentFiles) => ({
      ...currentFiles,
      [nextPath]: content,
    }));
    setSavedFiles((currentFiles) => ({
      ...currentFiles,
      [nextPath]: content,
    }));
    openFile(nextPath);
    setDiffFile(nextPath);
    setNewFilePath(suggestSiblingFilePath(nextPath));
    setFileOperationMessage(`${nextPath} を作成しました。`);
    resetWorkflowAfterFileOperation();
  };

  const createWorkspaceFolder = () => {
    const nextFolder = normalizeWorkspacePath(newFolderPath).replace(/\/+$/, "");

    if (!nextFolder) {
      setFileOperationMessage("作成するフォルダパスを入力してください。");
      return;
    }

    const placeholderFile = `${nextFolder}/.gitkeep`;

    if (files[placeholderFile] !== undefined || fileNames.some((file) => file.startsWith(`${nextFolder}/`))) {
      setFileOperationMessage(`${nextFolder} はすでに存在します。`);
      return;
    }

    setFiles((currentFiles) => ({
      ...currentFiles,
      [placeholderFile]: "",
    }));
    setSavedFiles((currentFiles) => ({
      ...currentFiles,
      [placeholderFile]: "",
    }));
    setExpandedFolders((current) => {
      const next = new Set(current);
      const parts = nextFolder.split("/");
      let path = "";
      for (const part of parts) {
        path = path ? `${path}/${part}` : part;
        next.add(path);
      }
      return next;
    });
    openFile(placeholderFile);
    setDiffFile(placeholderFile);
    setNewFolderPath(suggestSiblingFolderPath(nextFolder));
    setFileOperationMessage(`${nextFolder} を作成しました。`);
    resetWorkflowAfterFileOperation();
  };

  const renameWorkspaceFile = () => {
    const nextPath = normalizeWorkspacePath(renameFilePath);

    if (!selectedFile || files[selectedFile] === undefined) {
      setFileOperationMessage("改名するファイルを Explorer で選択してください。");
      return;
    }

    if (!nextPath) {
      setFileOperationMessage("新しいファイルパスを入力してください。");
      return;
    }

    if (nextPath === selectedFile) {
      setFileOperationMessage("現在と同じファイルパスです。");
      return;
    }

    if (files[nextPath] !== undefined) {
      setFileOperationMessage(`${nextPath} はすでに存在します。`);
      return;
    }

    setFiles((currentFiles) => {
      const { [selectedFile]: currentContent, ...rest } = currentFiles;
      return {
        ...rest,
        [nextPath]: currentContent ?? "",
      };
    });
    setSavedFiles((currentFiles) => {
      const { [selectedFile]: currentContent, ...rest } = currentFiles;
      return {
        ...rest,
        [nextPath]: currentContent ?? files[selectedFile] ?? "",
      };
    });
    setOpenFiles((currentFiles) => currentFiles.map((file) => (file === selectedFile ? nextPath : file)));
    setSelectedFile(nextPath);
    setDiffFile(nextPath);
    setFileOperationMessage(`${selectedFile} を ${nextPath} に改名しました。`);
    resetWorkflowAfterFileOperation();
  };

  const deleteWorkspaceFile = () => {
    if (!selectedFile || files[selectedFile] === undefined) {
      setFileOperationMessage("削除するファイルを Explorer で選択してください。");
      return;
    }

    if (Object.keys(files).length <= 1) {
      setFileOperationMessage("最後の 1 ファイルは削除できません。");
      return;
    }

    const deletedFile = selectedFile;
    const nextFiles = Object.keys(files)
      .filter((file) => file !== deletedFile)
      .sort();
    const fallbackFile = nextFiles[0] ?? "";

    setFiles((currentFiles) => {
      const { [deletedFile]: _deletedContent, ...rest } = currentFiles;
      return rest;
    });
    setSavedFiles((currentFiles) => {
      const { [deletedFile]: _deletedContent, ...rest } = currentFiles;
      return rest;
    });
    setOpenFiles((currentFiles) => {
      const remainingOpenFiles = currentFiles.filter((file) => file !== deletedFile);
      return remainingOpenFiles.length > 0 ? remainingOpenFiles : [fallbackFile];
    });
    setSelectedFile(fallbackFile);
    setDiffFile(deletedFile);
    setDiffMode("file");
    setDiffOpen(true);
    setFileOperationMessage(`${deletedFile} を削除しました。`);
    resetWorkflowAfterFileOperation();
  };

  const saveCurrentFile = () => {
    if (!selectedFile || files[selectedFile] === undefined) {
      setFileOperationMessage("保存するファイルを Explorer で選択してください。");
      return;
    }

    setSavedFiles((currentFiles) => ({
      ...currentFiles,
      [selectedFile]: files[selectedFile],
    }));
    setLastSavedAt(new Date().toISOString());
    setFileOperationMessage(`${selectedFile} を保存しました。`);
  };

  const saveAllFiles = () => {
    setSavedFiles(files);
    setLastSavedAt(new Date().toISOString());
    setFileOperationMessage(`${dirtyFiles.size} 件の未保存変更を保存しました。`);
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
    if (!preview.ok) {
      updateActivePatchQueueItem({
        failureReason: preview.error,
        proposal: { ...activePatch, status: "needs_attention" },
      });
      setPatchGenerationMessage(`Patch apply failed: ${preview.error}`);
      setBottomPanelMode("problems");
      setBottomPanelCollapsed(false);
      return;
    }
    setFiles(preview.files);
    updateActivePatchQueueItem({
      failureReason: undefined,
      proposal: { ...activePatch, status: "applied" },
    });
    setPatchApplied(true);
    setTestsRun(false);
    setRuntimeLog(fixtureTestLogIdle);
    setPrDraftGenerated(false);
    setCommitCreated(false);
    setBranchPushed(false);
    setCreatedPrUrl("");
    setDiffOpen(false);
  };

  const rejectActivePatch = () => {
    updateActivePatchQueueItem({
      failureReason: "この patch proposal は reject 済みです。",
      proposal: { ...activePatch, status: "rejected" },
    });
    setPatchApplied(false);
    setDiffOpen(false);
    setPatchGenerationMessage(`${activePatch.title} を reject しました。`);
  };

  const selectGitHubInstallation = async (installationId: number) => {
    setSelectedInstallationId(installationId);
    setIsLoadingGitHubRepositories(true);
    setGithubStatusMessage("Repository を読み込み中");

    try {
      const repositories = await loadGitHubRepositories(installationId);
      applyGitHubRepositories(repositories);
      const installation = githubInstallations.find((item) => item.id === installationId);
      setSelectedInstallationId(installationId);
      setGithubSetupState(repositories.length > 0 ? "ready" : "repository-missing");
      setGithubStatusMessage(`GitHub App configured / ${installation?.accountLogin ?? installationId}`);
    } catch (error) {
      setGithubRepositories([]);
      setGithubSetupState("repository-missing");
      setGithubStatusMessage(error instanceof Error ? error.message : "GitHub repositories を取得できませんでした。");
    } finally {
      setIsLoadingGitHubRepositories(false);
    }
  };

  const refreshRemoteGit = async (input?: { branch?: string; repository?: GitHubRepositoryOption }) => {
    const repository = input?.repository ?? selectedRepositoryOption;
    const branch = input?.branch ?? branchName;

    if (!repository?.installationId) {
      setGithubBranches([]);
      setGithubCommits([]);
      return;
    }

    setIsLoadingRemoteGit(true);
    try {
      const [branches, commits] = await Promise.all([
        loadGitHubBranches({
          defaultBranch: repository.defaultBranch,
          installationId: repository.installationId,
          repository: repository.fullName,
        }),
        loadGitHubCommits({
          branch,
          defaultBranch: repository.defaultBranch,
          installationId: repository.installationId,
          repository: repository.fullName,
        }),
      ]);
      setGithubBranches(branches);
      setGithubCommits(commits);
      setGithubStatusMessage(`Remote git loaded: ${repository.fullName}`);
    } catch (error) {
      setGithubBranches([]);
      setGithubCommits([]);
      setGithubStatusMessage(error instanceof Error ? error.message : "GitHub branch / commit を取得できませんでした。");
    } finally {
      setIsLoadingRemoteGit(false);
    }
  };

  const createRemoteBranch = async () => {
    if (!selectedRepositoryOption?.installationId || !branchName.trim()) return;

    setIsCreatingBranch(true);
    try {
      const branch = await createGitHubBranch({
        baseBranch: mergeTargetBranch || selectedRepositoryOption.defaultBranch,
        branch: branchName.trim(),
        installationId: selectedRepositoryOption.installationId,
        repository: selectedRepositoryOption.fullName,
      });
      setGithubBranches((current) => [branch, ...current.filter((item) => item.name !== branch.name)]);
      setGithubStatusMessage(`Branch created: ${branch.name}`);
      await refreshRemoteGit({ branch: branch.name, repository: selectedRepositoryOption });
    } catch (error) {
      setGithubStatusMessage(error instanceof Error ? error.message : "GitHub branch を作成できませんでした。");
    } finally {
      setIsCreatingBranch(false);
    }
  };

  useEffect(() => {
    if (!realGitHubMode) {
      setGithubBranches([]);
      setGithubCommits([]);
      return;
    }

    void refreshRemoteGit();
  }, [branchName, realGitHubMode, selectedInstallationId, selectedRepository]);

  const runWorkspaceChecks = async () => {
    if (!patchApplied) return;

    setRuntimeRunState("running");
    setBottomPanelMode("terminal");
    setBottomPanelCollapsed(false);
    setRuntimeLog("Git AI IDE Runtime\nchecks を実行中...");

    const result = await runRuntimeChecks(files, runtimePlan);
    setRuntimeLog(result.log);
    setTestsRun(result.ok);
    setRuntimeRunState("idle");
  };

  const runLocalPreview = async () => {
    setPreviewRunState("running");
    setPreviewTabOpen(true);
    setEditorView("preview");
    setDiffOpen(false);
    setPreviewUrl("");
    setPreviewMode("candidate");
    setPreviewLog("Git AI IDE Local Preview\npreview を起動中...");

    const result = await startLocalPreview(files, runtimePlan, {
      forceManual: false,
    });
    setPreviewLog(result.log);
    setPreviewMode(result.mode);
    setPreviewUrl(result.url ?? "");
    if (result.url) setPreviewAddress(result.url);
    setPreviewRunState(result.ok ? "ready" : "idle");
  };

  const openPreviewAddress = () => {
    const trimmed = previewAddress.trim();
    if (!trimmed) return;
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;

    setPreviewAddress(normalized);
    setPreviewUrl(normalized);
    setPreviewRunState("ready");
    setPreviewTabOpen(true);
    setEditorView("preview");
    setDiffOpen(false);
  };

  const pushBranch = async () => {
    if (!realGitHubMode) {
      setGithubStatusMessage("GitHub App と selected repository を接続すると push できます。");
      setBottomPanelMode("problems");
      setBottomPanelCollapsed(false);
      return;
    }

    if (!commitCreated) {
      setBottomPanelMode("problems");
      setBottomPanelCollapsed(false);
      return;
    }

    setIsPushingBranch(true);

    try {
      const result = await pushGitHubFiles({
        baseBranch: "main",
        branch: branchName,
        changes: gitStatus.entries.map((entry) => {
          const status = entry.status as "added" | "deleted" | "modified";

          return {
            content: status === "deleted" ? undefined : files[entry.file],
            path: entry.file,
            status,
          };
        }),
        commitMessage,
        installationId: selectedInstallationId,
        repository: selectedRepository,
      });
      setBranchPushed(true);
      setPushedCommitSha(result.commit.sha ?? "");
      setBaselineFiles(files);
      setSavedFiles(files);
      setGithubStatusMessage(result.mode === "github" ? "Branch pushed to GitHub" : "Branch push did not run against GitHub");
      setBottomPanelMode("output");
      setBottomPanelCollapsed(false);
    } catch (error) {
      setBranchPushed(false);
      setGithubStatusMessage(error instanceof Error ? `Push failed: ${error.message}` : "Push failed");
      setBottomPanelMode("problems");
      setBottomPanelCollapsed(false);
    } finally {
      setIsPushingBranch(false);
    }
  };

  const openLocalWorkspace = async () => {
    setIsOpeningWorkspace(true);
    setWorkspaceError(null);

    try {
      const snapshot = await openLocalDirectorySnapshot();
      setFiles(snapshot.files);
      setBaselineFiles(snapshot.files);
      setSavedFiles(snapshot.files);
      setWorkspaceName(snapshot.name);
      setWorkspaceSource(snapshot.source);
      const preferredFile = selectPreferredFile(snapshot.files);
      openFile(preferredFile);
      setOpenFiles([preferredFile]);
      setDiffFile(preferredFile);
      setDiffOpen(false);
      setPatchApplied(false);
      resetPatchQueue();
      setPatchGenerationMessage("WebLLM を使って patch proposal を生成してください。");
      setTestsRun(false);
      setRuntimeLog(fixtureTestLogIdle);
      setPreviewRunState("idle");
      setPreviewLog("Local Preview はまだ起動していません。");
      setPreviewMode("candidate");
      setPreviewUrl("");
      setPrDraftGenerated(false);
      setCommitMessage("");
      setCommitCreated(false);
      setBranchPushed(false);
      setPushedCommitSha("");
      setCreatedPrUrl("");
      setWorkspaceRestored(false);
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "repo を開けませんでした。");
    } finally {
      setIsOpeningWorkspace(false);
    }
  };

  const updateCurrentFile = (value?: string) => {
    setFiles((currentFiles) => ({
      ...currentFiles,
      [selectedFile]: value ?? "",
    }));
    setTestsRun(false);
    setRuntimeLog(fixtureTestLogIdle);
    setPrDraftGenerated(false);
    setCommitCreated(false);
    setBranchPushed(false);
    setPushedCommitSha("");
    setCreatedPrUrl("");
  };

  const generatePrDraft = () => {
    if (!testsRun) {
      setBottomPanelMode("problems");
      return;
    }

    setPrDraftMarkdown(currentPrDraftMarkdown);
    setPrDraftGenerated(true);
    setPrDraftMode("preview");
    setBottomPanelMode("output");
    setBottomPanelCollapsed(false);
  };

  const saveProjectMemory = () => {
    const record = saveAssistedMemory(assistedMemoryProjectKey, assistedMemory);
    setMemorySavedAt(record.savedAt);
    setMemoryStatusMessage("Project memory を保存しました。");
  };

  const restoreProjectMemory = () => {
    const record = loadAssistedMemory(assistedMemoryProjectKey);
    if (!record) {
      setMemorySavedAt("");
      setMemoryStatusMessage("保存済みの Project memory はありません。");
      return;
    }

    setAssistedMemory(record.memory);
    setMemorySavedAt(record.savedAt);
    setMemoryStatusMessage("Project memory を復元しました。");
  };

  const clearProjectMemory = () => {
    clearAssistedMemory(assistedMemoryProjectKey);
    setMemorySavedAt("");
    setMemoryStatusMessage("Project memory を削除しました。");
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
    setPushedCommitSha("");
    setCreatedPrUrl("");
    setBottomPanelMode("output");
    setBottomPanelCollapsed(false);
  };

  const createPullRequest = async () => {
    if (!realGitHubMode) {
      setGithubStatusMessage("GitHub App と selected repository を接続すると PR を作成できます。");
      setBottomPanelMode("problems");
      setBottomPanelCollapsed(false);
      return;
    }

    if (!safetyGate.canCreatePullRequest || !branchPushed) {
      setBottomPanelMode("problems");
      setBottomPanelCollapsed(false);
      return;
    }

    setIsCreatingPr(true);

    try {
      const pullRequestBody = ensureCloseKeyword(prDraftMarkdown || currentPrDraftMarkdown, closeIssueNumber);
      const result = await createGitHubPullRequest({
        baseBranch: "main",
        body: pullRequestBody,
        branch: branchName,
        installationId: selectedInstallationId,
        repository: selectedRepository,
        title: extractMarkdownTitle(branchGoalMarkdown) || "Git AI IDE PR",
      });
      setCreatedPrUrl(result.pullRequest.url);
      setGithubStatusMessage(
        result.warning ?? (result.mode === "github" ? `GitHub PR created: #${result.pullRequest.number}` : "PR creation did not run against GitHub"),
      );
      setBottomPanelMode("output");
      setBottomPanelCollapsed(false);
    } catch (error) {
      setCreatedPrUrl("");
      setGithubStatusMessage(error instanceof Error ? `PR creation failed: ${error.message}` : "PR creation failed");
      setBottomPanelMode("problems");
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
          <span>{extractMarkdownTitle(branchGoalMarkdown) || "Branch Goal"}</span>
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
                    </div>
                    <div className="file-operation-panel">
                      <label>
                        <span>New file</span>
                        <input value={newFilePath} onChange={(event) => setNewFilePath(event.target.value)} />
                      </label>
                      <button className="icon-action" title="ファイルを作成" onClick={createWorkspaceFile}>
                        <FilePlus2 size={15} />
                        <span>作成</span>
                      </button>
                      <label>
                        <span>New folder</span>
                        <input value={newFolderPath} onChange={(event) => setNewFolderPath(event.target.value)} />
                      </label>
                      <button className="icon-action" title="フォルダを作成" onClick={createWorkspaceFolder}>
                        <FolderPlus size={15} />
                        <span>作成</span>
                      </button>
                      <label>
                        <span>Rename selected</span>
                        <input value={renameFilePath} onChange={(event) => setRenameFilePath(event.target.value)} />
                      </label>
                      <div className="file-operation-actions">
                        <button className="icon-action" disabled={!selectedFile} title="選択中ファイルを改名" onClick={renameWorkspaceFile}>
                          <Pencil size={15} />
                          <span>改名</span>
                        </button>
                        <button className="icon-action danger" disabled={!selectedFile} title="選択中ファイルを削除" onClick={deleteWorkspaceFile}>
                          <Trash2 size={15} />
                          <span>削除</span>
                        </button>
                      </div>
                      <small>{fileOperationMessage}</small>
                    </div>
                    {workspaceError ? <div className="workspace-error">{workspaceError}</div> : null}
                    <nav className="file-list">
                      <ExplorerTree
                        dirtyFiles={dirtyFiles}
                        expandedFolders={expandedFolders}
                        nodes={explorerTree}
                        onSelectFile={(file) => {
                          openFile(file);
                          setDiffOpen(false);
                        }}
                        onToggleFolder={(folder) => {
                          setExpandedFolders((current) => {
                            const next = new Set(current);
                            if (next.has(folder)) {
                              next.delete(folder);
                            } else {
                              next.add(folder);
                            }
                            return next;
                          });
                        }}
                        selectedFile={selectedFile}
                      />
                    </nav>
                  </section>

                  <section className="explorer-section">
                    <PanelTitle title="Repo Map" />
                    <div className="repo-map">
                      <span>{workspaceName} / {fileNames.length} files</span>
                      <span>capability: {runtimePlan.capability}</span>
                      <span>test: {runtimePlan.testCommand ?? "not detected"}</span>
                      <span>typecheck: {runtimePlan.typecheckCommand ?? "not detected"}</span>
                    </div>
                  </section>
                </>
              ) : null}

              {sidePanelMode === "search" ? (
                <section className="explorer-section">
                  <PanelTitle title="Search" />
                  <label className="search-box">
                    <Search size={15} />
                    <input
                      placeholder="ファイル名やコードを検索"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                    />
                  </label>
                  {searchQuery.trim() ? (
                    searchResults.length > 0 ? (
                      <div className="search-results" aria-label="検索結果">
                        {searchResults.map((result) => (
                          <button
                            className={result.file === selectedFile ? "search-result active" : "search-result"}
                            key={`${result.file}:${result.matchType}:${result.line}:${result.preview}`}
                            onClick={() => {
                              openFileAtLine(result.file, result.line);
                            }}
                          >
                            <span className="search-result-heading">
                              <strong>{basename(result.file)}</strong>
                              <small>{result.matchType === "filename" ? "file name" : `L${result.line}`}</small>
                            </span>
                            <span className="search-result-path">{result.file}</span>
                            <span className="search-result-preview">{result.preview}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="empty-state">
                        <strong>一致する結果はありません</strong>
                        <p>検索語を短くするか、別のファイル名・関数名で探してください。</p>
                      </div>
                    )
                  ) : (
                    <div className="empty-state">
                      <strong>workspace を横断検索できます</strong>
                      <p>ファイル名、関数名、コメント、Markdown の本文を検索して editor に開けます。</p>
                    </div>
                  )}
                </section>
              ) : null}

              {sidePanelMode === "git" ? (
                <section className="explorer-section">
                  <PanelTitle title="Source Control" />
                  <div className={realGitHubMode ? "source-mode source-mode-real" : "source-mode source-mode-setup"}>
                    <strong>{sourceControlModeLabel}</strong>
                    <span>{sourceControlModeDetail}</span>
                  </div>
                  <div className="git-summary">
                    <span><GitBranch size={14} /> {gitStatus.branch}</span>
                    <strong>{sourceControlSummary}</strong>
                    <small>baseline: {gitStatus.baseBranch}</small>
                  </div>
                  <label className="branch-input">
                    <span>Branch</span>
                    <input value={branchName} onChange={(event) => setBranchName(event.target.value)} />
                  </label>
                  <div className="branch-actions">
                    <button className="button secondary" disabled={!realGitHubMode || isLoadingRemoteGit} onClick={() => void refreshRemoteGit()}>
                      {isLoadingRemoteGit ? "Loading" : "Remote 更新"}
                    </button>
                    <button className="button secondary" disabled={!realGitHubMode || !branchName.trim() || isCreatingBranch} onClick={createRemoteBranch}>
                      {isCreatingBranch ? "作成中" : "Branch 作成"}
                    </button>
                  </div>
                  <div className="branch-goal-card">
                    <span>Branch Goal</span>
                    <strong>{extractMarkdownTitle(branchGoalMarkdown) || "Branch Goal"}</strong>
                  </div>
                  <PanelTitle title="Branches" />
                  <div className="branch-list">
                    {branchSummaries.map((branch) => (
                      <button
                        className={branch.status === "current" ? "branch-row active" : "branch-row"}
                        key={`${branch.role}:${branch.name}`}
                        onClick={() => {
                          setBranchName(branch.name);
                          setBranchPushed(false);
                          setCreatedPrUrl("");
                        }}
                      >
                        <span>
                          <GitBranch size={14} />
                          <strong>{branch.name}</strong>
                        </span>
                        <small>{branch.label}</small>
                        <em>ahead {branch.ahead} / behind {branch.behind}</em>
                      </button>
                    ))}
                  </div>
                  <PanelTitle title="Merge readiness" />
                  <div className="merge-panel">
                    <label className="branch-input compact">
                      <span>Target</span>
                      <input value={mergeTargetBranch} onChange={(event) => setMergeTargetBranch(event.target.value)} />
                    </label>
                    {testFixtureEnabled ? (
                      <button className="icon-action" onClick={() => setConflictFixtureEnabled((enabled) => !enabled)}>
                        <Merge size={15} />
                        <span>{conflictFixtureEnabled ? "fixture 競合解除" : "fixture 競合"}</span>
                      </button>
                    ) : null}
                    <ul className="readiness-list">
                      {mergeReadiness.map((item) => (
                        <li className={`readiness-${item.status}`} key={item.id}>
                          {item.status === "pass" ? <CheckCircle2 size={14} /> : item.status === "blocked" ? <TriangleAlert size={14} /> : <Circle size={14} />}
                          <span>
                            <strong>{item.label}</strong>
                            {item.detail}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {conflictFixtureEnabled ? (
                      <div className="conflict-box">
                        <strong>Conflict handling</strong>
                        <span>src/features/pr-summary/generateSummary.ts の summary format 変更が main 側と競合する想定です。</span>
                        <span>推奨: branch goal に合う出力契約を残し、PR description に解消理由を書きます。</span>
                      </div>
                    ) : null}
                  </div>
                  <PanelTitle title="History" />
                  <div className="history-list">
                    {commitHistory.map((commit) => (
                      <button className="history-item" key={`${commit.sha}:${commit.message}`}>
                        <History size={14} />
                        <span>
                          <strong>{commit.message}</strong>
                          <small>{commit.sha} / {commit.branch} / {commit.author}</small>
                        </span>
                        <em>{commit.time}</em>
                      </button>
                    ))}
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
                    {!patchApplied && !activePatchRejected ? (
                      <button className="change-item proposed" onClick={openDiffPreview}>
                        <span>{primaryEdit.file}</span>
                        <strong>{patchTargetAvailable ? "proposed patch" : "not in workspace"}</strong>
                      </button>
                    ) : null}
                  </div>
                  <div className="git-actions">
                    <button className="button secondary" disabled={!canReviewPatch} onClick={openDiffPreview}>Diff を確認</button>
                    <button className="button" disabled={!canApplyPatch} onClick={applyPatch}>
                      Patch を適用
                    </button>
                    <button className="button secondary" disabled={!gitStatus.hasChanges} onClick={createCommitDraft}>
                      Commit draft
                    </button>
                    <button className="button secondary" disabled={!realGitHubMode || !commitCreated || branchPushed || isPushingBranch} onClick={pushBranch}>
                      {isPushingBranch ? "Pushing" : "Push"}
                    </button>
                    <button className="button" disabled={!realGitHubMode || !safetyGate.canCreatePullRequest || !branchPushed || Boolean(createdPrUrl) || isCreatingPr} onClick={createPullRequest}>
                      {isCreatingPr ? "作成中" : "PR 作成"}
                    </button>
                  </div>
                  <div className="github-box">
                    <div className="github-box-heading">
                      <strong>GitHub Integration</strong>
                      <span className={realGitHubMode ? "mode-chip real" : "mode-chip setup"}>{githubOperationLabel}</span>
                    </div>
                    {!realGitHubMode ? (
                      <div className="setup-warning">
                        <strong>実 GitHub repository に接続してください</strong>
                        <span>GitHub App を selected repository に install すると、branch 作成、push、PR 作成をこの UI から実行できます。</span>
                      </div>
                    ) : null}
                    <div className="setup-checklist">
                      <strong>実操作モード setup</strong>
                      <ul className="github-readiness">
                        {githubSetupChecklist.map((item) => (
                          <li className={`github-readiness-${item.status}`} key={item.id}>
                            {item.status === "pass" ? <CheckCircle2 size={14} /> : item.status === "blocked" ? <TriangleAlert size={14} /> : <Circle size={14} />}
                            <span>
                              <strong>{item.label}</strong>
                              {item.detail}
                            </span>
                          </li>
                        ))}
                      </ul>
                      {githubInstallUrl ? (
                        <a href={githubInstallUrl} rel="noreferrer" target="_blank">
                          GitHub App install
                        </a>
                      ) : (
                        <span>setup docs: docs/github-app-setup.md</span>
                      )}
                    </div>
                    {githubConfigured ? (
                      <label className="repo-select">
                        <span>Installation</span>
                        <select
                          disabled={githubInstallations.length === 0 || isLoadingGitHubRepositories}
                          value={selectedInstallationId ?? ""}
                          onChange={(event) => {
                            void selectGitHubInstallation(Number(event.target.value));
                          }}
                        >
                          {githubInstallations.map((installation) => (
                            <option key={installation.id} value={installation.id}>
                              {installation.accountLogin}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    <label className="repo-select">
                      <span>Selected repository</span>
                      <select
                        disabled={!realGitHubMode || githubRepositories.length === 0 || isLoadingGitHubRepositories}
                        value={selectedRepository}
                        onChange={(event) => {
                          const repository = githubRepositories.find((item) => item.fullName === event.target.value);
                          setSelectedRepository(event.target.value);
                          setSelectedInstallationId(repository?.installationId);
                          if (repository?.defaultBranch) setBranchName(repository.defaultBranch);
                          setBranchPushed(false);
                          setCreatedPrUrl("");
                        }}
                      >
                        {githubRepositories.map((repository) => (
                          <option key={repository.fullName} value={repository.fullName}>
                            {repository.fullName}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="repo-select">
                      <span>Close issue</span>
                      <input
                        inputMode="numeric"
                        placeholder="例: 72"
                        value={closeIssueNumber}
                        onChange={(event) => setCloseIssueNumber(event.target.value)}
                      />
                    </label>
                    <span>{realGitHubMode ? "GitHub App configured / selected repo mode" : "GitHub setup required"}</span>
                    {isLoadingGitHubRepositories ? <span>Repository を読み込み中</span> : null}
                    <span>{githubStatusMessage}</span>
                    <span>{branchPushed ? "branch pushed" : realGitHubMode ? "push pending" : "connect GitHub to push"}</span>
                    {pushedCommitSha ? <span>commit: {pushedCommitSha.slice(0, 12)}</span> : null}
                    {createdPrUrl ? <a href={createdPrUrl}>{createdPrUrl}</a> : null}
                    <ul className="github-readiness">
                      {pullRequestFlow.items.map((item) => (
                        <li className={`github-readiness-${item.status}`} key={item.id}>
                          {item.status === "pass" ? <CheckCircle2 size={14} /> : item.status === "blocked" ? <TriangleAlert size={14} /> : <Circle size={14} />}
                          <span>
                            <strong>{item.label}</strong>
                            {item.detail}
                          </span>
                        </li>
                      ))}
                    </ul>
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
            {diffOpen ? (
              <button className="tab active">
                Diff: {activeDiffFile}
                <X size={13} onClick={() => setDiffOpen(false)} />
              </button>
            ) : null}
            {openFiles.map((file) => (
              <button
                className={!diffOpen && editorView === "file" && file === selectedFile ? "tab active" : "tab"}
                key={file}
                onClick={() => {
                  setSelectedFile(file);
                  setDiffOpen(false);
                  setEditorView("file");
                }}
              >
                <span>{basename(file)}{dirtyFiles.has(file) ? " *" : ""}</span>
                <X
                  size={13}
                  onClick={(event) => {
                    event.stopPropagation();
                    closeFileTab(file);
                  }}
                />
              </button>
            ))}
            {previewTabOpen ? (
              <button
                className={!diffOpen && editorView === "preview" ? "tab active preview-tab" : "tab preview-tab"}
                onClick={() => {
                  setDiffOpen(false);
                  setEditorView("preview");
                }}
              >
                <span>Preview</span>
                <X
                  size={13}
                  onClick={(event) => {
                    event.stopPropagation();
                    setPreviewTabOpen(false);
                    setEditorView("file");
                  }}
                />
              </button>
            ) : null}
            <div className="editor-tab-actions">
              <span>{selectedFileDirty ? "未保存" : "保存済み"}</span>
              {lastSavedAt ? <span>{formatDateTime(lastSavedAt)}</span> : null}
              <button className="icon-action compact" disabled={!selectedFileDirty} onClick={saveCurrentFile}>
                <Save size={14} />
                <span>保存</span>
              </button>
              <button className="icon-action compact" disabled={dirtyFiles.size === 0} onClick={saveAllFiles}>
                <Save size={14} />
                <span>すべて保存</span>
              </button>
            </div>
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
                      <button className="button" disabled={!canApplyPatch} onClick={applyPatch}>
                        確認して適用
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : editorView === "preview" && previewTabOpen ? (
              <div className="editor-preview-card">
                <LocalPreviewPanel
                  onOpenPreviewAddress={openPreviewAddress}
                  previewAvailable={previewAvailable}
                  previewAddress={previewAddress}
                  previewCommand={previewCommand}
                  previewLog={previewLog}
                  previewMode={previewMode}
                  previewPreflight={previewPreflight}
                  previewRunState={previewRunState}
                  previewUrl={previewUrl}
                  setPreviewAddress={setPreviewAddress}
                  workspaceName={workspaceName}
                />
              </div>
            ) : selectedFile ? (
              <div className="editor-card">
                <Editor
                  className="lf-monaco-editor"
                  height="100%"
                  key={selectedFile}
                  language={languageForFile(selectedFile)}
                  onChange={updateCurrentFile}
                  onMount={handleEditorMount}
                  options={monacoEditorOptions}
                  path={selectedFile}
                  theme="vs-dark"
                  value={currentFile}
                />
              </div>
            ) : (
              <div className="workspace-empty-state">
                <strong>Repository を開いてください</strong>
                <p>GitHub App で selected repository を接続するか、ローカルフォルダを開くと file tree と editor が表示されます。</p>
                <div>
                  <button
                    className="button"
                    disabled={!supportsLocalDirectoryAccess() || isOpeningWorkspace}
                    onClick={openLocalWorkspace}
                  >
                    {isOpeningWorkspace ? "読み込み中" : "ローカル repo を開く"}
                  </button>
                  {githubInstallUrl ? (
                    <a className="button secondary" href={githubInstallUrl} rel="noreferrer" target="_blank">
                      GitHub App を接続
                    </a>
                  ) : null}
                </div>
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
                className={bottomPanelMode === "preview" ? "bottom-tab active" : "bottom-tab"}
                onClick={() => setBottomPanelMode("preview")}
              >
                Preview
              </button>
              <button
                className={bottomPanelMode === "output" ? "bottom-tab active" : "bottom-tab"}
                onClick={() => setBottomPanelMode("output")}
              >
                出力
              </button>
              <button className="button secondary run-tests" disabled={!patchApplied || testsRun || runtimeRunState === "running"} onClick={runWorkspaceChecks}>
                <Play size={15} /> {runtimeRunState === "running" ? "実行中" : "Runtime checks"}
              </button>
              <button className="button secondary run-tests" disabled={!previewAvailable || previewRunState === "running"} onClick={runLocalPreview}>
                <Play size={15} /> {previewRunState === "running" ? "起動中" : "Local Preview"}
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
                <pre className="terminal-view">{runtimeLog}</pre>
              ) : null}
              {bottomPanelMode === "preview" ? (
                <div className="preview-panel">
                  <div className="preview-info">
                    <strong>{previewAvailable ? "Local Preview" : "Preview command 未検出"}</strong>
                    <span>{previewAvailable ? `${previewCommand} を使って確認します` : "package.json に dev または preview script がありません。"}</span>
                    <span>mode: {previewMode === "webcontainer" ? "WebContainer iframe" : previewMode === "manual" ? "Manual fallback" : previewPreflight.canAttemptWebContainer ? "WebContainer candidate" : "Manual fallback"}</span>
                    <span>{previewPreflight.reason}</span>
                    {previewUrl ? <a href={previewUrl}>{previewUrl}</a> : null}
                    <ul className="preview-preflight">
                      {previewPreflight.items.map((item) => (
                        <li className={`preview-preflight-${item.status}`} key={item.id}>
                          {item.status === "pass" ? <CheckCircle2 size={14} /> : item.status === "warning" ? <TriangleAlert size={14} /> : <Circle size={14} />}
                          <span>
                            <strong>{item.label}</strong>
                            {item.detail}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {previewUrl ? (
                    <iframe className="preview-iframe" title={`${workspaceName} preview`} src={previewUrl} />
                  ) : (
                    <div className="preview-frame">
                      <strong>{workspaceName}</strong>
                      <span>{previewRunState === "ready" ? "Preview ready" : previewRunState === "running" ? "Preview starting" : "Preview idle"}</span>
                      <p>
                        {previewAvailable
                          ? "対応環境では dev server の URL を取得し、この領域に iframe として表示します。非対応環境では失敗理由と URL bar fallback を表示します。"
                          : "この repo では自動 preview の候補がないため、AI は確認手順を提案する fallback に切り替えます。"}
                      </p>
                    </div>
                  )}
                  <pre className="preview-log">{previewLog}</pre>
                </div>
              ) : null}
              {bottomPanelMode === "output" ? (
                prDraftGenerated ? (
                  <div className="pr-draft-panel">
                    <div className="preview-toolbar">
                      <button className={prDraftMode === "preview" ? "bottom-tab active" : "bottom-tab"} onClick={() => setPrDraftMode("preview")}>Preview</button>
                      <button className={prDraftMode === "raw" ? "bottom-tab active" : "bottom-tab"} onClick={() => setPrDraftMode("raw")}>Raw</button>
                    </div>
                    {prDraftMode === "preview" ? (
                      <MarkdownPreview markdown={prDraftMarkdown || currentPrDraftMarkdown} />
                    ) : (
                      <pre className="terminal-view">{prDraftMarkdown || currentPrDraftMarkdown}</pre>
                    )}
                  </div>
                ) : createdPrUrl ? (
                  <pre className="terminal-view">{`Pull request created\n\n${createdPrUrl}`}</pre>
                ) : branchPushed ? (
                  <pre className="terminal-view">{`Branch pushed\n\n${branchName} -> origin/${branchName}\n${pushedCommitSha ? `commit: ${pushedCommitSha}\n` : ""}Ready to create pull request.`}</pre>
                ) : commitCreated ? (
                  <pre className="terminal-view">{`Commit draft created\n\n${commitMessage}`}</pre>
                ) : (
                  <pre className="terminal-view">{testsRun ? runtimeOutputPassed : runtimeOutputIdle}</pre>
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
                <dl className="context-pack-details">
                  <div>
                    <dt>selected</dt>
                    <dd>{selectedFile}</dd>
                  </div>
                  <div>
                    <dt>changes</dt>
                    <dd>{gitStatus.entries.length ? gitStatus.entries.map((entry) => entry.file).join(", ") : "なし"}</dd>
                  </div>
                  <div>
                    <dt>priority</dt>
                    <dd>{taskPriority}</dd>
                  </div>
                </dl>
              </section>

              <section className="assistant-section">
                <PanelTitle title="Model Routing" />
                <div className="runtime-grid">
                  {(["webllm"] as VisibleAiRuntimeMode[]).map((runtime) => (
                    <button
                      className={runtimeCardClassName(
                        aiRuntimeMode,
                        runtime,
                        aiRuntimeStatus.providers.find((provider) => provider.provider === runtime)?.status,
                      )}
                      key={runtime}
                      onClick={() => setAiRuntimeMode(runtime)}
                    >
                      <strong>{runtimeLabels[runtime]}</strong>
                      <span>{runtimeDescriptions[runtime]}</span>
                      <small>{runtimeProviderLabel(aiRuntimeStatus, runtime)}</small>
                    </button>
                  ))}
                </div>
                <div className="model-router">
                  <div className="model-router-header">
                    <strong>推奨モデル</strong>
                    <span>task: {webLlmTask} / 端末: {webLlmDeviceProfile.tier}</span>
                    <span>{webLlmDeviceProfile.adapterDetail}</span>
                    <span>storage: {formatBytes(webLlmDeviceProfile.storageQuota)}</span>
                    {hiddenFailedWebLlmModelCount > 0 ? <span>{hiddenFailedWebLlmModelCount} 件はこの端末で load 失敗済みのため非表示</span> : null}
                  </div>
                  <div className="model-cards">
                    {visibleWebLlmModels.map((model) => (
                      <button
                        className={`model-card ${selectedWebLlmModelId === model.id ? "active" : ""} model-card-${model.compatibility}`}
                        key={model.id}
                        onClick={() => {
                          setSelectedWebLlmModelId(model.id);
                          setAiRuntimeMode("webllm");
                        }}
                      >
                        <strong>{model.title}</strong>
                        <span>{model.family} / {model.sizeClass} / {model.license}</span>
                        <small>{supportedWebLlmModelIds.has(model.id) ? model.compatibility : `${model.compatibility} / 未確認 artifact`}</small>
                        <em>{model.reason}</em>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="routing-note">
                  <strong>Suggestion: {runtimeLabels[runtimeSuggestion]}</strong>
                  <span>選択中: {selectedRuntimeLabel}</span>
                  <span>Model: {selectedWebLlmModelId}</span>
                  <span>{aiRuntimeCheckState === "checking" ? "runtime を確認中" : selectedRuntimeHealth?.detail}</span>
                  <button className="button secondary" disabled={webLlmDiagnosticState === "running"} onClick={runWebLlmDiagnostic}>
                    {webLlmDiagnosticState === "running" ? "WebLLM 診断中" : "WebLLM model load 診断"}
                  </button>
                  <pre className="diagnostic-log">{webLlmDiagnosticLog}</pre>
                </div>
              </section>

              <section className="assistant-section">
                <PanelTitle title="Runtime Plan" />
                <div className="runtime-plan">
                  <span>capability: {runtimePlan.capability}</span>
                  <span>confidence: {runtimePlan.confidence}</span>
                  <span>test: {runtimePlan.testCommand ?? "not detected"}</span>
                  <span>typecheck: {runtimePlan.typecheckCommand ?? "not detected"}</span>
                  <span>dev: {runtimePlan.devCommand ?? "not detected"}</span>
                  <span>preview: {runtimePlan.previewCommand ?? "not detected"}</span>
                </div>
              </section>

              <section className="assistant-section">
                <PanelTitle title="E2E Diagnostics" />
                <div className="diagnostic-grid">
                  {(["github", "webllm", "webcontainer"] as const).map((group) => (
                    <div className="diagnostic-group" key={group}>
                      <strong>{diagnosticGroupLabels[group]}</strong>
                      <ul className="diagnostic-list">
                        {runtimeDiagnostics
                          .filter((item) => item.group === group)
                          .map((item) => (
                            <li className={`diagnostic-item diagnostic-item-${item.status}`} key={item.id}>
                              {item.status === "pass" ? <CheckCircle2 size={14} /> : item.status === "blocked" ? <TriangleAlert size={14} /> : <Circle size={14} />}
                              <span>
                                <strong>{item.label}</strong>
                                {item.detail}
                              </span>
                            </li>
                          ))}
                      </ul>
                    </div>
                  ))}
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
                <div className="memory-actions">
                  <button className="button secondary" onClick={saveProjectMemory}>保存</button>
                  <button className="button ghost" onClick={restoreProjectMemory}>復元</button>
                  <button className="button ghost" onClick={clearProjectMemory}>削除</button>
                </div>
                <div className="memory-meta">
                  <span>project: {assistedMemoryProjectKey}</span>
                  <span>{memorySavedAt ? `saved: ${formatDateTime(memorySavedAt)}` : memoryStatusMessage}</span>
                </div>
              </section>

              <section className="assistant-section patch-section">
                <PanelTitle title="Patch Queue" />
                <div className="patch-queue-list" aria-label="Patch proposals">
                  {patchQueue.length > 0 ? (
                    patchQueue.map((item) => (
                      <button
                        className={`patch-queue-item ${item.proposal.id === activePatch.id ? "active" : ""}`}
                        key={item.proposal.id}
                        onClick={() => {
                          setActivePatchId(item.proposal.id);
                        }}
                      >
                        <span>{item.proposal.title}</span>
                        <strong>{item.proposal.status}</strong>
                      </button>
                    ))
                  ) : (
                    <div className="empty-state compact">
                      <strong>Patch proposal はまだありません</strong>
                      <p>WebLLM が利用可能な状態で、対象 file と Branch Goal から生成します。</p>
                    </div>
                  )}
                </div>
                <article className="patch-card">
                  <div className="patch-heading">
                    <strong>{activePatch.title}</strong>
                    <span>{activePatch.status === "rejected" ? "reject 済み" : patchApplied || activePatch.status === "applied" ? "適用済み" : preview.ok ? "レビュー可能" : "確認が必要"}</span>
                  </div>
                  <p>{activePatch.summary}</p>
                  <p>{patchGenerationMessage}</p>
                  <p className="patch-meta">source: {activePatchItem.source} / edits: {hasActivePatchProposal ? activePatch.edits.length : 0}</p>
                  {patchFailureReason ? <p className="patch-failure">reason: {patchFailureReason}</p> : null}
                  <ul className="check-list">
                    <li><CheckCircle2 size={15} /> 構造化 edit を解析済み</li>
                    <li>{patchTargetAvailable ? <CheckCircle2 size={15} /> : <TriangleAlert size={15} />} 対象ファイル</li>
                    <li>{preview.ok && !activePatchRejected ? <CheckCircle2 size={15} /> : <TriangleAlert size={15} />} 対象テキストが一致</li>
                    <li>{preview.ok && !activePatchRejected ? <CheckCircle2 size={15} /> : <TriangleAlert size={15} />} Diff preview を生成済み</li>
                    <li>{testsRun ? <CheckCircle2 size={15} /> : <TriangleAlert size={15} />} {testsRun ? "テスト通過" : "テスト未実行"}</li>
                  </ul>
                  <div className="patch-actions">
                    <button className="button secondary" disabled={patchGenerationState === "running" || (!selectedRuntimeAvailable && !testFixtureEnabled) || !selectedFile} onClick={generateAiPatchProposal}>
                      {patchGenerationState === "running" ? "生成中" : "AI patch を生成"}
                    </button>
                    <button className="button secondary" disabled={!canReviewPatch} onClick={openDiffPreview}>Diff を確認</button>
                    <button className="button secondary danger" disabled={!hasActivePatchProposal || activePatch.status === "rejected" || activePatch.status === "applied"} onClick={rejectActivePatch}>Reject</button>
                    <button className="button" disabled={!canApplyPatch} onClick={applyPatch}>
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

function LocalPreviewPanel({
  onOpenPreviewAddress,
  previewAvailable,
  previewAddress,
  previewRunState,
  previewUrl,
  setPreviewAddress,
  workspaceName,
}: {
  onOpenPreviewAddress: () => void;
  previewAvailable: boolean;
  previewAddress: string;
  previewCommand: string | undefined;
  previewLog: string;
  previewMode: "candidate" | "manual" | "webcontainer";
  previewPreflight: ReturnType<typeof createLocalPreviewPreflight>;
  previewRunState: "idle" | "running" | "ready";
  previewUrl: string;
  setPreviewAddress: (value: string) => void;
  workspaceName: string;
}) {
  return (
    <div className="preview-panel">
      <form
        className="preview-addressbar"
        onSubmit={(event) => {
          event.preventDefault();
          onOpenPreviewAddress();
        }}
      >
        <input aria-label="Preview URL" onChange={(event) => setPreviewAddress(event.target.value)} placeholder="http://localhost:5173" value={previewAddress} />
        <button className="button secondary" type="submit">開く</button>
      </form>
      {previewUrl ? (
        <iframe className="preview-iframe" title={`${workspaceName} preview`} src={previewUrl} />
      ) : previewAvailable ? (
        <div className="preview-frame">
          <strong>{workspaceName}</strong>
          <span>{previewRunState === "ready" ? "Preview ready" : previewRunState === "running" ? "Preview starting" : "Preview idle"}</span>
          <p>WebContainer preview を起動するか、URL bar に localhost URL を入力してください。</p>
        </div>
      ) : (
        <div className="preview-frame">
          <strong>{workspaceName}</strong>
          <span>{previewRunState === "ready" ? "Preview ready" : previewRunState === "running" ? "Preview starting" : "Preview idle"}</span>
          <p>この repo では自動 preview の候補がありません。</p>
        </div>
      )}
    </div>
  );
}

function ExplorerTree({
  dirtyFiles,
  expandedFolders,
  nodes,
  onSelectFile,
  onToggleFolder,
  selectedFile,
}: {
  dirtyFiles: Set<string>;
  expandedFolders: Set<string>;
  nodes: ExplorerNode[];
  onSelectFile: (file: string) => void;
  onToggleFolder: (folder: string) => void;
  selectedFile: string;
}) {
  return (
    <>
      {nodes.map((node) => (
        <ExplorerTreeNode
          dirtyFiles={dirtyFiles}
          expandedFolders={expandedFolders}
          key={node.path}
          node={node}
          onSelectFile={onSelectFile}
          onToggleFolder={onToggleFolder}
          selectedFile={selectedFile}
        />
      ))}
    </>
  );
}

function ExplorerTreeNode({
  depth = 0,
  dirtyFiles,
  expandedFolders,
  node,
  onSelectFile,
  onToggleFolder,
  selectedFile,
}: {
  depth?: number;
  dirtyFiles: Set<string>;
  expandedFolders: Set<string>;
  node: ExplorerNode;
  onSelectFile: (file: string) => void;
  onToggleFolder: (folder: string) => void;
  selectedFile: string;
}) {
  if (node.type === "directory") {
    const expanded = expandedFolders.has(node.path);

    return (
      <div className="tree-group">
        <button className="tree-item folder-item" onClick={() => onToggleFolder(node.path)} style={{ paddingLeft: 8 + depth * 14 }}>
          <ChevronRight className={expanded ? "tree-chevron expanded" : "tree-chevron"} size={14} />
          {expanded ? <FolderOpen size={15} /> : <Folder size={15} />}
          <span>{node.name}</span>
        </button>
        {expanded
          ? node.children.map((child) => (
              <ExplorerTreeNode
                depth={depth + 1}
                dirtyFiles={dirtyFiles}
                expandedFolders={expandedFolders}
                key={child.path}
                node={child}
                onSelectFile={onSelectFile}
                onToggleFolder={onToggleFolder}
                selectedFile={selectedFile}
              />
            ))
          : null}
      </div>
    );
  }

  return (
    <button
      className={node.path === selectedFile ? "tree-item file-item active" : "tree-item file-item"}
      onClick={() => onSelectFile(node.path)}
      style={{ paddingLeft: 28 + depth * 14 }}
    >
      <File size={14} />
      <span>{node.name}</span>
      {dirtyFiles.has(node.path) ? <span className="dirty-dot" aria-label="未保存の変更" /> : null}
    </button>
  );
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

function buildExplorerTree(fileNames: string[]): ExplorerNode[] {
  const root: ExplorerNode[] = [];

  for (const fileName of fileNames) {
    const parts = fileName.split("/").filter(Boolean);
    let currentLevel = root;
    let currentPath = "";

    parts.forEach((part, index) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isFile = index === parts.length - 1;
      let node = currentLevel.find((candidate) => candidate.name === part && candidate.type === (isFile ? "file" : "directory"));

      if (!node) {
        node = {
          children: [],
          name: part,
          path: currentPath,
          type: isFile ? "file" : "directory",
        };
        currentLevel.push(node);
        currentLevel.sort(compareExplorerNodes);
      }

      currentLevel = node.children;
    });
  }

  return root;
}

function compareExplorerNodes(left: ExplorerNode, right: ExplorerNode) {
  if (left.type !== right.type) return left.type === "directory" ? -1 : 1;
  return left.name.localeCompare(right.name);
}

function searchWorkspace(files: Record<string, string>, query: string): SearchResult[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  const results: SearchResult[] = [];
  const maxResults = 80;
  const maxContentMatchesPerFile = 5;

  for (const file of Object.keys(files).sort()) {
    if (results.length >= maxResults) break;

    if (file.toLowerCase().includes(normalizedQuery)) {
      results.push({
        file,
        line: 1,
        matchType: "filename",
        preview: "ファイル名に一致",
      });
    }

    let contentMatches = 0;
    const lines = files[file].split(/\r?\n/);

    for (const [index, line] of lines.entries()) {
      if (results.length >= maxResults || contentMatches >= maxContentMatchesPerFile) break;
      if (!line.toLowerCase().includes(normalizedQuery)) continue;

      results.push({
        file,
        line: index + 1,
        matchType: "content",
        preview: line.trim() || "(空行)",
      });
      contentMatches += 1;
    }
  }

  return results;
}

function revealEditorLine(editor: Parameters<OnMount>[0] | null, line: number) {
  if (!editor) return;

  const lineNumber = Math.max(1, line);
  editor.revealLineInCenter(lineNumber);
  editor.setPosition({ column: 1, lineNumber });
  editor.focus();
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

function basename(fileName: string) {
  return fileName.split("/").at(-1) ?? fileName;
}

function normalizeWorkspacePath(path: string) {
  return path
    .trim()
    .replaceAll("\\", "/")
    .replace(/^\/+/, "")
    .replace(/\/{2,}/g, "/");
}

function dirname(fileName: string) {
  const parts = fileName.split("/");
  parts.pop();
  return parts.join("/");
}

function createInitialFileContent(fileName: string) {
  const name = basename(fileName);
  if (fileName.endsWith(".ts")) return `export function ${safeIdentifier(name.replace(/\.ts$/, ""))}() {\n  return null;\n}\n`;
  if (fileName.endsWith(".tsx")) return `export function ${safeIdentifier(name.replace(/\.tsx$/, ""))}() {\n  return <div />;\n}\n`;
  if (fileName.endsWith(".json")) return "{\n}\n";
  if (fileName.endsWith(".md")) return `# ${name.replace(/\.md$/, "")}\n\n`;
  return "";
}

function safeIdentifier(value: string) {
  const identifier = value.replace(/[^A-Za-z0-9_$]/g, " ").replace(/\s+(\w)/g, (_match: string, letter: string) => letter.toUpperCase());
  const normalized = identifier.charAt(0).toUpperCase() + identifier.slice(1);
  return /^[A-Za-z_$]/.test(normalized) ? normalized : "GeneratedFile";
}

function suggestSiblingFilePath(fileName: string) {
  const directory = dirname(fileName);
  return directory ? `${directory}/new-file.md` : "new-file.md";
}

function suggestSiblingFolderPath(folderName: string) {
  const directory = dirname(`${folderName}/placeholder`);
  const parent = dirname(directory);
  return parent ? `${parent}/new-folder` : "new-folder";
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

function createDirtyFileSet(savedFiles: Record<string, string>, workingFiles: Record<string, string>) {
  const fileNames = new Set([...Object.keys(savedFiles), ...Object.keys(workingFiles)]);
  const dirtyFiles = new Set<string>();

  for (const fileName of fileNames) {
    if (savedFiles[fileName] !== workingFiles[fileName]) {
      dirtyFiles.add(fileName);
    }
  }

  return dirtyFiles;
}

function workspaceSourceLabel(source: WorkspaceSnapshot["source"]) {
  if (source === "empty") return "No Workspace";
  if (source === "local-directory") return "Local Directory";
  if (source === "indexeddb") return "Browser Snapshot";
  return "Test Fixture";
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
  aiRuntimeStatus: ReturnType<typeof createDefaultRuntimeStatus>;
  budgetRatio: number;
  changeCount: number;
  fileCount: number;
  priority: TaskPriority;
}): AiRuntimeMode {
  const providerAvailable = (provider: AiRuntimeMode) =>
    input.aiRuntimeStatus.providers.some((runtimeProvider) => runtimeProvider.provider === provider && runtimeProvider.status === "available");

  if (providerAvailable("webllm") && input.fileCount < 120 && input.budgetRatio < 0.9) {
    return "webllm";
  }

  return "webllm";
}

function runtimeCardClassName(
  selectedRuntime: AiRuntimeMode,
  runtime: AiRuntimeMode,
  status: "available" | "unavailable" | "checking" | undefined,
) {
  return ["runtime-card", selectedRuntime === runtime ? "active" : "", status ? `runtime-card-${status}` : ""]
    .filter(Boolean)
    .join(" ");
}

function runtimeProviderLabel(status: ReturnType<typeof createDefaultRuntimeStatus>, runtime: AiRuntimeMode) {
  const provider = status.providers.find((runtimeProvider) => runtimeProvider.provider === runtime);

  if (!provider) return "未確認";
  if (provider.modelIds.length > 0) return `${provider.label}: ${provider.modelIds.slice(0, 2).join(", ")}`;
  return provider.label;
}

function estimateTokens(text: string) {
  return Math.ceil(text.length / 4);
}

function formatTokenCount(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
}

function loadFailedWebLlmModelIds() {
  if (typeof window === "undefined") return new Set<string>();

  try {
    const raw = window.localStorage.getItem(webLlmFailedModelsStorageKey);
    if (!raw) return new Set<string>();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set<string>();
    return new Set(parsed.filter((value): value is string => typeof value === "string"));
  } catch {
    return new Set<string>();
  }
}

function saveFailedWebLlmModelIds(modelIds: Set<string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(webLlmFailedModelsStorageKey, JSON.stringify([...modelIds]));
}

function normalizeIssueNumber(value: string) {
  return value.replace(/^#/, "").replace(/[^\d]/g, "");
}

function ensureCloseKeyword(markdown: string, issueNumber: string) {
  const normalizedIssueNumber = normalizeIssueNumber(issueNumber);
  if (!normalizedIssueNumber) return markdown;
  if (new RegExp(`\\b(closes|fixes|resolves)\\s+#${normalizedIssueNumber}\\b`, "i").test(markdown)) return markdown;
  return `${markdown.trim()}\n\n## 関連 Issue\nCloses #${normalizedIssueNumber}\n`;
}

function createPrDraftMarkdown(input: {
  assistedMemory: string;
  branchGoalMarkdown: string;
  branchName: string;
  changedFiles: Array<{ file: string; status: string }>;
  closeIssueNumber: string;
  contextBudget: ReturnType<typeof createContextBudget>;
  contextPriority: TaskPriority;
  previewChecked: boolean;
  runtimeLabel: string;
  safetyReady: boolean;
  selectedFile: string;
  testsPassed: boolean;
  title: string;
  warnings: string[];
}) {
  const changedFileLines =
    input.changedFiles.length > 0
      ? input.changedFiles.map((entry) => `- \`${entry.file}\` (${entry.status})`).join("\n")
      : "- 差分なし。commit 前に変更内容を確認する。";
  const memoryLines = toMarkdownBullets(input.assistedMemory, "- Project-specific memory は未設定。");
  const goalSummary = extractSectionPreview(input.branchGoalMarkdown, "Goal") || input.title;
  const acceptanceSummary = extractSectionPreview(input.branchGoalMarkdown, "Acceptance Criteria") || "Branch Goal の受け入れ条件に沿って確認する。";
  const closeIssueLine = input.closeIssueNumber ? `\n## 関連 Issue\nCloses #${input.closeIssueNumber}\n` : "";
  const warnings =
    input.warnings.length > 0 ? input.warnings.map((warning) => `- ${warning}`).join("\n") : "- runtime warning なし。";

  return `# ${input.title}

## 概要
- branch: \`${input.branchName}\`
- 目的: ${goalSummary}
- 生成 runtime: ${input.runtimeLabel}

## AI Context
- selected file: \`${input.selectedFile}\`
- priority tier: ${input.contextPriority}
- budget: ${input.contextBudget.used}/${input.contextBudget.limit} tokens (${input.contextBudget.percent}%)
- changed files: ${input.changedFiles.length}

## 変更内容
${changedFileLines}

## 受け入れ条件との対応
${toMarkdownBullets(acceptanceSummary, "- Branch Goal を確認する。")}

## Assisted Memory
${memoryLines}
${closeIssueLine}

## リスクと確認観点
${warnings}
- Safety gate: ${input.safetyReady ? "PR 作成可能" : "未完了項目あり"}
- Preview: ${input.previewChecked ? "確認済み" : "未確認"}

## テスト
- ${input.testsPassed ? "Runtime checks / tests 実行済み" : "Tests 未実行"}
`;
}

function toMarkdownBullets(value: string, fallback: string) {
  const lines = value
    .split("\n")
    .map((line) => line.trim().replace(/^[-*]\s*/, ""))
    .filter(Boolean);

  if (lines.length === 0) return fallback;
  return lines.map((line) => `- ${line}`).join("\n");
}

function extractSectionPreview(markdown: string, heading: string) {
  const lines = markdown.split("\n");
  const headingIndex = lines.findIndex((line) => line.trim().toLowerCase() === `## ${heading}`.toLowerCase());
  if (headingIndex < 0) return "";

  const sectionLines: string[] = [];
  for (const line of lines.slice(headingIndex + 1)) {
    if (line.startsWith("## ")) break;
    const normalized = line.trim().replace(/^[-*]\s*/, "");
    if (normalized) sectionLines.push(normalized);
    if (sectionLines.length >= 3) break;
  }

  return sectionLines.join("\n");
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ja-JP", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function extractMarkdownTitle(markdown: string) {
  return markdown
    .split("\n")
    .find((line) => line.startsWith("# "))
    ?.replace(/^# /, "");
}

const runtimeLabels: Record<AiRuntimeMode, string> = {
  ollama: "Ollama",
  recorded: "Fallback proposal",
  webllm: "WebLLM",
};

const runtimeDescriptions: Record<AiRuntimeMode, string> = {
  ollama: "ローカル常駐モデルで重い判断を担当",
  recorded: "テスト fixture または緊急時の固定 proposal",
  webllm: "ブラウザ内で小さな判断を担当",
};

const diagnosticGroupLabels: Record<RuntimeDiagnosticItem["group"], string> = {
  github: "GitHub App",
  webcontainer: "WebContainer",
  webllm: "WebLLM",
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

const fixtureTestLogIdle = `PS git-ai-ide> pnpm test
テストはまだ実行されていません。
Patch を適用すると、runtime checks を実行できます。`;

const fixtureTestLogPassed = `PS git-ai-ide> pnpm test

> pr-helper-mini@0.1.0 test
> vitest run

✓ generateSummary handles empty diff input
✓ generateSummary keeps existing summary format

Test Files  1 passed
Tests       2 passed
Duration    642ms`;

const runtimeOutputIdle = `Git AI IDE Runtime
WebContainer / local command runner の出力をここに集約します。`;

const runtimeOutputPassed = `Git AI IDE Runtime
Patch proposal applied.
Safety checklist updated.
Branch is ready for commit draft.`;

const fixturePrDraft = `# PR 要約生成を改善する

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

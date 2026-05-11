# Local Issue Tracker

This file is the temporary issue tracker until GitHub Issues is connected.

## Issue Template

```md
## GAI-000: Title

- Status:
- Labels:
- Owner:
- Context:
- Scope:
- Acceptance Criteria:
- Verification:
- Notes:
```

## GAI-001: Formalize Repository Location And Agent Workflow

- Status: done
- Labels: `type:infra`, `area:docs`, `area:workflow-safety`, `p0`
- Owner: Codex
- Context: Work started in a Codex-generated chat directory. The formal repo should live at `C:\Users\shuny\projects\git-ai-ide`.
- Scope:
  - Rename formal repository directory to `git-ai-ide`.
  - Add `CONTEXT.md`.
  - Add local issue tracker.
  - Add triage labels.
  - Add domain notes.
  - Update `AGENTS.md` with Agent skills workflow.
- Acceptance Criteria:
  - Repo exists at `C:\Users\shuny\projects\git-ai-ide`.
  - `AGENTS.md` tells agents to read context and use local issues.
  - `docs/agents/issue-tracker.md` exists.
  - `docs/agents/triage-labels.md` exists.
  - `docs/agents/domain.md` exists.
- Verification:
  - File presence checked by shell.
- Notes:
  - Original Codex chat directory should only be deleted after install/typecheck/build pass from the formal repo.

## GAI-002: Install Dependencies And Verify Formal Repo

- Status: done
- Labels: `type:infra`, `p0`
- Owner: Codex
- Context: Formal repo was copied without generated dependencies and needed verification from the final path.
- Scope:
  - Run `pnpm install` in `C:\Users\shuny\projects\git-ai-ide`.
  - Run `pnpm -r typecheck`.
  - Run web build.
  - Run worker dry-run build.
- Acceptance Criteria:
  - Dependencies install successfully.
  - Typecheck passes.
  - Web build passes.
  - Worker dry-run build passes.
- Verification:
  - `pnpm install` passed.
  - `pnpm -r typecheck` passed.
  - `pnpm --filter @git-ai-ide/web build` passed.
  - `pnpm --filter @git-ai-ide/worker build` passed.

## GAI-003: Replace Remaining Git AI IDE Product Naming

- Status: done
- Labels: `type:docs`, `area:docs`, `p1`
- Owner: Codex
- Context: The repo and product name should both be `Git AI IDE`.
- Scope:
  - Rename UI/docs consistently to `Git AI IDE`.
  - Rename package scope to `@git-ai-ide`.
  - Rename root package to `git-ai-ide`.
- Acceptance Criteria:
  - README title matches chosen product/repo naming.
  - AGENTS.md and docs do not conflict.
  - UI brand is intentional.
- Verification:
  - Legacy product and package-scope names were searched and removed.

## GAI-004: Real GitHub Push Before PR Creation

- Status: needs-triage
- Labels: `type:feature`, `area:github`, `area:git`, `p1`
- Owner: Codex
- Context: Worker can create PRs through GitHub App when a branch already exists. Browser push is still demo mode.
- Scope:
  - Convert workspace changes into commit content.
  - Push branch through GitHub API or isomorphic-git integration.
  - Then call Worker PR API.
- Acceptance Criteria:
  - Selected repo only.
  - No GitHub token stored in browser.
  - PR creation uses actual pushed branch.
- Verification:
  - Worker dry-run.
  - Demo repo flow.
  - Real GitHub test after credentials are provided.

## GAI-005: Real WebLLM And Ollama Runtime Detection

- Status: needs-triage
- Labels: `type:feature`, `area:ai-runtime`, `p1`
- Owner: Codex
- Context: Model routing UI exists, but WebLLM/Ollama execution is boundary/demo mode.
- Scope:
  - Detect WebGPU.
  - Add WebLLM loading boundary.
  - Detect Ollama on localhost.
  - Keep Recorded AI fallback first-class.
- Acceptance Criteria:
  - User sees setup state.
  - Failure falls back to Recorded AI.
  - No cloud LLM required.
- Verification:
  - Browser runtime checks.
  - Typecheck/build.

## GAI-006: WebContainer Execution

- Status: needs-triage
- Labels: `type:feature`, `area:runtime`, `p2`
- Owner: Codex
- Context: Runtime planner detects test/typecheck scripts, but execution is recorded.
- Scope:
  - Add WebContainer install/run boundary.
  - Run detected test/typecheck where supported.
  - Feed result into Safety Gate.
- Acceptance Criteria:
  - Unsupported repos show best-effort explanation.
  - JS/TS demo repo can run a recorded or real test path.
- Verification:
  - Browser test.
  - Typecheck/build.

## GAI-007: Create GitHub Repository And Push Initial MVP

- Status: in-progress
- Labels: `type:infra`, `area:github`, `p0`
- Owner: Codex
- Context: The formal repository exists locally at `C:\Users\shuny\projects\git-ai-ide`, but GitHub does not show it because no remote repository has been created or pushed.
- Scope:
  - Ensure Git and GitHub CLI are available.
  - Create GitHub repository named `git-ai-ide`.
  - Add `origin` remote.
  - Commit current MVP.
  - Push `main` to GitHub.
- Acceptance Criteria:
  - GitHub repository exists.
  - `origin` is configured.
  - `main` branch is pushed.
  - User can open the GitHub repository URL.
- Verification:
  - `git remote -v`
  - `git status`
  - `gh repo view` or equivalent.

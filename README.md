# Git AI IDE

Git AI IDE is a Git-aware browser IDE for safe AI-assisted Branch to PR workflows.

The project focuses on **AI workflow safety**:

- LLMs propose changes.
- The IDE validates structured edits.
- Users review diffs.
- Git records the final decision.

## Current Status

This repository now contains a working MVP shell for the full Branch to PR flow:

- VS Code-like browser IDE layout
- Monaco Editor and Monaco Diff Editor
- demo repo plus local directory snapshot loading
- IndexedDB workspace persistence
- snapshot-based Git status, diff review, commit draft, push demo, and PR creation demo
- Patch Queue with structured edit validation
- AI runtime routing for Recorded AI / WebLLM / Ollama fallback
- Context Pack budget meter and editable Branch Goal / Assisted Memory
- Runtime planning for test/typecheck commands
- Cloudflare Worker API boundary for GitHub repository and PR helper flows
- Cloudflare D1 schema for workflow metadata only

## Architecture Direction

- Web app: `apps/web`
- Worker: `apps/worker`
- Shared types: `packages/shared`
- Patch validation: `packages/patch-core`
- AI runtime abstraction: `packages/ai-runtime`
- Git helpers: `packages/git-core`

## Development

See [docs/development.md](docs/development.md).

```bash
pnpm install
pnpm dev
```

Docker is not required for initial development. Git AI IDE depends heavily on host browser capabilities such as WebGPU, File System Access API, WebContainer, and localhost Ollama access.

## Privacy-Aware D1 Policy

D1 stores Branch to PR workflow metadata only.

Stored:

- sessions
- repository metadata
- branch names
- AI action summaries
- patch proposal statuses
- safety gate results
- PR URLs

Not stored:

- code text
- diff text
- GitHub tokens
- full LLM prompts
- private file content

## Docs

- [PRD / Architecture / MVP Milestones](git-ai-ide_prd_architecture_milestones.md)
- [Technical Decisions](git-ai-ide_technical_decisions.md)
- [Interview Notes](git-ai-ide_interview_notes.md)
- [Project Ideas](portfolio_project_ideas.md)
- [MVP Implementation Status](docs/mvp-implementation-status.md)
- [GitHub App Setup](docs/github-app-setup.md)

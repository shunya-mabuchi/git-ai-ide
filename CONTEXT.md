# Git AI IDE Context

## Product

Git AI IDE is a browser IDE for safe AI-assisted Branch to PR workflows.

The product goal is not to replace VS Code or Cursor. The goal is to make AI coding assistance understandable, reviewable, and safe inside a Git workflow:

> LLM proposes. IDE validates. User reviews. Git records.

## Core User Flow

1. Open a demo repo or local repository snapshot.
2. Set a Branch Goal.
3. Inspect Repo Map and Context Pack.
4. Ask AI for a small patch proposal.
5. Review Patch Queue safety checks.
6. Review diff in Monaco Diff Editor.
7. Apply patch.
8. Run tests or recorded runtime checks.
9. Create commit draft.
10. Push branch.
11. Generate PR description.
12. Pass Safety Gate.
13. Create PR through GitHub App / Worker boundary.

## Technical Direction

- Frontend: React, TypeScript, Vite, Monaco Editor
- Hosting: Cloudflare Pages
- API: Cloudflare Workers
- DB: Cloudflare D1 for metadata only
- Git: isomorphic-git direction, current MVP uses snapshot diff helpers
- AI: Recorded AI demo, WebLLM path, Ollama fallback
- Runtime: WebContainer candidate, recorded fallback
- Local storage: File System Access API and IndexedDB

## Privacy Rules

D1 must not store:

- source code text
- diff text
- GitHub tokens
- full LLM prompts
- private file content

D1 may store:

- session metadata
- repository metadata
- branch names
- AI action summaries
- patch proposal status
- safety gate result
- PR URL

## Current Boundaries

Implemented:

- IDE shell
- demo repo
- Monaco editor and diff editor
- local snapshot loading
- IndexedDB restore
- Patch Queue
- Safety Gate
- GitHub Worker API boundary
- demo PR flow

Demo or boundary only:

- GitHub push
- real GitHub App installation flow in UI
- real WebLLM model loading
- real Ollama connection
- real WebContainer execution
- isomorphic-git filesystem integration

## Engineering Rule

When implementing features, first update or create a local issue in `docs/agents/issue-tracker.md`, then implement against its acceptance criteria.

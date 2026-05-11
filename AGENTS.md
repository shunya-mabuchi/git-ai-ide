# Git AI IDE Agent Guide

## Project Goal

Git AI IDE is a Git-aware browser IDE focused on safe AI-assisted Branch to PR workflows.

The core principle is:

> LLM proposes. IDE validates. User applies. Git records.

## Commands

- Install: `pnpm install`
- Web dev server: `pnpm dev`
- Worker dev server: `pnpm dev:worker`
- Type check: `pnpm typecheck`
- Test: `pnpm test`
- Build: `pnpm build`

## Tooling

- Package manager: pnpm
- Runtime: Node.js 22
- Web app: React + TypeScript + Vite
- Worker: Cloudflare Workers
- DB: Cloudflare D1 for workflow metadata only
- Editor target: Monaco Editor
- Git target: isomorphic-git
- AI target: WebLLM primary, Ollama fallback
- Runtime target: WebContainer

## Safety Rules

- Do not store code text, diff text, GitHub tokens, or full LLM prompts in D1.
- AI edits must go through Structured Edit Operation, Patch Queue, and Diff Preview.
- Keep GitHub access scoped to selected repositories.
- Do not introduce cloud LLM inference as a required path.
- Prefer local-first state for workspace data.

## Directory Map

- `apps/web`: browser IDE
- `apps/worker`: Cloudflare Worker for GitHub auth/proxy and D1 metadata APIs
- `packages/shared`: shared types
- `packages/ai-runtime`: AI provider abstractions
- `packages/patch-core`: Structured Edit Operation validation and patch helpers
- `packages/git-core`: Git workflow types and helpers
- `docs`: development and architecture notes

## Agent skills

This repository follows an issue-first agentic engineering workflow.

- Read `CONTEXT.md` before changing product behavior.
- Use `docs/agents/issue-tracker.md` as the local issue tracker until GitHub Issues is connected.
- Use `docs/agents/domain.md` for product language, safety rules, and architectural boundaries.
- Use `docs/agents/triage-labels.md` when classifying work.
- Before implementing a non-trivial feature, add or update an issue with scope, acceptance criteria, and verification.
- Prefer small vertical slices, but group related implementation work into a single coherent task when the user asks to avoid chat overhead.
- Keep demo-mode boundaries explicit. Do not present demo GitHub, demo WebLLM, demo Ollama, or demo WebContainer behavior as production-complete.

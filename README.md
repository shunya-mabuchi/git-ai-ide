# Git AI IDE

Git AI IDE は、Git の Branch to PR workflow を安全に進めるための AI 支援つきブラウザ IDE です。

中心に置いているのは **AI workflow safety** です。

- LLM が変更案を提案する。
- IDE が structured edit として検証する。
- ユーザーが diff を確認する。
- Git が最終判断を履歴として記録する。

## 現在の状態

このリポジトリには、Branch to PR flow の MVP shell が入っています。

- VS Code / Cursor 風のブラウザ IDE layout
- Monaco Editor と Monaco Diff Editor
- demo repo とローカル directory snapshot の読み込み
- IndexedDB による workspace 復元
- snapshot ベースの Git status、diff review、commit draft、push demo、PR creation demo
- structured edit validation つき Patch Queue
- Recorded AI / WebLLM / Ollama fallback の runtime routing
- Context Pack budget meter と編集可能な Branch Goal / Assisted Memory
- test/typecheck command の Runtime Plan
- GitHub repository / PR helper flow のための Cloudflare Worker API boundary
- workflow metadata のみを保存する Cloudflare D1 schema
- Local Preview の script 検出と fallback 表示

## アーキテクチャ方針

- Web app: `apps/web`
- Worker: `apps/worker`
- Shared types: `packages/shared`
- Patch validation: `packages/patch-core`
- AI runtime abstraction: `packages/ai-runtime`
- Git helpers: `packages/git-core`

## 開発

詳しくは [docs/development.md](docs/development.md) を参照してください。

```bash
pnpm install
pnpm dev
```

初期開発では Docker を必須にしていません。Git AI IDE は WebGPU、File System Access API、WebContainer、localhost の Ollama access など、ホストブラウザとホスト OS の機能に強く依存するためです。

## D1 のプライバシー方針

D1 は Branch to PR workflow metadata のみを保存します。

保存するもの:

- session
- repository metadata
- branch name
- AI action summary
- patch proposal status
- safety gate result
- PR URL

保存しないもの:

- code text
- diff text
- GitHub token
- LLM prompt 全文
- private file content

## ドキュメント

- [PRD / Architecture / MVP Milestones](git-ai-ide_prd_architecture_milestones.md)
- [技術選定メモ](git-ai-ide_technical_decisions.md)
- [面接用アピール資料](git-ai-ide_interview_notes.md)
- [プロジェクト案](portfolio_project_ideas.md)
- [MVP 実装状況](docs/mvp-implementation-status.md)
- [完成までの残り機能](docs/completion-roadmap.md)
- [GitHub App セットアップ](docs/github-app-setup.md)

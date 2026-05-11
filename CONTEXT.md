# Git AI IDE コンテキスト

## プロダクト

Git AI IDE は、AI 支援つき Branch to PR workflow のためのブラウザ IDE です。

VS Code や Cursor を完全に置き換えることが目的ではありません。目的は、AI coding assistance を Git workflow の中で理解可能、検証可能、安全に扱えるようにすることです。

基本原則:

> LLM は提案する。IDE は検証する。ユーザーが確認する。Git が記録する。

## 中心ユーザーフロー

1. demo repo または local repository snapshot を開く。
2. Branch Goal を設定する。
3. Repo Map と Context Pack を確認する。
4. AI に小さな patch proposal を依頼する。
5. Patch Queue の safety check を確認する。
6. Monaco Diff Editor で diff を確認する。
7. patch を適用する。
8. test または recorded runtime check を実行する。
9. commit draft を作る。
10. branch を push する。
11. PR description を生成する。
12. Safety Gate を確認する。
13. GitHub App / Worker boundary 経由で PR を作成する。

## 技術方針

- Frontend: React, TypeScript, Vite, Monaco Editor
- Hosting: Cloudflare Pages
- API: Cloudflare Workers
- DB: Cloudflare D1。metadata のみ保存
- Git: isomorphic-git 方向。現在の MVP では snapshot diff helper も利用
- AI: Recorded AI demo、WebLLM path、Ollama fallback
- Runtime: WebContainer candidate、recorded fallback
- Local storage: File System Access API と IndexedDB

## プライバシールール

D1 に保存してはいけないもの:

- source code text
- diff text
- GitHub token
- LLM prompt 全文
- private file content

D1 に保存してよいもの:

- session metadata
- repository metadata
- branch name
- AI action summary
- patch proposal status
- safety gate result
- PR URL

## 現在の境界

実装済み:

- IDE shell
- demo repo
- Monaco editor / diff editor
- local snapshot loading
- IndexedDB restore
- Patch Queue
- Safety Gate
- GitHub Worker API boundary
- demo PR flow

demo または boundary の段階:

- GitHub push
- UI 上の real GitHub App installation flow
- real WebLLM model loading
- real Ollama connection
- real WebContainer execution
- isomorphic-git filesystem integration

## 実装ルール

機能を実装するときは、まず `docs/agents/issue-tracker.md` に local issue を作成または更新します。その issue の scope、受け入れ条件、検証に沿って実装します。

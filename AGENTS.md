# Git AI IDE エージェントガイド

## プロジェクトの目的

Git AI IDE は、Git の Branch to PR workflow を前提にした、AI 支援つきブラウザ IDE です。

目指しているのは「AI が勝手にコードを書き換える IDE」ではありません。LLM の出力を、Git の文脈、差分確認、テスト、PR 作成の流れに安全に載せることが目的です。

基本原則:

> LLM は提案する。IDE は検証する。ユーザーが適用する。Git が記録する。

## コマンド

- 依存関係のインストール: `pnpm install`
- Web 開発サーバー: `pnpm dev`
- Worker 開発サーバー: `pnpm dev:worker`
- 型チェック: `pnpm typecheck`
- テスト: `pnpm test`
- ビルド: `pnpm build`

## 技術構成

- パッケージマネージャー: pnpm
- 実行環境: Node.js 24 LTS
- Web アプリ: React + TypeScript + Vite
- Worker: Cloudflare Workers
- DB: Cloudflare D1。保存対象は workflow metadata のみ
- Editor: Monaco Editor
- Git: isomorphic-git を最終方針にし、MVP では snapshot diff helper も使う
- AI: WebLLM を primary、Ollama を first-class fallback
- Runtime: WebContainer を候補にし、未対応環境では recorded fallback

## 安全ルール

- D1 に code text、diff text、GitHub token、LLM prompt 全文、private file content を保存しない。
- AI の修正は Structured Edit Operation、Patch Queue、Diff Preview を通す。
- GitHub 連携はユーザーが選択した repository のみに限定する。
- cloud LLM inference を必須経路にしない。
- workspace data は local-first を基本にする。
- demo mode は demo と明示し、本物の GitHub/WebLLM/Ollama/WebContainer 実行として説明しない。

## ディレクトリ構成

- `apps/web`: ブラウザ IDE
- `apps/worker`: GitHub auth/proxy と D1 metadata API を担当する Cloudflare Worker
- `packages/shared`: 共有型
- `packages/ai-runtime`: AI provider abstraction
- `packages/patch-core`: Structured Edit Operation の検証と patch helper
- `packages/git-core`: Git workflow の型と helper
- `docs`: 開発、設計、運用メモ

## エージェント作業フロー

このリポジトリは issue-first の agentic engineering workflow で進めます。

- プロダクトの挙動を変える前に `CONTEXT.md` を読む。
- GitHub Issues と同期するため、`docs/agents/issue-tracker.md` をローカル Issue 管理として使う。
- プロダクト用語、安全ルール、architecture boundary は `docs/agents/domain.md` を参照する。
- 作業を分類するときは `docs/agents/triage-labels.md` を使う。
- 重要な機能追加や設計変更の前に、scope、acceptance criteria、verification を issue に書く。
- ユーザーがチャット往復を減らしたい場合は、関連する作業を coherent task としてまとめて進める。
- 小さく縦に切る方針は維持しつつ、途中で止まる必要があるのは仕様判断、危険な操作、外部認証、破壊的変更が必要な場合に限る。

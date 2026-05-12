# 完成までの残り機能

Git AI IDE の完成定義は「AI と相談しながら、GitHub repo を開き、小さな変更を安全に作り、動作確認し、PR まで進められること」です。

## 現在の MVP 状態

### 完了

- IDE layout: Activity Bar / Explorer / Editor / AI Assistant / bottom panel
- Explorer folder tree
- Editor tabs
- Search panel
- Source Control diff
- Branch Goal / Assisted Memory
- Context budget / priority tiers
- Patch Queue / Safety Checklist
- Structured Edit Operation validation
- Monaco Diff Preview
- Runtime Plan
- Local Preview panel
- Local Preview tab / URL bar
- WebContainer preflight checklist
- PR 作成前 Safety Gate
- GitHub Integration panel
- GitHub App local real E2E
- selected repo の branch 作成 / branch push / PR 作成
- GitHub PR Flow readiness checklist
- WebLLM runtime / unavailable reason 表示
- 複数案 Patch Queue / reject / failed reason
- WebLLM model catalog / device-aware routing
- WebLLM load 失敗 model の端末別非表示
- WebLLM npm dependency 化
- Cloudflare Worker API boundary
- D1 schema for workflow metadata
- 日本語の issue / PR / docs 運用

## 残っている実 E2E / 運用確認

現在の優先順は次の通りです。

1. Cloudflare deploy URL での Worker / D1 / GitHub App secrets 結合確認
2. WebContainer iframe preview E2E
3. WebLLM 実モデルロード E2E

Local Preview tab、GitHub 実操作モード導線、GitHub App local real E2E は完了済みです。以降は deploy 環境、WebGPU など、外部環境に依存する E2E です。

### 1. Cloudflare deploy URL 結合確認

目的:
Cloudflare Pages / Workers / D1 / GitHub App secrets を本番相当 URL で接続し、local real E2E と同じ flow が成立することを確認する。

作業:

- Cloudflare Worker に `GITHUB_APP_ID` / `GITHUB_APP_PRIVATE_KEY` / `GITHUB_APP_SLUG` を設定
- D1 migration を適用
- Pages から Worker API に接続
- selected repository で branch push / PR 作成 / issue close keyword を確認

ローカル real E2E は完了済みです。本番公開は最後に行うため、この項目は deploy 直前の確認として残します。

### 2. WebContainer iframe preview E2E

目的:
WebContainer 対応 repo で dev server URL を iframe に接続できることを確認する。

作業:

- cross-origin isolation が有効な deploy 環境を用意
- WebContainer 対応の fixture repo または実 repo を開く
- Local Preview を実行
- WebContainer dev server URL が表示されることを確認
- iframe preview が表示されることを確認

実行 harness:

```bash
GIT_AI_IDE_WEBCONTAINER_E2E=1 pnpm --filter @git-ai-ide/web test:e2e
```

通常 CI では WebContainer install / dev server 起動の揺れを避けるため skip し、cross-origin isolation が有効な環境で明示的に実行します。

### 3. WebLLM 実モデルロード E2E

目的:
WebGPU 対応ブラウザで、WebLLM runtime が実際に usable になることを確認する。

現在の確認結果:
2026-05-12 時点の Playwright Chromium では `navigator.gpu` は検出しました。現在は CDN dynamic import をやめ、`@mlc-ai/web-llm` を npm dependency として bundle しています。詳細は [Runtime 実機確認ログ](runtime-real-e2e-check.md) に記録しています。

作業:

- 対応端末で WebGPU を有効化
- model loading boundary の UX を確認
- WebGPU adapter / storage quota / task priority に応じて候補が絞られることを確認
- load 失敗済み model が次回候補から外れることを確認
- 小さな patch proposal / summary task を実行
- 失敗時に WebLLM unavailable reason が出ることを確認

実行 harness:

```bash
GIT_AI_IDE_WEBLLM_E2E=1 pnpm --filter @git-ai-ide/web test:e2e
```

通常 CI では WebGPU 非対応を前提に fallback 表示を確認し、WebGPU 対応端末でだけ実 model load と completion を必須にします。

## 完成判断

公開前の完成判断としては、実 GitHub repo 接続、WebLLM 利用可否、WebContainer best-effort preview の境界が UI で分かり、simulation を本物の操作として見せない状態です。

本番運用品質としては、上記の実 E2E を完了し、GitHub App credentials を設定した deploy URL で確認できる状態を完成とします。

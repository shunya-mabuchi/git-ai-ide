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
- WebContainer preflight checklist
- PR 作成前 Safety Gate
- GitHub Integration panel
- GitHub PR Flow readiness checklist
- Recorded AI fallback
- Ollama Patch Proposal request boundary
- Ollama E2E diagnostic UI
- Cloudflare Worker API boundary
- D1 schema for workflow metadata
- 日本語の issue / PR / docs 運用

## 残っている実 E2E

現在の優先順は次の通りです。

1. Local Preview tab 化
2. GitHub 実操作モード導線
3. GitHub App 実 credentials E2E
4. WebContainer iframe preview E2E
5. Ollama 実 runtime E2E
6. WebLLM 実モデルロード E2E

Local Preview tab 化と GitHub 実操作モード導線は完了済みです。以降は外部 credentials または実 runtime が必要な E2E です。

### 1. GitHub App 実 credentials E2E

目的:
selected repository だけに対して branch push と PR creation が動くことを確認する。

作業:

- Cloudflare Worker に `GITHUB_APP_ID` / `GITHUB_APP_PRIVATE_KEY` / `GITHUB_APP_SLUG` を設定
- GitHub App を test repo に install
- installation 一覧と repository 一覧を UI で確認
- branch push
- PR 作成
- issue close keyword の動作確認

現在の blocker:

- `apps/worker/.dev.vars` が未作成
- GitHub App の実 `GITHUB_APP_ID` / `GITHUB_APP_PRIVATE_KEY` / `GITHUB_APP_SLUG` が未設定
- Cloudflare deploy 確認をする場合は Wrangler login が未完了

ローカル E2E は GitHub App credentials と Worker 起動だけで進められます。Cloudflare deploy E2E は Wrangler login と Worker secret 設定が必要です。

### 2. WebContainer iframe preview E2E

目的:
WebContainer 対応 repo で dev server URL を iframe に接続できることを確認する。

作業:

- cross-origin isolation が有効な deploy 環境を用意
- Vite demo repo を開く
- Local Preview を実行
- WebContainer dev server URL が表示されることを確認
- iframe preview が表示されることを確認

実行 harness:

```bash
GIT_AI_IDE_WEBCONTAINER_E2E=1 pnpm --filter @git-ai-ide/web test:e2e
```

通常 CI では WebContainer install / dev server 起動の揺れを避けるため skip し、cross-origin isolation が有効な環境で明示的に実行します。

### 3. Ollama 実 runtime E2E

目的:
localhost の Ollama から Patch Proposal を生成し、schema validation を通して Patch Queue に入ることを確認する。

作業:

- `ollama serve`
- 対応 model を pull
- Ollama E2E 診断を実行
- `mode: ollama` と model id が表示されることを確認
- invalid response 時に fallback できることを確認

### 4. WebLLM 実モデルロード E2E

目的:
WebGPU 対応ブラウザで、WebLLM runtime が実際に usable になることを確認する。

作業:

- 対応端末で WebGPU を有効化
- model loading boundary の UX を確認
- 小さな patch proposal / summary task を実行
- 失敗時に Recorded AI fallback が出ることを確認

実行 harness:

```bash
GIT_AI_IDE_WEBLLM_E2E=1 pnpm --filter @git-ai-ide/web test:e2e
```

通常 CI では WebGPU 非対応を前提に fallback 表示を確認し、WebGPU 対応端末でだけ実 model load と completion を必須にします。

## 完成判断

公開デモとしては、demo mode で一連の flow を確認でき、実 runtime は diagnostic / preflight / fallback として境界が見えている状態です。

本番運用品質としては、上記の実 E2E を完了し、GitHub App credentials を設定した deploy URL で確認できる状態を完成とします。

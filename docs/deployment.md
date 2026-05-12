# Git AI IDE デプロイ手順

Git AI IDE は、公開後も無料で維持しやすいことを前提に Cloudflare Pages / Workers / D1 を使います。

## 構成

- `apps/web`: Cloudflare Pages に配置する SPA
- `apps/worker`: GitHub App proxy と workflow metadata API
- `packages/*`: web / worker から共有する workspace packages
- Cloudflare D1: PR flow session や created PR metadata を保存する DB

## 前提

- Cloudflare account
- GitHub repository: `shunya-mabuchi/git-ai-ide`
- Node.js 24 LTS
- pnpm
- Wrangler

```bash
pnpm install
pnpm -r typecheck
pnpm --filter @git-ai-ide/web build
pnpm --filter @git-ai-ide/worker build
```

## 1. D1 database を作成する

```bash
pnpm --filter @git-ai-ide/worker exec wrangler d1 create git-ai-ide
```

作成された database id を `apps/worker/wrangler.toml` の D1 binding に設定します。

Migration:

```bash
pnpm --filter @git-ai-ide/worker exec wrangler d1 migrations apply git-ai-ide --remote
```

## 2. Worker を deploy する

GitHub App をまだ設定しない場合でも deploy できます。その場合、Worker は demo mode を返します。

```bash
pnpm --filter @git-ai-ide/worker exec wrangler deploy
```

GitHub App を使う場合は、Worker secret に設定します。

```bash
pnpm --filter @git-ai-ide/worker exec wrangler secret put GITHUB_APP_ID
pnpm --filter @git-ai-ide/worker exec wrangler secret put GITHUB_APP_PRIVATE_KEY
pnpm --filter @git-ai-ide/worker exec wrangler secret put GITHUB_APP_SLUG
```

秘密鍵は PKCS#8 PEM を使います。ブラウザ側には置きません。

## 3. Pages を deploy する

Cloudflare Pages の設定例:

- Build command: `pnpm --filter @git-ai-ide/web build`
- Build output directory: `apps/web/dist`
- Root directory: repository root
- Node version: `.node-version` に合わせる

Worker URL を Pages の環境変数に設定します。

```txt
VITE_GIT_AI_IDE_WORKER_URL=https://<worker-name>.<account>.workers.dev
```

`apps/web/public/_headers` で `Cross-Origin-Opener-Policy: same-origin` と `Cross-Origin-Embedder-Policy: require-corp` を配信します。これは WebContainer iframe preview に必要な cross-origin isolation を有効にするためです。

## 4. GitHub App を設定する

GitHub App は selected repository のみを対象にします。

必要な repository permissions:

- Contents: Read and write
- Metadata: Read-only
- Pull requests: Read and write

Callback / install まわりの詳細は [GitHub App セットアップ](github-app-setup.md) を参照してください。

## 5. 無料維持の理由

- LLM 推論をサーバーで実行しない
- WebLLM はユーザーのブラウザで実行する
- Recorded AI fallback は setup なしで実行する
- Worker は GitHub proxy と metadata API に限定する
- D1 には code / diff / prompt 全文を保存しない
- Demo mode は外部 API なしで動く

## 6. deploy 後の確認

1. Pages URL を開く
2. Demo repo が表示される
3. Patch Queue と Diff Preview が動く
4. Local Preview panel に preflight が表示される
5. Browser isolation が pass になり、`cross-origin isolation と SharedArrayBuffer が有効です。` と表示される
6. WebContainer 対応 repo で Local Preview を実行し、Preview tab 内に dev server iframe が表示される
7. GitHub Integration が demo mode または GitHub App mode を表示する
8. Worker `/health` が `ok: true` を返す
9. GitHub App mode の場合、installation と repository が選択できる

## 既知の制約

- WebContainer は cross-origin isolation とブラウザ対応状況に依存します
- WebLLM は端末性能と WebGPU 対応状況に依存します
- WebLLM が使えない端末では Recorded AI fallback に切り替わります
- 任意 repo の runtime checks は best effort です

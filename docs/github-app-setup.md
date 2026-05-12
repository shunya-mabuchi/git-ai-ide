# GitHub App セットアップ

Git AI IDE は GitHub App を使い、選択された repository のみ操作します。

## 必要な権限

Repository permissions:

- Contents: Read and write
- Pull requests: Read and write
- Metadata: Read-only

Subscribe events は MVP では不要です。

## GitHub App を作成する

GitHub の Developer settings で GitHub App を作成します。

- App name: 任意。例: `git-ai-ide-dev`
- Homepage URL: ローカル検証では `http://127.0.0.1:5173`
- Callback URL: MVP では未使用。ローカル検証では `http://127.0.0.1:5173`
- Webhook: MVP では不要なので無効でよい
- Repository access: `Only select repositories`

作成後に次の値を控えます。

- App ID
- App slug
- Private key

Private key は GitHub App の設定画面から生成します。生成した秘密鍵は repository に commit しません。

## ローカル開発

`apps/worker/.dev.vars` を作成します。

```txt
GITHUB_APP_ID="123456"
GITHUB_APP_SLUG="git-ai-ide-dev"
GITHUB_APP_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
```

秘密鍵は Cloudflare Worker の secret として扱います。ブラウザ側には置きません。

Worker の WebCrypto では PKCS#8 形式の `-----BEGIN PRIVATE KEY-----` を想定しています。
`-----BEGIN RSA PRIVATE KEY-----` の場合は PKCS#8 に変換してから設定します。

Worker を起動します。

```bash
pnpm dev:worker
```

別 terminal で Web app を起動します。

```bash
pnpm dev
```

Web app から `http://127.0.0.1:8787/api/github/setup` を読めると、GitHub Integration の setup checklist が Worker connection を完了扱いにします。

## Worker API 一覧

- `GET /api/github/setup`
- `GET /api/github/install-url`
- `GET /api/github/installations`
- `GET /api/github/repos?installation_id=...`
- `POST /api/github/push-files`
- `POST /api/github/prs`

secret 未設定時は demo mode を返します。これにより、GitHub App install なしでも Branch to PR flow を確認できます。

## 実 credentials E2E の確認手順

1. GitHub App を対象 repository のみに install する
2. `apps/worker/.dev.vars` に `GITHUB_APP_ID`、`GITHUB_APP_SLUG`、`GITHUB_APP_PRIVATE_KEY` を設定する
3. `pnpm dev:worker` で Worker を起動する
4. `pnpm dev` で Web app を起動する
5. GitHub Integration で installation と repository を選択する
6. Branch Goal を設定し、作業 branch を作成する
7. Patch Queue の Safety Checklist を満たす
8. Branch push を実行し、GitHub 上に branch が作成されることを確認する
9. PR を作成し、PR URL が表示されることを確認する
10. PR body に `Closes #<issue番号>` が入り、merge 後に対象 issue が close されることを確認する

期待する状態:

- `/api/github/setup` が `appConfigured: true` を返す
- `/api/github/installations` が installation を返す
- `/api/github/repos?installation_id=...` が selected repository を返す
- GitHub Integration が `Demo mode / no GitHub write operation` ではなく `GitHub App configured / selected repo mode` を表示する

## Cloudflare に deploy して確認する場合

Cloudflare 上で確認する場合は、先に Wrangler の認証が必要です。

```bash
pnpm --filter @git-ai-ide/worker exec wrangler login
```

その後、Worker secret に設定します。

```bash
pnpm --filter @git-ai-ide/worker exec wrangler secret put GITHUB_APP_ID
pnpm --filter @git-ai-ide/worker exec wrangler secret put GITHUB_APP_PRIVATE_KEY
pnpm --filter @git-ai-ide/worker exec wrangler secret put GITHUB_APP_SLUG
```

ローカル E2E だけなら Cloudflare login は必須ではありません。deploy URL で WebContainer iframe preview まで確認する場合は、Cloudflare Pages / Workers 側の設定も必要です。

## 現在の制約

`POST /api/github/push-files` は、base branch から feature branch を作成し、変更された text file を GitHub Contents API で commit します。

次に本物化する作業:

1. より大きな binary / rename / conflict case の扱い
2. Git data API による複数ファイル 1 commit 化
3. 実 GitHub App credentials で end-to-end 検証

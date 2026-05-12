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

Node.js で変換する例:

```bash
node -e "const fs=require('fs'); const crypto=require('crypto'); const input='private-notes/secrets/git-ai-ide.private-key.pem'; const output='private-notes/secrets/git-ai-ide.pkcs8.private-key.pem'; const key=crypto.createPrivateKey(fs.readFileSync(input,'utf8')); fs.writeFileSync(output, key.export({type:'pkcs8',format:'pem'}));"
```

`.pem` は repository に commit せず、`private-notes/secrets` など `.gitignore` 済みの場所に置きます。

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
3. local D1 に migration を適用する
4. `pnpm dev:worker` で Worker を起動する
5. `pnpm dev` で Web app を起動する
6. GitHub Integration で installation と repository を選択する
7. Branch Goal を設定し、作業 branch を作成する
8. Patch Queue の Safety Checklist を満たす
9. Branch push を実行し、GitHub 上に branch が作成されることを確認する
10. PR を作成し、PR URL が表示されることを確認する
11. PR body に `Closes #<issue番号>` が入り、merge 後に対象 issue が close されることを確認する

local D1 migration:

```bash
pnpm --filter @git-ai-ide/worker exec wrangler d1 migrations apply git-ai-ide --local
```

期待する状態:

- `/api/github/setup` が `appConfigured: true` を返す
- `/api/github/installations` が installation を返す
- `/api/github/repos?installation_id=...` が selected repository を返す
- GitHub Integration が `Demo mode / no GitHub write operation` ではなく `GitHub App configured / selected repo mode` を表示する

同じ確認を script で実行できます。

```bash
pnpm --filter @git-ai-ide/worker test:github-real
```

この command は、書き込みをしない read-only smoke test として `/api/github/setup`、`/api/github/installations`、`/api/github/repos` を確認します。

Web UI 側の Playwright harness も secret なしの通常 CI では skip されます。実 credentials を設定した環境だけ、次のように有効化します。

```bash
GIT_AI_IDE_REAL_GITHUB_E2E=1 VITE_GIT_AI_IDE_WORKER_URL=http://127.0.0.1:8787 pnpm --filter @git-ai-ide/web test:e2e
```

この harness は Web app と同じ Worker URL に対して setup / installations / repositories を確認し、selected repository mode へ入れる前提を自動検証します。

実績:

- `installation_id: 131652249`
- selected repository: `shunya-mabuchi/git-ai-ide`
- PR #79 を Worker API から作成
- PR #79 merge 後、`Closes #77` により issue #77 が close 済み

branch push と PR 作成まで確認する場合だけ、明示的に書き込みを有効にします。

```bash
GITHUB_E2E_WRITE=1 \
GITHUB_E2E_REPOSITORY=owner/repo \
GITHUB_E2E_ISSUE_NUMBER=54 \
pnpm --filter @git-ai-ide/worker test:github-real
```

必要に応じて次の環境変数で対象を固定できます。

- `GIT_AI_IDE_WORKER_URL`: Worker URL。既定値は `http://127.0.0.1:8787`
- `GITHUB_E2E_INSTALLATION_ID`: installation を固定する
- `GITHUB_E2E_REPOSITORY`: repository を固定する
- `GITHUB_E2E_BASE_BRANCH`: base branch を固定する
- `GITHUB_E2E_BRANCH`: 作成する branch 名を固定する
- `GITHUB_E2E_WRITE`: `1` のときだけ branch push / PR 作成を行う

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

# GitHub App セットアップ

Git AI IDE は GitHub App を使い、選択された repository のみ操作します。

## 必要な権限

Repository permissions:

- Contents: Read and write
- Pull requests: Read and write
- Metadata: Read-only

Subscribe events は MVP では不要です。

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

## Worker API

- `GET /api/github/setup`
- `GET /api/github/install-url`
- `GET /api/github/installations`
- `GET /api/github/repos?installation_id=...`
- `POST /api/github/push-files`
- `POST /api/github/prs`

secret 未設定時は demo mode を返します。これにより、ポートフォリオ閲覧者は GitHub App install なしでも Branch to PR flow を確認できます。

## 現在の制約

`POST /api/github/push-files` は、base branch から feature branch を作成し、変更された text file を GitHub Contents API で commit します。

次に本物化する作業:

1. より大きな binary / rename / conflict case の扱い
2. Git data API による複数ファイル 1 commit 化
3. 実 GitHub App credentials で end-to-end 検証

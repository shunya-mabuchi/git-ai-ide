# Git AI IDE

Git AI IDE は、GitHub の Branch to PR workflow をブラウザ IDE 上で進めるための AI 支援ツールです。

目的は「AI にコードを丸投げする」ことではありません。Branch Goal、Context Pack、Structured Edit Operation、Patch Queue、Diff Preview、Safety Gate を通して、AI の提案を Git の作業単位へ落とし込み、人間が確認してから変更を進める体験を作ります。

## 設計上の特徴

- VS Code / Cursor に近い IDE layout を React + Monaco Editor で構築
- Git-aware な状態管理: file tree、tabs、search、diff、source control、branch goal
- AI workflow safety: LLM 出力を structured edit として検証し、diff review 後に適用
- WebLLM + Ollama fallback + Recorded AI による first-class fallback 設計
- WebContainer による Local Preview / Runtime checks の best-effort 実行
- GitHub App / Cloudflare Worker による selected repo only の GitHub Integration
- Cloudflare Pages / Workers / D1 を前提に、公開後も無料で維持しやすい構成
- D1 には code/diff/token を保存せず、workflow metadata のみを保存する privacy-aware 設計

## 現在できること

- Demo repo を開く
- ローカルフォルダを snapshot として開く
- Explorer の folder tree、editor tabs、search で repo を読む
- Branch Goal / Assisted Memory を Markdown として編集する
- Context budget と task priority を確認する
- Recorded AI / WebLLM / Ollama の runtime を検出する
- Ollama E2E 診断で、実 runtime か fallback かを確認する
- AI patch proposal を Patch Queue に入れる
- Structured Edit Operation を検証し、Diff Preview で確認してから適用する
- Runtime Plan から test / typecheck / dev / preview command を検出する
- Local Preview tab で recorded fallback または URL bar から localhost preview を確認する
- PR 作成前 Safety Gate で Diff / Tests / Local Preview / Commit / Push / PR draft を確認する
- GitHub App credentials がある場合は selected repo の branch 作成 / push / PR 作成を実行する
- credentials がない場合も demo mode で Branch to PR flow を確認する

## ローカル開発

このリポジトリは `C:\Users\shuny\projects\git-ai-ide` のような通常の projects 配下で Git 管理する想定です。

```bash
pnpm install
pnpm dev
```

Web app:

```txt
http://127.0.0.1:5173
```

Worker:

```bash
pnpm dev:worker
```

```txt
http://127.0.0.1:8787
```

Docker は必須にしていません。WebGPU、File System Access API、WebContainer、localhost の Ollama access は、ホストブラウザとホスト OS の機能に強く依存するためです。チーム開発では Node / pnpm / Wrangler のバージョンを `.node-version`、`packageManager`、docs でそろえ、必要になった時点で devcontainer を追加する方針です。

## 検証コマンド

```bash
pnpm --filter @git-ai-ide/shared test
pnpm --filter @git-ai-ide/web test
pnpm -r typecheck
pnpm --filter @git-ai-ide/web build
pnpm test:e2e:install
pnpm --filter @git-ai-ide/web test:e2e
```

`pnpm test:e2e:install` は Playwright Chromium の初回インストール用です。CI でも同じ順序で typecheck / unit test / build / E2E を実行します。

## 無料公開の方針

- Frontend: Cloudflare Pages
- API / GitHub proxy: Cloudflare Workers
- Metadata DB: Cloudflare D1
- AI inference: WebLLM またはユーザー環境の Ollama
- Demo fallback: Recorded AI

サーバー側で有料 LLM API を呼ばないため、公開後に利用者数が増えても LLM API コストが発生しにくい構成です。詳しくは [デプロイ手順](docs/deployment.md) を参照してください。

## D1 に保存するもの、保存しないもの

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

## 設計上の要点

1. 小さなブラウザ LLM の制約を前提に、Context Pack と structured edit で task を小さくした
2. AI の出力を直接適用せず、Patch Queue と Diff Preview を必須にした
3. GitHub App を使い、selected repo only の権限にした
4. WebContainer は万能ではないため、preflight と fallback reason を UI に出した
5. Cloudflare Pages / Workers / D1 に寄せ、無料公開と backend 境界を両立した
6. Demo mode を first-class にして、GitHub App や WebLLM が未設定でも価値を見せられるようにした

## ドキュメント

- [ドキュメント一覧](docs/README.md)
- [デプロイ手順](docs/deployment.md)
- [開発環境](docs/development.md)
- [MVP 実装状況](docs/mvp-implementation-status.md)
- [完成までの残り機能](docs/completion-roadmap.md)
- [GitHub App セットアップ](docs/github-app-setup.md)

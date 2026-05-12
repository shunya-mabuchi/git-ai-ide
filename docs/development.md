# Git AI IDE 開発手順

## 前提

- Node.js 24 LTS
- pnpm 10.33.4
- Cloudflare Wrangler
- Chrome または Edge
- Ollama は optional

Docker は初期開発では必須にしません。WebGPU、File System Access API、WebContainer、Ollama はホストブラウザやホスト OS との関係が強いためです。

## セットアップ

```bash
pnpm install
```

## Web app

```bash
pnpm dev
```

デフォルト URL:

```txt
http://127.0.0.1:5173
```

## Worker 開発サーバー

```bash
pnpm dev:worker
```

デフォルト URL:

```txt
http://127.0.0.1:8787
```

## 確認コマンド

```bash
pnpm typecheck
pnpm test
pnpm build
```

## Ollama fallback の起動

Ollama はホストで起動します。

```bash
ollama serve
```

Git AI IDE は `http://localhost:11434` を fallback runtime として扱います。

実 runtime E2E は、Ollama 起動済みかつ model pull 済みの環境で実行します。

```bash
ollama pull qwen2.5-coder:7b
OLLAMA_E2E_MODEL=qwen2.5-coder:7b pnpm --filter @git-ai-ide/ai-runtime test:ollama-real
```

環境変数:

- `OLLAMA_BASE_URL`: 既定値は `http://localhost:11434`
- `OLLAMA_E2E_MODEL`: 利用する model。未指定なら `/api/tags` の先頭を使います
- `OLLAMA_E2E_TIMEOUT_MS`: 既定値は `60000`

この E2E は Ollama `/api/tags` と `/api/generate` を実際に呼び、`mode: ollama` の Patch Proposal 形式を検証します。Ollama 未起動または model 未取得の場合は、先に `ollama serve` と `ollama pull` を実行してください。

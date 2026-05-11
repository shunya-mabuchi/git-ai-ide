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

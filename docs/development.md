# Git AI IDE 開発手順

## 前提

- Node.js 24 LTS
- pnpm 10.33.4
- Cloudflare Wrangler
- Chrome または Edge
- Ollama は主機能から外した optional / legacy diagnostic

Docker は初期開発では必須にしません。WebGPU、File System Access API、WebContainer はホストブラウザやホスト OS との関係が強いためです。

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

## Ollama legacy diagnostic

Ollama は現時点では主機能ではなく、削除候補の legacy diagnostic として残しています。通常の UI では WebLLM / Recorded AI を使います。

```bash
ollama serve
```

Git AI IDE の通常ルーティングは `http://localhost:11434` を自動推奨しません。

実 runtime E2E は、Ollama 起動済みかつ model pull 済みの環境で実行します。

```bash
ollama pull qwen2.5-coder:7b
OLLAMA_E2E_MODEL=qwen2.5-coder:7b pnpm --filter @git-ai-ide/ai-runtime test:ollama-real
```

Ollama 未起動の通常環境では `mode: recorded` と fallback reason を表示して終了します。
実 runtime を必須にしたい場合だけ、次のようにします。

```bash
OLLAMA_E2E_REQUIRED=1 OLLAMA_E2E_MODEL=qwen2.5-coder:7b pnpm --filter @git-ai-ide/ai-runtime test:ollama-real
```

環境変数:

- `OLLAMA_BASE_URL`: 既定値は `http://localhost:11434`
- `OLLAMA_E2E_MODEL`: 利用する model。未指定なら `/api/tags` の先頭を使います
- `OLLAMA_E2E_REQUIRED`: `1` のときだけ実 Ollama 未接続を失敗扱いにします
- `OLLAMA_E2E_TIMEOUT_MS`: 既定値は `60000`

この E2E は Ollama `/api/tags` と `/api/generate` を実際に呼び、`mode: ollama` の Patch Proposal 形式を検証します。

## WebLLM 実モデルロード

WebLLM は WebGPU 対応ブラウザで確認します。Git AI IDE の `Model Routing` から `WebLLM model load 診断` を実行すると、WebGPU 非対応環境では recorded fallback と理由を表示し、対応環境では npm dependency として bundle した `@mlc-ai/web-llm` で model load と短い chat completion を確認します。CDN dynamic import には依存しません。

既定の確認 model:

```txt
Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC
```

Model Routing は WebGPU adapter、推定 storage quota、task priority、branch 状態から候補を絞ります。端末に合わない model は通常候補から外し、実 load に失敗した model は次回以降の候補から下げる設計です。

初回は model download と cache に時間がかかります。WebLLM の公式 docs では `CreateMLCEngine()` で model を読み込み、OpenAI 互換の `chat.completions.create()` で completion を実行します。

通常 CI では WebGPU がないため fallback 診断だけを確認します。
実 model load を必須にする場合は、WebGPU 対応ブラウザで次を実行します。

```bash
GIT_AI_IDE_WEBLLM_E2E=1 pnpm --filter @git-ai-ide/web test:e2e
```

この harness は `mode: webllm`、model id、completion を確認します。

# Runtime 実機確認ログ

最終更新: 2026-05-12

Git AI IDE の WebLLM / Ollama runtime は、端末、ブラウザ、ローカル daemon、network access に依存します。このファイルでは、実機確認の結果と次に成功させるための手順を記録します。

## Ollama 実生成確認

- 状態: 未確認
- 実行コマンド: `node packages/ai-runtime/scripts/ollama-real-e2e.mjs`
- 結果: `mode: recorded`
- 理由: `fetch failed`
- 追加確認:
  - `ollama --version` は、この PowerShell session では `command not found`
  - `http://127.0.0.1:11434/api/tags` は接続不可

この環境では Ollama が未インストール、未起動、または PATH に入っていないため、実 model による Patch Proposal 生成までは確認できていません。

成功させる手順:

```powershell
ollama serve
ollama pull qwen2.5-coder:7b
$env:OLLAMA_E2E_MODEL="qwen2.5-coder:7b"
$env:OLLAMA_E2E_REQUIRED="1"
node packages\ai-runtime\scripts\ollama-real-e2e.mjs
```

成功条件:

- `mode: ollama` が表示される
- `proposal ok:` が表示される
- structured edit の `find` が対象ファイルに存在する

## WebLLM 実モデルロード確認

- 状態: 未確認
- 実行コマンド: `GIT_AI_IDE_WEBLLM_E2E=1` 相当で `apps/web/tests/e2e/webllm-real.spec.ts` を実行
- 結果: `mode: recorded`
- model: `Qwen2.5-0.5B-Instruct-q4f16_1-MLC`
- 理由: `Failed to fetch dynamically imported module: https://esm.run/@mlc-ai/web-llm`

Playwright Chromium では `navigator.gpu` は検出されましたが、WebLLM SDK を CDN から dynamic import する段階で失敗しました。これは WebGPU 非対応ではなく、WebLLM module の取得経路が成立していない状態です。

成功させる手順:

```powershell
cd apps\web
$env:GIT_AI_IDE_WEBLLM_E2E="1"
.\node_modules\.bin\playwright.CMD test tests/e2e/webllm-real.spec.ts --project=chromium
```

成功条件:

- diagnostic log に `mode: webllm` が表示される
- model id が表示される
- `completion:` が表示される

次の改善候補:

- `@mlc-ai/web-llm` を npm dependency として bundle し、CDN dynamic import への依存を減らす
- CDN を使う場合は deploy 環境の network / CSP / COEP / COOP を確認する
- model cache UX と loading progress を、本番 URL 上で再確認する

## 現時点の判断

本番公開前 MVP としては、WebLLM / Ollama の fallback reason と E2E harness は用意済みです。

ただし、2026-05-12 時点のこの端末では、Ollama 実生成と WebLLM 実モデルロードは未確認です。公開前に上記手順で再実行し、成功した場合はこのファイルの状態を `確認済み` に更新します。

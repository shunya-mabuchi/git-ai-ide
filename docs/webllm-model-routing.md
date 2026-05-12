# WebLLM model routing

Git AI IDE は、WebLLM の model を 1 つに固定しません。ユーザーの PC 性能、task、失敗履歴を見て、候補を少数に絞って表示します。

## 方針

- WebLLM は残し、`@mlc-ai/web-llm` を npm dependency として bundle する
- CDN dynamic import には依存しない
- Qwen だけに固定せず、Qwen / Gemma / Phi などの候補を catalog として持つ
- 重いのに性能上の理由が弱い model は通常候補に出さない
- 端末 tier に合わない model は通常表示から外す
- 実 load に失敗した model は次回以降の優先度を下げる
- Ollama は主機能から外し、legacy diagnostic として扱う

## 端末判定

ブラウザ内で次を確認します。

- `navigator.gpu`
- WebGPU adapter 情報
- WebGPU limits
- storage quota
- `crossOriginIsolated`

この情報から `low` / `mid` / `high` / `none` の device tier を作ります。正確な GPU memory を常に取得できるわけではないため、判定は best-effort です。

## 候補の絞り込み

Model catalog には次を持たせます。

- family
- model id
- license
- download size estimate
- minimum device tier
- task suitability
- code score
- Japanese score
- JSON reliability score
- speed score
- stable / experimental status

UI では、現在の task に合う model を最大 4 件程度に絞ります。たとえば patch proposal では code score と JSON reliability を重く見て、PR draft や branch review では Japanese score と context size を重く見ます。

## 表示しないもの

次の model は通常候補から外します。

- 端末 tier に対して大きすぎる model
- task に合わない model
- artifact が未確認で、かつ安定候補が別にある model
- 一度 load に失敗し、同じ端末で再試行しても成功可能性が低い model

## WebContainer との関係

Local Preview の主軸は WebContainer です。ただし WebContainer はすべての repo を再現できるものではありません。native module、private registry、Docker、外部 backend、OS 依存 binary が必要な repo では fallback します。

そのため UI では、WebContainer を `best-effort` と明記し、失敗理由、fallback、diagnostics を表示します。

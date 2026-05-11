# Git AI IDE 環境方針

## Docker について

初期開発では Docker を必須にしません。

理由:

- WebLLM / WebGPU はホストブラウザで確認する
- File System Access API はホストブラウザの挙動が重要
- WebContainer はブラウザ内 runtime
- Ollama はホストで動かしたほうが接続と GPU 利用が分かりやすい
- Codex app から `pnpm dev` を直接実行するほうが速い

チーム開発では、Docker より次を重視します。

- `.node-version`
- `mise.toml`
- `packageManager`
- `pnpm-lock.yaml`
- CI
- docs

## D1 の保存方針

D1 は workflow metadata のみに使います。

保存する:

- session
- repository metadata
- branch name
- AI action summary
- patch proposal status
- safety gate result
- PR URL

保存しない:

- code text
- diff text
- GitHub token
- full LLM prompt
- private file content


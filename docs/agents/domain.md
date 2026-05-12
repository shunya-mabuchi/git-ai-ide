# ドメインメモ

## 共通言語

- **Branch Goal**: その branch で何を達成するかを記述する Markdown。AI に渡す context の中心になる。
- **Context Pack**: AI に渡す bounded context。current file、diff、Branch Goal、Assisted Memory、budget metadata を含む。
- **Patch Proposal**: AI が生成する structured edit proposal。自動適用はしない。
- **Structured Edit Operation**: `file`、`find`、`replacement`、`reason` を持つ安全な編集形式。
- **Patch Queue**: ユーザーが review する前に、提案された edit を保持する場所。
- **Diff Review**: patch apply や commit 前に確認する Monaco diff view。
- **Safety Gate**: Branch Goal、context、model capability、patch review、test、commit draft、PR draft、未解決 warning を確認する soft gate。
- **Recorded AI**: model setup なしでも demo が成立する deterministic fallback。
- **WebLLM**: 小さな task を browser-local model で処理する runtime path。端末性能と task に応じて候補 model を絞る。
- **Ollama legacy diagnostic**: 主機能から外した localhost LLM 検証経路。通常 UI では推奨しない。
- **Runtime Plan**: WebContainer candidate や recorded fallback など、実行可能性を検出した結果。

## 安全原則

- AI は Git history に直接書き込まない。
- AI output はまず structured data として扱う。
- ユーザーは patch apply 前に diff を確認する。
- commit と PR creation は visible check を通す。
- local/private code は、ユーザーが明示的に GitHub integration を使うまで local に留める。

## データの所在

Browser:

- workspace files
- local snapshots
- context pack
- model execution state

Worker / D1:

- workflow metadata
- repository metadata
- PR URL
- safety gate summary

GitHub:

- repository source
- branch
- commit
- PR

## デモ境界

Demo mode は first-class product mode です。setup なしでも安定して review できるようにするために存在します。

ただし、demo は必ず demo と表示します。本物の GitHub、WebLLM、WebContainer 実行として説明してはいけません。

# ローカル Issue 管理

GitHub Issues と同期するためのローカル Issue 管理です。

## Issue テンプレート

```md
## GAI-000: タイトル

- 状態:
- ラベル:
- 担当:
- 背景:
- スコープ:
- 受け入れ条件:
- 検証:
- メモ:
```

## GAI-001: 正式リポジトリ配置と Agent workflow を整備する

- 状態: 完了
- ラベル: `種別:基盤`, `領域:docs`, `領域:workflow-safety`, `優先度:p0`
- 担当: Codex
- 背景: 作業が Codex の会話用ディレクトリから始まったため、正式 repo を `C:\Users\shuny\projects\git-ai-ide` に置き直す必要があった。
- スコープ:
  - 正式 repo 名を `git-ai-ide` にする
  - `CONTEXT.md` を追加
  - ローカル issue tracker を追加
  - triage labels を追加
  - domain notes を追加
  - `AGENTS.md` に Agent workflow を追加
- 受け入れ条件:
  - repo が `C:\Users\shuny\projects\git-ai-ide` にある
  - `AGENTS.md` が context と issue tracker の利用を指示している
  - `docs/agents/issue-tracker.md` がある
  - `docs/agents/triage-labels.md` がある
  - `docs/agents/domain.md` がある
- 検証:
  - shell でファイル存在を確認

## GAI-002: 正式 repo で依存関係と build を検証する

- 状態: 完了
- ラベル: `種別:基盤`, `優先度:p0`
- 担当: Codex
- 背景: 正式 repo は生成物なしでコピーしたため、最終配置先で依存関係と build を検証する必要があった。
- スコープ:
  - `C:\Users\shuny\projects\git-ai-ide` で `pnpm install`
  - `pnpm -r typecheck`
  - web build
  - worker dry-run build
- 受け入れ条件:
  - 依存関係の install が成功する
  - typecheck が通る
  - web build が通る
  - worker dry-run build が通る
- 検証:
  - `pnpm install` 成功
  - `pnpm -r typecheck` 成功
  - `pnpm --filter @git-ai-ide/web build` 成功
  - `pnpm --filter @git-ai-ide/worker build` 成功

## GAI-003: product 名を Git AI IDE に統一する

- 状態: 完了
- ラベル: `種別:ドキュメント`, `領域:docs`, `優先度:p1`
- 担当: Codex
- 背景: repo 名と product 名を `Git AI IDE` に揃える必要があった。
- スコープ:
  - UI/docs を `Git AI IDE` に統一
  - package scope を `@git-ai-ide` に変更
  - root package 名を `git-ai-ide` に変更
- 受け入れ条件:
  - README title が product/repo 名と一致している
  - AGENTS.md と docs が矛盾しない
  - UI brand が意図的に統一されている
- 検証:
  - 旧 product 名と旧 package scope を検索して削除済み

## GAI-004: PR 作成前に GitHub branch へ実 push する

- 状態: 完了
- ラベル: `種別:機能`, `領域:github`, `領域:git`, `優先度:p1`
- 担当: Codex
- GitHub issue: https://github.com/shunya-mabuchi/git-ai-ide/issues/1
- 背景: Worker は branch が存在する前提で PR 作成できるが、branch push が demo mode だった。
- スコープ:
  - workspace の変更を commit 対象に変換
  - GitHub API 経由で branch に push
  - push 後に Worker PR API を呼ぶ
- 受け入れ条件:
  - 選択 repo のみ対象
  - GitHub token をブラウザに保存しない
  - PR 作成が push 済み branch を使う
- 検証:
  - worker dry-run
  - demo repo flow
  - typecheck と build
  - follow-up: GitHub App setup 後に実 credentials で E2E 検証

## GAI-005: WebLLM と Ollama の実 runtime 検出

- 状態: 要整理
- ラベル: `種別:機能`, `領域:ai-runtime`, `優先度:p1`
- 担当: Codex
- GitHub issue: https://github.com/shunya-mabuchi/git-ai-ide/issues/2
- 背景: Model routing UI はあるが、WebLLM/Ollama 実行はまだ boundary/demo mode。
- スコープ:
  - WebGPU を検出
  - WebLLM loading boundary を追加
  - localhost の Ollama を検出
  - Recorded AI fallback を first-class のまま維持
- 受け入れ条件:
  - ユーザーが setup state を見られる
  - 失敗時は Recorded AI に fallback する
  - cloud LLM を必須にしない
- 検証:
  - browser runtime checks
  - typecheck/build

## GAI-006: WebContainer で test/typecheck を実行する

- 状態: 要整理
- ラベル: `種別:機能`, `領域:runtime`, `優先度:p2`
- 担当: Codex
- GitHub issue: https://github.com/shunya-mabuchi/git-ai-ide/issues/3
- 背景: Runtime planner は test/typecheck script を検出するが、実行は recorded mode。
- スコープ:
  - WebContainer install/run boundary を追加
  - 対応 repo で test/typecheck を実行
  - 結果を Safety Gate に渡す
- 受け入れ条件:
  - 非対応 repo では best-effort の説明を表示
  - JS/TS demo repo で recorded または real test path を実行できる
- 検証:
  - browser test
  - typecheck/build

## GAI-008: Markdown ドキュメントを日本語へ統一する

- 状態: 完了
- ラベル: `実装可能`, `種別:ドキュメント`, `領域:docs`, `優先度:p1`
- 担当: Codex
- GitHub issue: https://github.com/shunya-mabuchi/git-ai-ide/issues/4
- 背景: ユーザーが読む Markdown に英語の見出し・説明が残っており、ポートフォリオとして確認するときの理解コストが高い。
- スコープ:
  - `AGENTS.md` を日本語化する
  - `README.md` を日本語化する
  - `CONTEXT.md` を日本語化する
  - `docs/agents/domain.md` を日本語化する
  - 既存 Markdown を見直し、英語が残る箇所は技術名として必要か確認する
- 受け入れ条件:
  - 主要な説明文と見出しが日本語で読める
  - 技術名、API 名、コマンド名は必要に応じて英語のまま残す
  - Agent workflow の運用ルールが日本語で理解できる
- 検証:
  - Markdown 見出し確認済み
  - `pnpm -r typecheck` 成功

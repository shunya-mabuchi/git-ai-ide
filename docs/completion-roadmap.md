# 完成までの残り機能

Git AI IDE の完成定義は「AI と相談しながら、GitHub repo を開き、小さな変更を安全に作り、動作確認し、PR まで進められること」です。

## MVP 完成に必要な機能

### 1. Local Preview

- 状態: 一部完了
- 目的: 変更後のアプリを IDE 内で確認できるようにする
- 必要なこと:
  - `package.json` から `dev` / `preview` / `build` script を検出する
  - Preview tab を bottom panel に追加する
  - WebContainer 対応 repo では dev server を起動する
  - 非対応 repo では確認コマンドと fallback 理由を表示する
  - 残り: 実 repo で WebContainer iframe 表示を E2E 確認する

### 2. AI Patch Proposal の実体化

- 状態: 一部完了
- 目的: recorded demo ではなく、選択ファイルと branch goal を使って patch proposal を生成する
- 必要なこと:
  - Context Pack を structured input として組み立てる
  - Recorded AI / WebLLM / Ollama の provider 境界をそろえる
  - LLM 出力を structured edit schema で検証する
  - patch queue に追加し、diff review 後だけ適用できるようにする
  - 残り: Ollama 実環境 E2E と WebLLM 実行境界を確認する

### 3. Search / Editor の実用補強

- 状態: 一部完了
- 目的: repo を読む体験を IDE として成立させる
- 必要なこと:
  - 検索結果から該当行へジャンプする
  - ファイル追加 / rename / delete を扱う
  - 未保存変更の表示を tab と source control に反映する

### 4. GitHub 実フローの E2E

- 状態: 境界は実装済み、実 credentials 検証が残り
- 目的: 選択 repo の branch 作成、push、PR 作成を実 GitHub App で確認する
- 必要なこと:
  - GitHub App secrets を Cloudflare Worker に設定する
  - installation repo selection の実環境確認
  - PR body に `Closes #N` を含める運用を維持する
  - エラー時の再試行と user-facing message を整える

### 5. Workflow Safety の完成

- 状態: 一部完了
- 目的: AI が勝手に大きな変更を進めない IDE にする
- 必要なこと:
  - Patch Queue の未確認項目を PR 作成前 gate に接続する
  - Local Preview / Tests / Diff Review を safety checklist に反映する
  - branch goal と assisted memory の未設定を warning として扱う

### 6. ポートフォリオ用の仕上げ

- 状態: 未完了
- 目的: 面接で説明しやすい完成物にする
- 必要なこと:
  - README に demo flow を追加する
  - Architecture diagram を追加する
  - 面接用資料に「なぜこの技術選定か」「代替案」「制約」を明記する
  - Cloudflare Pages / Worker / D1 の無料枠前提の deploy 手順を整理する

## 完成の判断基準

- demo repo で Branch Goal から PR 作成まで一通り操作できる
- 任意 repo は best effort で開ける
- JS/TS repo は preview / test / typecheck の確認導線がある
- AI が出した変更は structured edit と diff review を通らないと適用できない
- GitHub issue / PR / docs が日本語で追える
- 無料公開できる構成で deploy 手順が説明できる

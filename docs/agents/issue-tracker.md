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

## GAI-037: File operations の dirty / save / Git diff 同期を完成させる

- 状態: 実装中
- ラベル: `実装可能`, `種別:機能`, `領域:web`, `領域:workflow-safety`, `優先度:p1`
- 担当: Codex
- GitHub issue: https://github.com/shunya-mabuchi/git-ai-ide/issues/70
- 背景: IDE としてファイル作成・改名・削除だけでなく、編集後の未保存状態、保存操作、Git diff との関係が分かる必要がある。
- スコープ:
  - file create / rename / delete に加えて folder create を追加する
  - editor tab / Explorer に未保存状態を表示する
  - 保存 / すべて保存を追加し、保存状態と Git baseline を分離する
  - Git panel の diff 表示が file operation / editor edit と同期することを E2E で確認する
- 受け入れ条件:
  - 編集中のファイルに dirty indicator が出る
  - 保存すると dirty indicator は消えるが Git diff は残る
  - フォルダ作成が Explorer と Git diff に反映される
  - typecheck / unit test / build / E2E が通る
- 検証:
  - `pnpm --filter @git-ai-ide/web typecheck` 成功
  - `pnpm --filter @git-ai-ide/web test` 成功
  - `pnpm --filter @git-ai-ide/web build` 成功
  - `pnpm --filter @git-ai-ide/web test:e2e` 成功

## GAI-038: GitHub PR の issue close linkage と実 E2E harness を追加する

- 状態: 実装中
- ラベル: `実装可能`, `種別:機能`, `領域:github`, `優先度:p1`
- 担当: Codex
- GitHub issue: https://github.com/shunya-mabuchi/git-ai-ide/issues/72
- 背景: GitHub App 実 credentials の完全 E2E は秘密鍵と selected repo install が必要だが、UI 側には PR body へ close keyword を入れる導線と、credentials がある環境だけで走る E2E harness が必要。
- スコープ:
  - GitHub Integration に close issue number の入力を追加する
  - PR 作成 body に `Closes #<issue>` を明示的に入れる
  - credentials が揃った環境でだけ実行する real GitHub E2E test を追加する
  - docs に real E2E の安全な実行手順を追記する
- 受け入れ条件:
  - UI から対象 issue number を設定できる
  - PR 作成時の body に close keyword が入る
  - 通常 CI では secrets なしで skip / demo tests が通る
  - 実 credentials 環境では selected repo / branch / PR flow を検証できる
- 検証:
  - `pnpm --filter @git-ai-ide/web typecheck`
  - `pnpm --filter @git-ai-ide/web test`
  - `pnpm --filter @git-ai-ide/web build`
  - `pnpm --filter @git-ai-ide/web test:e2e`

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

- 状態: 完了
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
  - browser runtime checks 成功
  - `pnpm --filter @git-ai-ide/ai-runtime test` 成功
  - `pnpm -r typecheck` 成功
  - `pnpm --filter @git-ai-ide/web build` 成功
  - PR は GitHub issue #2 に `Closes #2` で紐づける
  - PR #5 を merge 済み

## GAI-006: WebContainer で test/typecheck を実行する

- 状態: 完了
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
  - browser test 成功
  - WebContainer 上で demo repo の `npm run typecheck` / `npm run test` 成功
  - `pnpm --filter @git-ai-ide/web test` 成功
  - `pnpm -r typecheck` 成功
  - `pnpm --filter @git-ai-ide/web build` 成功
  - PR は GitHub issue #3 に `Closes #3` で紐づける
  - PR #6 を merge 済み

## GAI-008: Markdown ドキュメントを日本語へ統一する

- 状態: 完了
- ラベル: `実装可能`, `種別:ドキュメント`, `領域:docs`, `優先度:p1`
- 担当: Codex
- GitHub issue: https://github.com/shunya-mabuchi/git-ai-ide/issues/4
- 背景: ユーザーが読む Markdown に英語の見出し・説明が残っており、公開ドキュメントとして確認するときの理解コストが高い。
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

## GAI-009: GitHub App installation と repo 選択 flow を整える

- 状態: 完了
- ラベル: `実装可能`, `種別:機能`, `領域:github`, `優先度:p1`
- 担当: Codex
- GitHub issue: https://github.com/shunya-mabuchi/git-ai-ide/issues/7
- 背景: Worker は GitHub App 設定済みの場合、`/api/github/repos` に `installation_id` を要求している。一方で Web UI は installation 一覧を取得せずに repo 一覧を読みに行くため、実 GitHub App 接続時の selected repo flow が成立しない。
- スコープ:
  - Web client に installation 一覧取得を追加する
  - 選択 installation に紐づく repo 一覧を取得する
  - UI で installation / repository を選べるようにする
  - demo mode の fallback は維持する
- 受け入れ条件:
  - GitHub App configured 時に installation を選択できる
  - 選択 installation の repository だけが選択肢に出る
  - demo mode では従来通り `demo/pr-helper-mini` が使える
- 検証:
  - `pnpm -r typecheck` 成功
  - `pnpm --filter @git-ai-ide/web build` 成功
  - demo mode browser 確認成功
  - PR は GitHub issue #7 に `Closes #7` で紐づける
  - PR #8 を merge 済み

## GAI-010: Explorer をフォルダ階層表示にする

- 状態: 完了
- ラベル: `実装可能`, `種別:機能`, `領域:web`, `優先度:p1`
- 担当: Codex
- GitHub issue: https://github.com/shunya-mabuchi/git-ai-ide/issues/9
- 背景: Explorer が file path を平らに並べており、実際の IDE のように folder hierarchy を把握できない。Git project を開く体験として、フォルダの開閉と階層表示が必要。
- スコープ:
  - file path から Explorer tree を構築する
  - folder / file を階層表示する
  - folder を開閉できるようにする
  - 選択中 file を tree 上で active 表示する
  - demo repo / local directory snapshot の両方で動作する
- 受け入れ条件:
  - `src/features/...` が folder 階層として表示される
  - folder をクリックすると開閉できる
  - file をクリックすると editor に表示される
- 検証:
  - `pnpm -r typecheck` 成功
  - `pnpm --filter @git-ai-ide/web build` 成功
  - browser で Explorer tree 表示確認済み
  - PR は GitHub issue #9 に `Closes #9` で紐づける
  - PR #10 を merge 済み

## GAI-011: Editor tabs で複数ファイルを切り替えられるようにする

- 状態: 完了
- ラベル: `実装可能`, `種別:機能`, `領域:web`, `優先度:p1`
- 担当: Codex
- GitHub issue: https://github.com/shunya-mabuchi/git-ai-ide/issues/11
- 背景: 中央 editor は現在 1 つの active tab だけを表示している。Explorer で複数ファイルを見比べる IDE 体験として、開いたファイルが tab として残り、切り替えや close ができる必要がある。
- スコープ:
  - 開いた file を editor tabs に追加する
  - tab クリックで selected file を切り替える
  - tab close に対応する
  - active tab を視覚的に表示する
  - diff preview 中は diff tab と file tabs の関係が崩れないようにする
- 受け入れ条件:
  - Explorer から複数 file を開くと複数 tab が表示される
  - tab をクリックすると editor の内容が切り替わる
  - active でない tab を close できる
  - active tab を close した場合は隣の tab に切り替わる
- 検証:
  - `pnpm -r typecheck` 成功
  - `pnpm --filter @git-ai-ide/web build` 成功
  - browser で複数 tab open / switch 表示を確認
  - PR は GitHub issue #11 に `Closes #11` で紐づける
  - PR #12 を merge 済み

## GAI-012: Search パネルでファイル名と本文を検索できるようにする

- 状態: 完了
- ラベル: `実装可能`, `種別:機能`, `領域:web`, `優先度:p1`
- 担当: Codex
- GitHub issue: https://github.com/shunya-mabuchi/git-ai-ide/issues/13
- 背景: Search パネルが入力欄だけの placeholder になっており、IDE として repo を探索する価値が弱い。
- スコープ:
  - workspace 内のファイル名検索
  - workspace 内の本文検索
  - 検索結果クリックで editor に file を開く
  - 検索なし / 一致なし状態を日本語で表示する
- 受け入れ条件:
  - Search パネルで query を入力すると結果が表示される
  - 結果に file path、match type、line、preview が表示される
  - 結果クリックで該当 file が editor tab に開く
  - demo repo で browser 確認できる
- 検証:
  - `pnpm -r typecheck` 成功
  - `pnpm --filter @git-ai-ide/web build` 成功
  - browser で Search panel の検索結果表示と file open を確認
  - PR は GitHub issue #13 に `Closes #13` で紐づける
  - PR #14 を merge 済み

## GAI-013: Local Preview で変更後のアプリを確認できるようにする

- 状態: 完了
- ラベル: `実装可能`, `種別:機能`, `領域:web`, `領域:runtime`, `優先度:p1`
- 担当: Codex
- GitHub issue: https://github.com/shunya-mabuchi/git-ai-ide/issues/15
- 背景: IDE として変更後の動作確認ができないと、AI patch workflow のありがたみが弱い。diff / test だけでなく、dev server preview を first-class に扱う必要がある。
- スコープ:
  - package.json scripts から dev / preview / build を検出する
  - bottom panel に Preview tab を追加する
  - demo / recorded fallback では確認用 preview と実行コマンドを表示する
  - WebContainer 非対応環境でも、なぜ preview が fallback か分かる表示にする
  - Local Preview を PR 前 safety workflow に接続しやすい状態にする
- 受け入れ条件:
  - demo repo で Preview tab が表示される
  - dev command / preview command が表示される
  - Preview 起動ボタンで preview log と状態が更新される
  - 非対応環境でも recorded preview fallback として破綻しない
  - typecheck / build / browser 確認が通る
- 検証:
  - `pnpm --filter @git-ai-ide/ai-runtime test` 成功
  - `pnpm -r typecheck` 成功
  - `pnpm --filter @git-ai-ide/web build` 成功
  - browser で Preview tab と Local Preview 起動状態を確認
  - PR は GitHub issue #15 に `Closes #15` で紐づける
  - PR #16 を merge 済み

## GAI-014: WebContainer dev server を Local Preview に接続する

- 状態: 完了
- ラベル: `実装可能`, `種別:機能`, `領域:web`, `領域:runtime`, `優先度:p1`
- 担当: Codex
- GitHub issue: https://github.com/shunya-mabuchi/git-ai-ide/issues/17
- 背景: Local Preview は Preview tab と fallback 表示まで実装済みだが、WebContainer の dev server URL を取得して画面に接続する境界がまだない。IDE としてローカル確認の価値を出すには、対応環境で実 preview URL を扱える必要がある。
- スコープ:
  - WebContainer で install command を実行する
  - dev / preview command を起動する
  - server-ready URL を取得する
  - Preview panel に iframe を表示する
  - WebContainer 非対応環境では recorded fallback を維持する
- 受け入れ条件:
  - Local Preview ボタンが async runtime を呼ぶ
  - WebContainer 対応環境では preview URL を state に保持できる
  - preview URL がある場合は iframe を表示する
  - 非対応環境では fallback log と説明が表示される
  - typecheck / build / browser 確認が通る
- 検証:
  - `pnpm -r typecheck` 成功
  - `pnpm --filter @git-ai-ide/web build` 成功
  - browser で demo workspace の Local Preview recorded fallback を確認
  - PR は GitHub issue #17 に `Closes #17` で紐づける
  - PR #18 を merge 済み

## GAI-015: Branch Goal から Patch Proposal を生成できるようにする

- 状態: 完了
- ラベル: `実装可能`, `種別:機能`, `領域:ai-runtime`, `領域:web`, `優先度:p1`
- 担当: Codex
- GitHub issue: https://github.com/shunya-mabuchi/git-ai-ide/issues/19
- 背景: Patch Queue はまだ demoPatch 固定で、AI と相談して変更案を作るありがたみが弱い。Branch Goal、現在のファイル、選択 runtime mode を使って structured edit proposal を生成し、diff review に流せる必要がある。
- スコープ:
  - ai-runtime に recorded patch proposal generator を追加する
  - App 側の Patch Queue を demo 固定から active proposal state に変更する
  - AI Assistant から patch proposal を生成できるボタンを追加する
  - 生成した patch を diff preview / apply flow に接続する
  - 失敗時は日本語の fallback message を表示する
- 受け入れ条件:
  - Branch Goal と現在ファイルから Patch Proposal を生成できる
  - Patch Queue が生成済み proposal を表示する
  - Diff preview と Patch 適用が生成 proposal を使う
  - demo repo で browser 確認できる
  - typecheck / build / ai-runtime test が通る
- 検証:
  - `pnpm --filter @git-ai-ide/ai-runtime test` 成功
  - `pnpm -r typecheck` 成功
  - `pnpm --filter @git-ai-ide/web build` 成功
  - browser で AI patch 生成と Diff preview 表示を確認
  - PR は GitHub issue #19 に `Closes #19` で紐づける
  - PR #20 を merge 済み

## GAI-016: 検索結果から該当行へジャンプできるようにする

- 状態: 完了
- ラベル: `実装可能`, `種別:機能`, `領域:web`, `優先度:p1`
- 担当: Codex
- GitHub issue: https://github.com/shunya-mabuchi/git-ai-ide/issues/21
- 背景: Search パネルはファイル名と本文を検索できるが、結果クリック後に該当行へ移動できない。IDE として検索結果からすぐコード位置へ移動できる必要がある。
- スコープ:
  - Search result に line target を保持する
  - Monaco editor で該当行へ reveal / focus する
  - file tab と search click の連携を壊さない
  - filename match は 1 行目へ移動する
- 受け入れ条件:
  - 本文検索結果をクリックすると該当 file が開く
  - editor が該当 line を中央付近に表示する
  - filename match では file の 1 行目へ移動する
  - typecheck / build / browser 確認が通る
- 検証:
  - `pnpm -r typecheck` 成功
  - `pnpm --filter @git-ai-ide/web build` 成功
  - browser で検索結果クリック後に該当行が表示されることを確認
  - PR は GitHub issue #21 に `Closes #21` で紐づける
  - PR #22 を merge 済み

## GAI-017: LLM の structured edit JSON を検証して Patch Proposal に変換する

- 状態: 完了
- ラベル: `実装可能`, `種別:機能`, `領域:ai-runtime`, `優先度:p1`
- 担当: Codex
- GitHub issue: https://github.com/shunya-mabuchi/git-ai-ide/issues/23
- 背景: AI Patch Proposal は recorded generator まで実装済みだが、WebLLM / Ollama の実レスポンスを安全に Patch Queue へ入れる schema validation がない。LLM 出力をそのまま適用せず、structured edit schema と対象ファイル条件を検証する必要がある。
- スコープ:
  - ai-runtime に LLM JSON parse / validation 境界を追加する
  - PatchProposal と StructuredEdit の必須項目を検証する
  - replace operation 以外を拒否する
  - 対象ファイル外への edit を拒否する option を追加する
  - validation 成功時は PatchProposalResult として返す
  - validation 失敗時は日本語 error と warnings を返す
- 受け入れ条件:
  - valid JSON から PatchProposal を生成できる
  - invalid JSON / 不完全 schema を拒否できる
  - 許可されていない file path を拒否できる
  - ai-runtime test / typecheck が通る
- 検証:
  - `pnpm --filter @git-ai-ide/ai-runtime test` 成功
  - `pnpm -r typecheck` 成功
  - `pnpm --filter @git-ai-ide/web build` 成功
  - PR は GitHub issue #23 に `Closes #23` で紐づける
  - PR #24 を merge 済み

## GAI-018: Ollama 実 API から Patch Proposal を生成する

- 状態: 完了
- ラベル: `実装可能`, `種別:機能`, `領域:ai-runtime`, `領域:web`, `優先度:p1`
- 担当: Codex
- GitHub issue: https://github.com/shunya-mabuchi/git-ai-ide/issues/25
- 背景: LLM response の JSON validation 境界は入ったが、Ollama の実 API 呼び出しとはまだ接続されていない。ローカル LLM と相談して patch proposal を作る体験に近づけるため、Ollama `/api/generate` の structured JSON response を validation に通す必要がある。
- スコープ:
  - ai-runtime に Ollama patch proposal request を追加する
  - `/api/generate` に `stream: false` / `format: "json"` で問い合わせる
  - 返却された response を parseLlmPatchProposal に通す
  - 失敗時は recorded generator に fallback する
  - App の AI patch 生成を async provider flow に接続する
- 受け入れ条件:
  - Ollama mode で fetch が呼ばれる
  - valid Ollama response から PatchProposal を生成できる
  - Ollama failure 時に fallback できる
  - ai-runtime test / typecheck / web build が通る
- 検証:
  - `pnpm --filter @git-ai-ide/ai-runtime test` 成功
  - `pnpm -r typecheck` 成功
  - `pnpm --filter @git-ai-ide/web build` 成功
  - browser で async patch proposal flow を確認
  - PR は GitHub issue #25 に `Closes #25` で紐づける
  - PR #26 を merge 済み

## GAI-019: Workflow Safety Gate に Preview と Push を統合する

- 状態: 完了
- ラベル: `実装可能`, `種別:機能`, `領域:web`, `優先度:p1`
- 担当: Codex
- GitHub issue: https://github.com/shunya-mabuchi/git-ai-ide/issues/27
- 背景: PR 作成前チェックはあるが、Local Preview と branch push が Safety Gate 本体に統合されていない。AI workflow safety を UI 上で説明しやすくするため、Diff Review / Tests / Local Preview / Commit / Push / PR draft を同じ gate で扱う必要がある。
- スコープ:
  - SafetyGateInput に previewChecked / branchPushed を追加する
  - evaluateSafetyGate に Local Preview と Branch pushed を追加する
  - PR 作成可否を preview / push まで含めて判定する
  - App 側の safetyGate 入力と UI を更新する
  - shared package に safety gate test を追加する
- 受け入れ条件:
  - preview 未確認の場合 PR 作成不可になる
  - branch 未 push の場合 PR 作成不可になる
  - PR 作成前チェックに Local Preview と Branch pushed が表示される
  - shared test / typecheck / web build が通る
- 検証:
  - `pnpm --filter @git-ai-ide/shared test` 成功
  - `pnpm -r typecheck` 成功
  - `pnpm --filter @git-ai-ide/web build` 成功
  - browser で PR 作成前チェックに Local Preview checked / Branch pushed が表示されることを確認
  - PR は GitHub issue #27 に `Closes #27` で紐づける
  - PR #28 を merge 済み

## GAI-020: Ollama Patch Proposal の E2E 診断 UI を追加する

- 状態: 完了
- ラベル: `実装可能`, `種別:機能`, `領域:ai-runtime`, `領域:web`, `優先度:p1`
- 担当: Codex
- GitHub issue: https://github.com/shunya-mabuchi/git-ai-ide/issues/29
- 背景: Ollama API から Patch Proposal を生成する経路は実装済みだが、UI 上で実 E2E と fallback のどちらが動いたかを確認しづらい。ブラウザ IDE がローカル LLM と相談し、安全に structured edit を受け取る価値を説明するため、診断ログを明示する必要がある。
- スコープ:
  - Model Routing に Ollama E2E 診断ボタンを追加する
  - 現在のファイルと Branch Goal を使って `requestPatchProposal` を実行する
  - 実行 mode / model / proposal / warnings を UI に表示する
  - Ollama が使えない場合も recorded fallback として結果を確認できる
  - 診断で受け取った proposal を Patch Queue に反映する
- 受け入れ条件:
  - Ollama E2E 診断を UI から実行できる
  - Ollama 未検出でも fallback mode と warning が表示される
  - 診断結果の proposal が Patch Queue に反映される
  - typecheck / web build が通る
- 検証:
  - `pnpm -r typecheck` 成功
  - `pnpm --filter @git-ai-ide/web build` 成功
  - browser で Ollama E2E 診断を実行し、未接続時に `mode: recorded` / `model: not detected` / warning が表示されることを確認
  - browser で診断結果の proposal が Patch Queue に反映されることを確認
  - PR は GitHub issue #29 に `Closes #29` で紐づける
  - PR #30 を作成済み

## GAI-021: Local Preview の WebContainer preflight を可視化する

- 状態: 完了
- ラベル: `実装可能`, `種別:機能`, `領域:web`, `優先度:p1`
- 担当: Codex
- GitHub issue: https://github.com/shunya-mabuchi/git-ai-ide/issues/31
- 背景: Local Preview は実装済みだが、実 repo を開いたときに WebContainer を試せる条件、使えない理由、fallback の判断が UI 上で説明しづらい。任意 repo を best effort で確認する設計を明確に見せる必要がある。
- スコープ:
  - Runtime Plan から Local Preview の preflight checklist を作る
  - WebContainer 利用可否、command、fallback reason を UI に表示する
  - startLocalPreview の recorded fallback log と UI 表示を同じ診断情報に寄せる
  - preview readiness の unit test を追加する
- 受け入れ条件:
  - Preview パネルで WebContainer / Recorded fallback の理由が読める
  - package.json がない repo、dev script がない repo、cross-origin isolation 不足の差分を説明できる
  - web test / typecheck / web build が通る
- 検証:
  - `pnpm --filter @git-ai-ide/web test` 成功
  - `pnpm -r typecheck` 成功
  - `pnpm --filter @git-ai-ide/web build` 成功
  - browser で Preview パネルに Workspace source / Project capability / Preview command / Browser isolation が表示されることを確認
  - browser で Demo workspace が Recorded fallback として表示されることを確認
  - PR は GitHub issue #31 に `Closes #31` で紐づける
  - PR #32 を作成済み

## GAI-022: GitHub PR Flow の readiness を可視化する

- 状態: 完了
- ラベル: `実装可能`, `種別:機能`, `領域:github`, `領域:web`, `優先度:p1`
- 担当: Codex
- GitHub issue: https://github.com/shunya-mabuchi/git-ai-ide/issues/33
- 背景: GitHub Integration は push と PR 作成を実行できるが、選択 repo、branch、installation、push、PR URL の状態が散らばっている。PR helper mini app として、PR 作成前後の E2E readiness を一箇所で説明できる UI が必要。
- スコープ:
  - shared に PR flow readiness の判定関数とテストを追加する
  - GitHub Integration に repository / branch / installation / pushed commit / PR created の checklist を表示する
  - demo mode と GitHub App mode の違いを明示する
  - 既存 Safety Gate と矛盾しないようにする
- 受け入れ条件:
  - PR helper の readiness が UI で読める
  - Demo mode と GitHub mode の状態差が表示される
  - branch 未 push のとき PR 作成待ちになる
  - shared test / typecheck / web build が通る
- 検証:
  - `pnpm --filter @git-ai-ide/shared test` 成功
  - `pnpm -r typecheck` 成功
  - `pnpm --filter @git-ai-ide/web build` 成功
  - browser で GitHub Integration に Demo mode / Repository target / Branch / Branch push / Pull request の checklist が表示されることを確認
  - browser で branch 未 push のとき PR 作成待ちとして表示されることを確認
  - PR は GitHub issue #33 に `Closes #33` で紐づける
  - PR #34 を作成済み

## GAI-023: 公開向け README とデプロイ資料を整える

- 状態: 完了
- ラベル: `実装可能`, `種別:ドキュメント`, `領域:docs`, `優先度:p1`
- 担当: Codex
- GitHub issue: https://github.com/shunya-mabuchi/git-ai-ide/issues/35
- 背景: 主要機能の実装が進んだため、README と無料公開のデプロイ手順を現在の実装に合わせて更新する。公開ドキュメントとして、技術選定・代替案・制約・デモ手順を日本語で説明できる状態にする。
- スコープ:
  - README に現在の価値、機能、デモ手順、検証コマンド、ドキュメント導線を整理する
  - Cloudflare Pages / Workers / D1 の無料枠前提デプロイ手順を追加する
  - 現在の完成度、設計上の特徴、残リスクを追記する
  - completion roadmap を完了状態に合わせて更新する
- 受け入れ条件:
  - README だけでプロダクト概要とローカル起動が分かる
  - デプロイ手順が Cloudflare 前提で読める
  - 技術選定と制約が日本語で読める
  - typecheck / web build が通る
- 検証:
  - `pnpm -r typecheck` 成功
  - `pnpm --filter @git-ai-ide/web build` 成功
  - README の主要ドキュメントリンクが存在することを確認
  - PR は GitHub issue #35 に `Closes #35` で紐づける
  - PR #36 を作成済み

## GAI-024: 実 runtime E2E 診断ハブを追加する

- 状態: 完了
- ラベル: `実装可能`, `種別:機能`, `領域:web`, `領域:ai-runtime`, `領域:github`, `優先度:p1`
- 担当: Codex
- GitHub issue: https://github.com/shunya-mabuchi/git-ai-ide/issues/37
- 背景: GitHub App、WebLLM、Ollama、WebContainer は境界実装と fallback はあるが、実 credentials / 実 runtime で何が確認済みかを UI で一括把握しづらい。
- スコープ:
  - GitHub App 実接続 readiness / selected repo / push / PR / issue close の診断項目を表示する
  - WebLLM model loading / WebGPU / cache readiness を表示する
  - Ollama model 選択と実 request 結果を表示する
  - WebContainer preview preflight / iframe readiness を表示する
  - 診断結果を docs と issue tracker に残す
- 受け入れ条件:
  - UI で runtime E2E の未確認/確認済み/blocked が分かる
  - WebLLM/Ollama/WebContainer/GitHub が同じ粒度の checklist で見える
  - typecheck / build / browser smoke が通る
- 検証:
  - `pnpm -r typecheck` 成功
  - `pnpm --filter @git-ai-ide/web build` 成功
  - browser で E2E Diagnostics に GitHub App / WebLLM / Ollama / WebContainer の checklist が表示されることを確認
  - PR は GitHub issue #37 に `Closes #37` で紐づける
  - PR #41 を作成済み

## GAI-025: Git branch / merge / conflict / history と file operations を実用化する

- 状態: 完了
- ラベル: `実装可能`, `種類:機能`, `領域:git`, `領域:web`, `優先度:p1`
- 担当: Codex
- GitHub issue: https://github.com/shunya-mabuchi/git-ai-ide/issues/38
- 背景: IDE として使いやすくするには、単に diff を見るだけでなく、Explorer でファイルを作成・改名・削除でき、Source Control で branch、history、merge readiness、conflict handling の現在地を理解できる必要がある。
- スコープ:
  - Explorer に file create / rename / delete の UI を追加する
  - Source Control に branch list / commit history / merge readiness を追加する
  - conflict demo と解消方針を表示し、UI 上で説明できる workflow safety に接続する
  - 変更後に typecheck / build / browser smoke を実行する
- 受け入れ条件:
  - Demo repo で新規ファイル作成、改名、削除が UI 上で変更として見える
  - Source Control で branch list、history、merge readiness、conflict demo が確認できる
  - typecheck / build / browser smoke が通る
- 検証:
  - `pnpm -r typecheck` 成功
  - `pnpm --filter @git-ai-ide/web build` 成功
  - browser で Explorer file create と Source Control の branch/history/merge readiness を確認
  - PR #42 を作成済み

## GAI-026: PR description と Assisted Memory を強化する

- 状態: 完了
- ラベル: `実装可能`, `種類:機能`, `領域:ai-runtime`, `領域:web`, `優先度:p1`
- 担当: Codex
- GitHub issue: https://github.com/shunya-mabuchi/git-ai-ide/issues/39
- 背景: PR description が固定文のままだと、AI workflow のありがたみが弱い。branch goal、diff、検証結果、project-specific memory を使って、レビュー可能な PR 本文を構造化して生成する必要がある。
- スコープ:
  - PR description を branch goal / git diff / safety / memory から動的生成する
  - Assisted Memory を project-specific に保存、復元、削除できるようにする
  - PR 作成時に生成済み markdown を body として使う
  - 変更後に typecheck / build / browser smoke を実行する
- 受け入れ条件:
  - PR draft に概要、変更内容、受け入れ条件、Assisted Memory、リスク、テストが含まれる
  - Assisted Memory が repository/workspace key ごとに保存・復元できる
  - typecheck / build / browser smoke が通る
- 検証:
  - `pnpm -r typecheck` 成功
  - `pnpm --filter @git-ai-ide/web build` 成功
  - browser で Assisted Memory controls と project key 表示を確認
  - PR #43 を作成済み

## GAI-031: Local Preview を editor tab として開けるようにする

- 状態: 完了
- ラベル: `実装可能`, `種別:機能`, `領域:web`, `優先度:p1`
- 担当: 未定
- GitHub issue: https://github.com/shunya-mabuchi/git-ai-ide/issues/50
- 背景: 現在の Local Preview は独立したパネルとして扱われており、IDE としてはファイル表示領域との関係が弱い。一般的な IDE / editor では preview は editor area の tab として開き、選択ファイルと同じ場所で切り替えられる。
- スコープ:
  - editor tab model に preview tab を追加する
  - Preview tab をファイル tab と同じ tab strip に表示する
  - Preview tab 選択時は中央 editor area に preview content を表示する
  - 既存の Local Preview panel は補助情報、preflight、runtime status に役割を絞るか、tab 内へ統合する
  - demo / WebContainer / best-effort fallback の状態を preview tab 内で分かるようにする
  - preview tab を閉じてもファイル tab の状態が壊れないようにする
- 受け入れ条件:
  - ユーザーが Preview を開くと中央 editor area に Preview tab が作られる
  - Preview tab と通常ファイル tab をクリックで切り替えられる
  - Preview tab には dev server / WebContainer / fallback の状態が表示される
  - Source Control や AI Assistant の横幅変更と干渉しない
  - mobile / desktop で tab text や preview content が崩れない
- 検証:
  - Playwright E2E で Preview tab を開き、ファイル tab に戻れることを確認
  - `pnpm --filter @git-ai-ide/web test` 相当成功
  - `pnpm --filter @git-ai-ide/web build` 相当成功
  - `pnpm --filter @git-ai-ide/web test:e2e` 相当成功

## GAI-032: GitHub App 実 credentials E2E を完了する

- 状態: 未着手
- ラベル: `実装可能`, `種別:機能`, `領域:github`, `優先度:p1`
- 担当: 未定
- GitHub issue: https://github.com/shunya-mabuchi/git-ai-ide/issues/54
- 背景: GitHub App / Cloudflare Worker の境界実装はあるが、実 credentials を使った selected repository への branch push / PR 作成 / issue close までの E2E は未完了。
- 現在の確認結果:
  - GitHub CLI は repo scope で認証済み
  - `apps/worker/.dev.vars` は未作成
  - GitHub App の実 `GITHUB_APP_ID` / `GITHUB_APP_PRIVATE_KEY` / `GITHUB_APP_SLUG` は未設定
  - Wrangler は Cloudflare 未ログイン
- スコープ:
  - GitHub App を作成し、selected repository のみに install する
  - Worker local secrets または Cloudflare Worker secrets に GitHub App credentials を設定する
  - Worker を起動または deploy する
  - Web app から installation / repository 一覧を取得できることを確認する
  - selected repo に branch push する
  - PR を作成する
  - PR body の close keyword で issue が close されることを確認する
- 受け入れ条件:
  - GitHub Integration が Demo mode ではなく GitHub App configured / selected repo mode になる
  - installation と selected repository が UI で選択できる
  - branch push が実 GitHub branch を作成する
  - PR 作成で GitHub 上に PR URL ができる
  - close keyword が対象 issue に紐づく
- 検証:
  - Worker `/api/github/setup` が `appConfigured: true` を返す
  - Worker `/api/github/installations` が installation を返す
  - Worker `/api/github/repos?installation_id=...` が selected repo を返す
  - UI から branch push / PR 作成まで確認する
  - 必要なら Playwright の実 credentials 用 E2E を追加する

## GAI-033: WebContainer iframe preview E2E を完了する

- 状態: 実装中
- ラベル: `実装可能`, `種別:機能`, `領域:runtime`, `優先度:p1`
- 担当: Codex
- GitHub issue: https://github.com/shunya-mabuchi/git-ai-ide/issues/58
- 背景: Local Preview は Preview tab と iframe 表示まで実装済みだが、cross-origin isolation が有効な環境で WebContainer dev server URL を iframe に接続できることの実 E2E は未完了。
- スコープ:
  - WebContainer が必要とする COOP / COEP headers を local preview / deploy で確認できるようにする
  - Local Preview 実行時に WebContainer mode / dev server URL / iframe 表示を確認する
  - 非対応環境では recorded fallback と理由表示を維持する
  - Playwright または手動 E2E 手順で WebContainer iframe preview を確認できるようにする
- 受け入れ条件:
  - cross-origin isolation 有効環境で WebContainer preflight が pass になる
  - Local Preview が WebContainer dev server URL を取得する
  - Preview tab 内に iframe preview が表示される
  - 非対応環境では fallback reason が明示され、UI が壊れない
- 検証:
  - unit test で preflight と iframe readiness を確認する
  - Playwright E2E で preview tab / iframe readiness 表示を確認する
  - deploy 環境で実 WebContainer preview を手動確認する
  - `GIT_AI_IDE_WEBCONTAINER_E2E=1 pnpm --filter @git-ai-ide/web test:e2e` で実 WebContainer iframe harness を実行できる

## GAI-034: Ollama 実 runtime E2E を完了する

- 状態: 進行中
- ラベル: `実装可能`, `種別:機能`, `領域:runtime`, `優先度:p1`
- 担当: Codex
- GitHub issue: https://github.com/shunya-mabuchi/git-ai-ide/issues/60
- 背景: Ollama Patch Proposal の UI 診断はあるが、`ollama serve` と `model pull` 済み環境で実 runtime が Patch Proposal schema validation を通ることの E2E が未完了。
- スコープ:
  - Ollama 実 runtime を CLI / UI から確認できるようにする
  - 実 model がある場合に patch proposal を生成し、schema validation を通す
  - Ollama 未起動または invalid response では recorded fallback と理由が分かるようにする
  - 実行手順を日本語 docs に残す
- 受け入れ条件:
  - Ollama 起動済み環境で `mode: ollama` の Patch Proposal が得られる
  - model id が診断結果に表示される
  - Patch Proposal が Patch Queue に入れられる形式で validation される
  - Ollama 未接続でも fallback が明示される
- 検証:
  - Ollama 実 runtime E2E script を追加し、未接続時の説明も含める
  - UI E2E で fallback 診断が壊れていないことを確認する
  - 実 Ollama 環境では script で `mode: ollama` を確認する

## GAI-035: WebLLM 実モデルロード E2E を完了する

- 状態: 進行中
- ラベル: `実装可能`, `種別:機能`, `領域:runtime`, `優先度:p1`
- 担当: Codex
- GitHub issue: https://github.com/shunya-mabuchi/git-ai-ide/issues/62
- 背景: WebGPU / WebLLM readiness は表示しているが、WebLLM SDK で実モデルを load し、小さな chat completion を実行する E2E が未完了。
- スコープ:
  - WebLLM SDK の model loading boundary を追加する
  - WebGPU 非対応環境では fallback reason を明示する
  - WebGPU 対応環境では model load progress と completion smoke test を確認できるようにする
  - 実行手順を日本語 docs に残す
- 受け入れ条件:
  - WebGPU 対応環境で WebLLM model load を開始できる
  - loading progress / model id / result が診断できる
  - 小さな prompt への completion が成功する
  - 非対応環境では recorded fallback と理由が明示される
- 検証:
  - WebLLM 実モデルロード E2E 診断を追加する
  - WebGPU 非対応 CI では skip / fallback が確認できる
  - WebGPU 対応端末では実 model load を手動確認する

## GAI-036: GitHub branch / commit 実操作 UI を追加する

- 状態: 進行中
- ラベル: `実装可能`, `種別:機能`, `領域:github`, `優先度:p1`
- 担当: Codex
- GitHub issue: https://github.com/shunya-mabuchi/git-ai-ide/issues/68
- 背景: 実 GitHub repository を操作する IDE として、repo 選択後に branch list / commit list / branch 作成を GitHub App 経由で扱える必要がある。
- スコープ:
  - Worker に GitHub branches / commits / create branch API を追加する
  - Web client に branches / commits / create branch 呼び出しを追加する
  - real GitHub mode では Source Control の branch / history を remote data で表示する
  - branch 作成と remote refresh の UI を追加する
- 受け入れ条件:
  - selected repository の branch list を取得できる
  - selected branch の commit list を取得できる
  - GitHub App mode で branch を作成できる
  - demo mode では既存の simulation 表示を維持する
- 検証:
  - Web typecheck / unit / E2E / build
  - Worker typecheck / wrangler dry-run

## GAI-030: GitHub 実操作モードへの接続導線を明確にする

- 状態: 完了
- ラベル: `実装可能`, `種別:機能`, `領域:github`, `領域:web`, `優先度:p1`
- 担当: 未定
- GitHub issue: https://github.com/shunya-mabuchi/git-ai-ide/issues/49
- 背景: 現在の Source Control / GitHub Integration は demo fallback であることは表示しているが、実 GitHub repository を操作するために何を設定すればよいかが画面内で分かりにくい。ユーザーは GitHub 認証済み repo から branch を切り、push / PR 作成する体験を期待している。
- スコープ:
  - Worker 未起動、GitHub App secrets 未設定、installation 未選択、repository 未選択を別々の状態として表示する
  - GitHub Integration に Connect GitHub App 導線と setup checklist を追加する
  - demo Source Control と real GitHub Source Control の表示を明確に分ける
  - real mode では demo history / demo branch を混ぜず、選択 repo / installation / branch / push / PR 状態を中心に表示する
  - setup docs へのリンクを UI から辿れるようにする
- 受け入れ条件:
  - demo mode のとき、実 repo を操作していないことと、実操作に必要な未完了条件が分かる
  - Worker が起動しているが secret 未設定の状態を区別できる
  - GitHub App configured だが installation がない状態を区別できる
  - installation と selected repo が揃ったときだけ real operation として表示される
  - Source Control の branch / history 表示が demo と real で混ざらない
- 検証:
  - Playwright E2E で demo fallback 表示と setup checklist を確認
  - `pnpm --filter @git-ai-ide/web test` 相当成功
  - `pnpm --filter @git-ai-ide/web build` 相当成功
  - `pnpm --filter @git-ai-ide/web test:e2e` 相当成功

## GAI-029: Demo mode と実 GitHub 操作の境界を明確にする

- 状態: 完了
- ラベル: `実装可能`, `種別:機能`, `領域:web`, `領域:github`, `優先度:p1`
- 担当: Codex
- GitHub issue: https://github.com/shunya-mabuchi/git-ai-ide/issues/46
- 背景: Source Control に demo branch / demo history / demo repository が実 GitHub repo のように表示され、ユーザーが実 repo 操作と誤解しやすい。
- スコープ:
  - Source Control の見出しを GitHub 接続状態に応じて Demo / GitHub に分ける
  - demo branch / demo history / demo repository を明確に demo と表示する
  - GitHub 未接続時は Push / PR 作成が demo simulation であることを説明に出す
- 受け入れ条件:
  - demo mode のとき実 repo を操作しているように見えない
  - GitHub App configured のときだけ real operation と分かる
  - typecheck / build / E2E が通る
- 検証:
  - `pnpm -r typecheck` 成功
  - `pnpm --filter @git-ai-ide/web build` 成功
  - `pnpm --filter @git-ai-ide/web test:e2e` 成功

## GAI-028: CI と検証コマンドを公開前品質に整える

- 状態: 完了
- ラベル: `実装可能`, `種別:機能`, `領域:docs`, `優先度:p1`
- 担当: Codex
- GitHub issue: https://github.com/shunya-mabuchi/git-ai-ide/issues/45
- 背景: Playwright E2E が追加されたため、main に入る変更を GitHub Actions で typecheck / unit test / build / E2E まで確認できる状態にする。README からも同じ検証手順を読めるようにする。
- スコープ:
  - GitHub Actions workflow を追加する
  - pnpm install / Playwright Chromium install / typecheck / test / build / E2E を CI で実行する
  - README の検証コマンドに E2E と初回 browser install を追記する
- 受け入れ条件:
  - `.github/workflows/ci.yml` が存在する
  - CI で主要検証コマンドが実行される
  - README からローカル検証手順が分かる
- 検証:
  - `pnpm -r typecheck` 成功
  - `pnpm -r test` 成功
  - `pnpm --filter @git-ai-ide/web build` 成功
  - `pnpm --filter @git-ai-ide/web test:e2e` 成功

## GAI-027: Playwright E2E suite を追加する

- 状態: 完了
- ラベル: `実装可能`, `種類:テスト`, `領域:web`, `領域:workflow-safety`, `優先度:p1`
- 担当: Codex
- GitHub issue: https://github.com/shunya-mabuchi/git-ai-ide/issues/40
- 背景: 主要機能が増えたため、Explorer、Git workflow、Assisted Memory などの回帰を手動確認だけに頼らない E2E suite が必要。
- スコープ:
  - Playwright 設定と `test:e2e` script を追加する
  - Explorer file operation / Git panel / conflict demo を E2E で確認する
  - Assisted Memory の保存・復元を E2E で確認する
  - CI やローカルで実行しやすい dev server 連携を設定する
- 受け入れ条件:
  - `pnpm --filter @git-ai-ide/web test:e2e` で E2E が実行できる
  - 主要 IDE workflow が自動テストで守られる
  - typecheck / build / E2E が通る
- 検証:
  - `pnpm -r typecheck` 成功
  - `pnpm -r test` 成功
  - `pnpm --filter @git-ai-ide/web build` 成功
  - `pnpm --filter @git-ai-ide/web test:e2e` 成功
  - PR #44 を作成済み

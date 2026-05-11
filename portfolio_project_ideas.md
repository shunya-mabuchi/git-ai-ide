# 転職ポートフォリオ向けプロジェクト案

## 結論

主案は **WebLLM 搭載ブラウザ IDE** にするのが良いです。

小さなデモではなく、実際に「ブラウザ IDE として使える」ことを前提にします。単なるチャット UI やコード断片生成ではなく、Git プロジェクトを開き、ブランチを作り、LLM とプロジェクト文脈について話し、提案された修正を差分として確認して適用できるところまでを中核にします。

これは転職ポートフォリオとしてかなり強い題材です。フロントエンド、ブラウザ API、Git、ローカルファースト設計、AI エージェント UX、WebGPU、状態管理、セキュリティ、無料運用の判断をまとめて説明できます。

## プロジェクト名案

**Git AI IDE**

ブラウザだけで Git プロジェクトを開き、WebLLM と対話しながらコードを編集できるローカルファースト IDE。

別案:

- BrowserForge
- VibeIDE
- PatchPilot
- LocalPilot IDE
- WebLLM Studio

## プロダクト概要

ユーザーがブラウザでローカルまたはリモートの Git プロジェクトを開き、ファイル編集、ブランチ作成、コミット、マージ、差分確認を行える IDE。

AI 機能は WebLLM を中心に、ユーザーのブラウザ内で推論します。LLM は単なる雑談相手ではなく、現在のプロジェクト構造、開いているファイル、選択範囲、Git diff、エラー内容、ブランチ状態を文脈として理解し、修正提案を作ります。

公開サイト自体は Cloudflare Pages に置き、推論と保存はユーザー端末側で完結させます。これにより、公開後も無料で維持しやすくなります。

## 必須体験

- ブラウザで IDE を開ける
- ローカルフォルダから Git プロジェクトを開ける
- URL から Git プロジェクトを clone / import できる
- 新規プロジェクトを追加できる
- ファイルツリーを見られる
- Monaco Editor で複数ファイルを編集できる
- Git status を確認できる
- ブランチを作成 / 切り替えできる
- diff を確認できる
- commit を作成できる
- merge を実行できる
- コンフリクトを UI 上で確認できる
- WebLLM とプロジェクトについて会話できる
- モデルを途中で切り替えられる
- LLM がファイル単位 / diff 単位 /選択範囲単位で修正提案できる
- LLM の提案を直接反映せず、patch として確認してから適用できる

## 技術構成

- Frontend: React / TypeScript / Vite
- Hosting: Cloudflare Pages
- Auth / GitHub API proxy: Cloudflare Workers
- Editor: Monaco Editor
- Browser LLM: WebLLM
- Inference runtime: WebGPU / WebAssembly / Web Worker
- Git: isomorphic-git
- GitHub Integration: GitHub App
- Local file access: File System Access API
- Browser filesystem fallback: lightning-fs / IndexedDB
- Persistence: IndexedDB
- State management: Zustand または Jotai
- Diff / patch: diff-match-patch、Monaco Diff Editor、独自 patch apply layer
- Optional runtime preview: WebContainer
- Testing: Vitest / Playwright

## なぜこの構成が良いか

### 無料公開と AI の両立

クラウド LLM API を使うと、公開後の利用量に応じてコストが増えます。この案では WebLLM によって推論をユーザーのブラウザ内で実行するため、運用者側の推論コストを持ちません。

### ブラウザ IDE として成立する

File System Access API を使えば、ユーザーが許可したローカルフォルダを読み書きできます。isomorphic-git を使えば、ブラウザ内でも clone、branch、commit、merge などの Git 操作を扱えます。

### 面接で話せる技術領域が広い

単なる CRUD ではなく、ブラウザ制約下でのファイル操作、Git 実装、LLM の文脈設計、差分適用、WebGPU、Worker 分離、ローカル永続化まで説明できます。

## 主要機能

### Project Management

- ローカルフォルダを開く
- リモート Git URL から clone
- GitHub App で選択した repo だけを開く
- GitHub の repo 一覧から import
- 最近開いたプロジェクト一覧
- プロジェクトごとのモデル設定
- IndexedDB への作業状態保存

### Editor

- ファイルツリー
- タブ式エディタ
- Monaco Editor
- Monaco Diff Editor
- 検索
- ファイル作成 / 削除 / リネーム
- 保存状態表示

### Git

- GitHub App install
- 選択 repo のみへの read / write access
- GitHub OAuth callback
- GitHub token exchange
- status
- diff
- branch list
- create branch
- checkout branch
- commit
- merge
- pull
- push
- PR 作成
- PR description 生成
- conflict view
- revert selected change
- stage / unstage

### AI Coding

- WebLLM モデルロード
- モデル切り替え
- Device capability profile
- PC 性能に応じたモデル候補表示
- task-based model suggestion
- ストリーミング応答
- プロジェクト要約
- ファイル説明
- 選択範囲の修正
- issue / TODO から実装案生成
- diff review
- patch proposal
- patch apply
- 変更理由の説明

### Runtime

- WebContainer boot
- package install
- dev server 起動
- preview iframe
- test command 実行
- typecheck 実行
- terminal output capture
- error output を Context Pack に追加
- LLM による failed test / build error の説明
- LLM による small patch proposal

### Context Engine

LLM に雑に全ファイルを渡すのではなく、必要な文脈を選んで渡す層を作ります。

- 現在開いているファイル
- 選択範囲
- Git diff
- ファイルツリー
- package.json などの重要ファイル
- README
- エラー出力
- ユーザーが明示的に添付したファイル

ここは強いアピールポイントになります。AI アプリで重要なのは「モデルを呼ぶこと」ではなく、「どの文脈を、どの粒度で、どの順序で渡すか」だからです。

### Model Capability Engine

ブラウザで動くモデルは端末性能に左右されるため、固定のモデル前提にはしません。起動時に Device capability profile を作り、使えるモデルと推奨タスクを UI に出します。

- WebGPU availability
- 推定 GPU / adapter 情報
- memory pressure
- 既存キャッシュ済みモデル
- 小型モデル / 中型モデル / 大型モデル候補
- model load estimate
- context budget estimate
- task suitability

例:

| Capability | Recommended Use |
|---|---|
| Small model only | diff summary, commit message, PR description, risk checklist |
| Medium model available | single-file patch proposal, test suggestion, conflict explanation |
| Large model available | broader refactor suggestion, multi-file reasoning |

この設計により、WebLLM が弱い端末でも「できること」を明確にし、無理なタスクを避けられます。

## 実装フェーズ

### Phase 1: ブラウザ IDE の土台

- React / Vite / TypeScript
- Monaco Editor
- ファイルツリー
- 複数ファイル編集
- IndexedDB 保存
- Cloudflare Pages デプロイ

### Phase 2: Git プロジェクト対応

- File System Access API でローカルフォルダを開く
- isomorphic-git で status / diff / branch / commit
- clone/import 対応
- Git 操作用 UI

### Phase 2.5: GitHub Integration

- GitHub App 作成
- 選択 repo のみへの権限付与
- Cloudflare Worker で OAuth callback / token exchange
- GitHub API proxy
- clone / pull / push の認証
- PR 作成

### Phase 3: WebLLM 統合

- WebGPU 対応チェック
- Device capability profile
- WebLLM モデルロード
- モデル切り替え
- PC 性能に応じたモデル候補
- task-based model suggestion
- Worker 分離
- ストリーミングチャット
- プロジェクト文脈の注入

### Phase 4: 修正適用フロー

- LLM から patch proposal を生成
- diff preview
- apply / reject
- 部分適用
- 適用後の Git diff 確認

### Phase 5: IDE としての完成度

- merge UI
- conflict view
- branch comparison
- エラー貼り付けから修正
- AI review
- WebContainer preview
- test / typecheck 実行
- 失敗ログを Context Pack に追加

## スコープの考え方

「小さく作る」のではなく、**完成形を大きく定義し、段階的に到達する** のが良いです。

最初の公開版でも、以下は中核として入れたいです。

- Git プロジェクトを開ける
- GitHub App で選択 repo を開ける
- ブランチを作れる
- diff を見られる
- WebLLM とプロジェクト文脈つきで会話できる
- LLM の修正提案を patch として適用できる
- commit / push / PR 作成ができる

逆に、最初からやらなくてよいもの:

- 完全な VS Code 互換
- 全言語の LSP
- 複雑なターミナル
- 本格的なクラウド同期
- 複数人共同編集

## 技術的リスク

- WebGPU 非対応ブラウザでは WebLLM が使えない
- 初回モデルロードが重い
- 端末性能によって応答速度が大きく変わる
- ブラウザで動く小型モデルでは、大きな実装や複雑な推論の精度が不足する
- File System Access API はブラウザ対応差がある
- GitHub への push は認証や CORS の設計が必要
- GitHub token を安全に扱う必要がある
- merge conflict UI は複雑になりやすい
- LLM の patch が壊れる可能性がある
- WebContainer は cross-origin isolation や対応ブラウザの制約がある
- WebContainer API は商用・高利用量ではライセンス条件の確認が必要

## リスクへの対応

- WebGPU 非対応時は明確な unsupported UI を出す
- 小さめのモデルをデフォルトにする
- PC 能力に応じて利用可能なタスクを段階的に有効化する
- 小型モデルには diff summary / commit / PR 文生成を優先させる
- patch proposal は single-file / selected-range に制限する
- multi-file patch は中型以上のモデルか、ユーザー確認を強める
- モデルロード進捗を丁寧に表示する
- File System Access API 非対応時は IndexedDB workspace にフォールバックする
- GitHub App は選択 repo のみを許可し、権限を最小化する
- OAuth callback と token exchange は Cloudflare Worker に寄せる
- token は可能な限り短命に扱い、ブラウザ保存を避けるか暗号化保存にする
- WebContainer はポートフォリオ用途の中核体験として使い、README に利用条件とブラウザ制約を明記する
- Runtime が使えない環境では test command suggestion と log paste にフォールバックする
- patch は必ず diff preview を通す
- LLM が編集できる範囲をユーザーが選べるようにする

## 面接でアピールできること

- WebLLM を使い、サーバー推論なしで AI 機能を実現した
- PC 能力に応じてモデルとタスクを出し分ける設計にした
- Cloudflare Pages により無料公開できる構成にした
- GitHub App により選択 repo のみに権限を絞った
- Cloudflare Worker で GitHub 認証と API proxy を分離した
- File System Access API でブラウザからローカルプロジェクトを扱った
- isomorphic-git でブラウザ内 Git 操作を実装した
- LLM に渡すプロジェクト文脈を設計した
- 生成結果を直接反映せず patch review にした
- Web Worker で推論処理を UI から分離した
- IndexedDB によるローカルファーストな保存を設計した
- ブラウザ API の制約とフォールバックを考慮した
- WebContainer によりブラウザ内で test / preview を実行した
- 実行ログを LLM の Context Pack に接続した

## 想定質問

### Q. なぜ Ollama ではなく WebLLM なのですか？

Ollama は強力ですが、ユーザーにインストールと起動を求めます。WebLLM は WebGPU 対応ブラウザであれば、Web アプリだけで推論体験を提供できます。ポートフォリオとしても、ブラウザ内推論、WebGPU、Worker 分離、モデルロード UX を説明できる点が強いです。

### Q. ブラウザで動く小さいモデルで本当に役に立ちますか？

大規模な自律実装を任せる前提にはしません。主な価値を diff explanation、branch review、risk checklist、commit message、PR description、selected-range patch に絞ります。さらに Context Budget、Repo Map、Branch Goal、Structured Edit Operation によって、モデルが扱う問題を小さく明確にします。

### Q. なぜクラウド LLM API を使わないのですか？

公開後も無料で維持する条件があるためです。クラウド LLM API は利用量に応じてコストが発生します。このプロジェクトでは、推論をユーザー端末側で実行し、運用者側の推論コストをゼロに近づけます。

### Q. LLM がプロジェクトを理解する仕組みは？

全ファイルを渡すのではなく、現在のファイル、選択範囲、Git diff、ファイルツリー、README、設定ファイル、ユーザーが指定した関連ファイルを Context Engine で選び、プロンプトに組み込みます。これにより、トークン量と精度のバランスを取ります。

### Q. 生成されたコードをどう安全に適用しますか？

LLM の出力を直接書き込まず、patch proposal として扱います。ユーザーは Monaco Diff Editor で差分を確認し、全体適用、部分適用、却下を選べます。適用後も Git diff で確認できます。

### Q. ブラウザで Git は現実的ですか？

isomorphic-git を使うことで、ブラウザ内でも clone、branch、commit、merge、push などを扱えます。ただし push や認証、CORS には制約があるため、GitHub App と Cloudflare Worker を組み合わせ、認証と GitHub API proxy をブラウザ UI から分離します。

### Q. GitHub 連携でなぜ GitHub App を使うのですか？

選択した repo のみに権限を絞れるからです。ユーザーの全 repo への広い権限を求めるより安全で、面接でも最小権限設計として説明しやすいです。

### Q. WebContainer を使う理由は何ですか？

Branch to PR Flow で、編集、差分確認、テスト、修正、PR 作成までをブラウザ内でつなげたいからです。テストや dev server の結果を Context Pack に入れることで、LLM は単なる会話相手ではなく、失敗ログを読んで小さな修正案を出す開発支援になります。

### Q. WebContainer の制約はどう扱いますか？

対応ブラウザ、cross-origin isolation、初回 boot コスト、ライセンス条件を README に明記します。WebContainer が使えない環境では、推奨コマンドの提示、ログ貼り付け、Git diff review にフォールバックします。

## README に入れるべき内容

- プロジェクト概要
- デモ URL
- 使用技術
- アーキテクチャ図
- 無料公開を維持する設計
- WebLLM 採用理由
- Device capability profile とモデル選択
- GitHub App 採用理由
- Git 操作の設計
- Cloudflare Worker で担当する認証 / proxy の設計
- File System Access API の使い方
- WebContainer の実行環境設計
- Context Engine の設計
- patch apply の安全性
- ブラウザ対応状況
- 既知の制約
- 今後の改善

## README 用アピール文

Git AI IDE は、ブラウザだけで Git プロジェクトを開き、WebLLM と対話しながらコードを編集できるローカルファースト IDE です。Cloudflare Pages に静的サイトとして公開し、LLM 推論はユーザー端末の WebGPU 上で実行することで、クラウド推論コストなしに AI コーディング体験を提供します。

単なるチャット UI ではなく、GitHub App による選択 repo 連携、Cloudflare Worker による認証 / API proxy、File System Access API によるローカルプロジェクト操作、isomorphic-git による branch / diff / commit / merge / push、Monaco Editor による編集体験、WebContainer による test / preview、WebLLM によるプロジェクト文脈つきの修正提案、diff preview を経由した patch apply までを扱います。

AI の出力を直接信頼せず、ユーザーが差分を確認してから適用する設計にすることで、AI コーディング支援ツールとしての安全性と実用性のバランスを取りました。

## 参考

- WebLLM: https://webllm.mlc.ai/docs/index.html
- isomorphic-git: https://isomorphic-git.org/
- File System Access API: https://developer.chrome.com/articles/file-system-access
- WebContainer API: https://webcontainers.io/api
- Cloudflare Pages: https://developers.cloudflare.com/pages/

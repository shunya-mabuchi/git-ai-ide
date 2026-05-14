# Git AI IDE MVP 実装状況

## 目的

Git AI IDE は、AI にコード変更を丸投げするのではなく、Branch Goal、Context Pack、Patch Queue、Diff Review、Safety Gate を通して、AI の提案を検証可能な Git workflow に落とすブラウザ IDE です。

## 実装済み

### IDE UI

- VS Code / Cursor 風の Activity Bar、Explorer、中央エディタ、AI Assistant、下部パネル
- Explorer / AI Assistant の表示切替
- ペイン幅調整
- 下部パネルの折りたたみ
- Monaco Editor
- Monaco Diff Editor

### Workspace 管理

- GitHub selected repository
- File System Access API によるローカル directory snapshot 読み込み
- IndexedDB による前回 workspace 復元
- ローカルフォルダと前回 workspace の復元

### Git workflow

- baseline snapshot と現在 workspace の比較
- added / modified / deleted の Git status 表示
- changed file から diff review
- branch 名編集
- GitHub App 実操作 mode で branch 作成
- commit draft 作成
- commit draft 後に baseline 更新
- GitHub App 実操作 mode で branch push / PR 作成
- GitHub 未接続時の setup required 表示

### AI workflow safety

- Context Pack budget meter
- task priority: Fast / Balanced / Deep
- selected file / changed files / assisted memory を Context Pack に反映
- runtime routing: WebLLM
- WebLLM model catalog / device-aware routing
- runtime suggestion
- editable Branch Goal
- editable Assisted Memory
- structured edit patch proposal
- 複数 proposal の Patch Queue、reject、failed reason
- PR 作成前 Safety Gate

### Runtime 管理

- package.json から test / typecheck script を推定
- WebContainer candidate / manual fallback の runtime plan
- Local Preview tab
- URL bar から localhost preview
- WebContainer 非対応時の manual fallback log

### Cloudflare Worker 境界

- `/health`
- `/api/sessions`
- `/api/github/installations`
- `/api/github/repos`
- `/api/github/branches`
- `/api/github/push`
- `/api/github/prs`
- D1 には workflow metadata のみ保存

## 実 credentials / 実 runtime が必要なもの

- WebLLM 実モデルロード
- WebContainer 実行
- Cloudflare deploy URL での GitHub App / Worker / D1 結合確認

GitHub App の local real E2E は完了済みです。WebLLM / WebContainer は端末やブラウザ機能に依存するため、通常 CI では fallback を確認し、対応環境で明示的に実 E2E を実行します。

## 設計上のポイント

- AI の出力を直接適用せず、structured edit と diff review に分けたこと
- 小さなブラウザ LLM の制約を前提に、task priority と runtime fallback を設計したこと
- WebLLM model load 失敗を端末ごとに記録し、次回候補から外すことで選択 UX を保護したこと
- D1 に code や diff を保存せず、workflow metadata のみ保存する privacy-aware 設計にしたこと
- user-facing demo mode を撤去し、実 GitHub repo 接続を前提にしたこと
- browser IDE として、Monaco、File System Access API、IndexedDB、Cloudflare Workers、D1 を組み合わせたこと

## 次に本物化する順番

1. Cloudflare deploy URL で Worker / D1 / GitHub App secrets を確認
2. WebContainer install / dev server iframe preview の実 E2E
3. WebLLM model loading の実 E2E
4. isomorphic-git の実 filesystem 連携

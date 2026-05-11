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

- demo repo
- File System Access API によるローカル directory snapshot 読み込み
- IndexedDB による前回 workspace 復元
- demo repo への復帰

### Git workflow

- baseline snapshot と現在 workspace の比較
- added / modified / deleted の Git status 表示
- changed file から diff review
- branch 名編集
- commit draft 作成
- commit draft 後に baseline 更新
- push demo
- PR 作成 demo

### AI workflow safety

- Context Pack budget meter
- task priority: Fast / Balanced / Deep
- runtime routing: Recorded AI / WebLLM / Ollama
- runtime suggestion
- editable Branch Goal
- editable Assisted Memory
- structured edit patch proposal
- Patch Queue safety checklist
- PR 作成前 Safety Gate

### Runtime 管理

- package.json から test / typecheck script を推定
- WebContainer candidate / recorded fallback の runtime plan
- demo test log

### Cloudflare Worker 境界

- `/health`
- `/api/sessions`
- `/api/github/repos`
- `/api/github/prs`
- D1 には workflow metadata のみ保存

## 現在 demo mode のもの

- GitHub App 認証
- GitHub push
- GitHub PR 作成
- WebLLM 実モデルロード
- Ollama 実接続
- WebContainer 実行

これらは UI と型境界を先に実装してあり、次に実 API / runtime を差し替える想定です。

## 面接で説明するポイント

- AI の出力を直接適用せず、structured edit と diff review に分けたこと
- 小さなブラウザ LLM の制約を前提に、task priority と runtime fallback を設計したこと
- D1 に code や diff を保存せず、workflow metadata のみ保存する privacy-aware 設計にしたこと
- demo mode を用意し、WebLLM や GitHub 認証が不安定でも価値を見せられるようにしたこと
- browser IDE として、Monaco、File System Access API、IndexedDB、Cloudflare Workers、D1 を組み合わせたこと

## 次に本物化する順番

1. GitHub App install / OAuth callback
2. Worker で GitHub installation token を取得
3. 選択 repo の branch 作成、push、PR 作成
4. WebLLM model loading
5. Ollama localhost 接続
6. WebContainer install / test / typecheck 実行
7. isomorphic-git の実 filesystem 連携

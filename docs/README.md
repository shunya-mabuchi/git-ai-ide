# Git AI IDE ドキュメント

公開ドキュメントの入口です。まずは README を読み、必要に応じて以下を参照してください。

## 利用・開発

- [開発環境](development.md): ローカル起動、Worker 起動、Docker を必須にしない理由
- [デプロイ手順](deployment.md): Cloudflare Pages / Workers / D1 で公開する手順
- [GitHub App セットアップ](github-app-setup.md): selected repository only の GitHub App 設定
- [環境設計](environment.md): ローカル開発、runtime、保存対象の考え方

## 状態・ロードマップ

- [MVP 実装状況](mvp-implementation-status.md): 現在実装済みの機能と demo mode の境界
- [完成までの残り機能](completion-roadmap.md): 実 E2E と本番運用品質に向けた残作業

## Agent 運用

- [ドメイン用語](agents/domain.md): Branch Goal、Patch Queue、Safety Gate などの用語
- [Issue tracker](agents/issue-tracker.md): GitHub Issues と同期するローカル作業記録
- [Triage labels](agents/triage-labels.md): issue triage 用ラベル定義

# Git AI IDE 面接用アピール資料

## 一言で説明

Git AI IDE は、GitHub の Branch to PR フローをブラウザ上で進めながら、WebLLM や Ollama などのローカル LLM と安全にコード変更を扱う Git-aware ブラウザ IDE です。

AI に直接コードを書き換えさせるのではなく、Branch Goal、Context Pack、Structured Edit Operation、Patch Queue、Diff Preview を通して、ユーザーが確認しながら変更を適用できる設計にしています。

## なぜこの題材にしたか

転職ポートフォリオとして、単なる CRUD アプリではなく、実際の開発フローに近い題材を作りたいと考えました。

最近の AI コーディングツールは強力ですが、AI が何を文脈として受け取ったのか、どの範囲を変更するのか、変更を安全に確認できるのかが分かりにくいことがあります。

Git AI IDE では、AI の出力をそのまま信頼せず、Git の branch / diff / commit / PR という開発者に馴染みのある流れの中で、AI の提案を検証可能な形にします。

## 一番アピールしたいこと

**AI workflow safety** です。

AI に「全部やって」と任せるのではなく、IDE 側がタスクを小さく切り、文脈を整理し、AI の出力を構造化し、ユーザーが diff を確認してから適用します。

特にブラウザで動く WebLLM は、大きなクラウドモデルほど強くありません。その制約を前提に、次のような設計で実用性を出します。

- LLM に渡す Context Pack を可視化する
- token budget と priority tiers で文脈量を制御する
- Branch Goal を Required context にする
- AI の編集提案を Structured Edit Operation に限定する
- `find` text が一致しない patch は適用できない
- すべての patch を Diff Preview で確認する
- PR 作成前に Soft Gate で未確認項目を出す

## 技術スタック

- Frontend: React / TypeScript / Vite
- Hosting: Cloudflare Pages
- API / Auth proxy: Cloudflare Workers
- DB: Cloudflare D1
- Editor: Monaco Editor
- Git: isomorphic-git
- GitHub Integration: GitHub App
- Local AI: WebLLM
- AI fallback: Ollama
- Runtime: WebContainer
- Local persistence: IndexedDB / File System Access API
- Testing: Vitest / Playwright

## 無料公開を維持する設計

公開サイトは Cloudflare Pages に静的アプリとして置きます。

Cloudflare Worker は GitHub 認証、token exchange、GitHub API proxy のような最小限の用途に限定します。

Cloudflare D1 はコード保存には使わず、Branch to PR workflow の metadata 保存に限定します。たとえば session、AI action、patch status、safety gate result、PR URL を保存します。

LLM 推論はサーバー側で実行しません。WebLLM ならユーザーのブラウザ内、Ollama fallback ならユーザーのローカル環境で推論します。

そのため、利用者が増えても運用者側に LLM API コストが発生しにくい構成です。

## 主なユーザーフロー

1. GitHub App で repo を選択して接続する
2. repo をブラウザ IDE で開く
3. branch を作る
4. Branch Goal を Markdown で書く
5. diff やファイルを見ながら LLM と相談する
6. AI が小さな patch proposal を出す
7. Patch Queue で検証する
8. Diff Preview で確認して適用する
9. WebContainer で tests / typecheck を実行する
10. commit message を生成する
11. push する
12. PR title / description / risk / test plan を生成する
13. Soft Gate を確認して PR を作成する

## 設計判断

### なぜ WebLLM を使うのか

クラウド LLM API を使うと、公開後に推論コストが発生します。WebLLM なら、WebGPU 対応ブラウザ上でユーザー端末側に推論を寄せられます。

また、ブラウザ内推論、WebGPU、Worker 分離、モデルロード UX などを扱えるため、ポートフォリオとして技術的な説明材料が多いです。

### なぜ Ollama fallback を入れるのか

WebLLM は端末性能やブラウザ対応に依存します。また、ブラウザで動く小型モデルだけでは、複雑な patch proposal が難しい場合があります。

Ollama fallback を first-class に扱うことで、WebLLM-first の思想を保ちつつ、実用性を上げます。どちらもローカル推論なので、無料運用とプライバシーの方針は維持できます。

### なぜ GitHub App を使うのか

選択した repo のみに権限を絞れるからです。

ユーザーの全 repo に広い権限を要求するより安全で、最小権限設計として説明しやすいです。Cloudflare Worker に OAuth callback と token exchange を寄せることで、ブラウザに secret を置かない構成にします。

### なぜ Cloudflare D1 を使うのか

プロダクトとしては DB なしでも成立します。コードは GitHub、履歴は Git、PR は GitHub にあります。

ただしポートフォリオとして backend / DB 設計も見せたいので、D1 を Branch to PR workflow metadata の保存に使います。

重要なのは、コード本文や diff 本文を保存しないことです。保存するのは session、AI action、patch proposal status、safety checklist result、runtime summary、PR URL などの metadata に限定します。

これにより、DB 設計をアピールしながら、機密コードをサーバーに持たない privacy-aware な設計にできます。

### なぜ Structured Edit Operation なのか

小さな LLM に unified diff を正確に出させるのは失敗しやすいです。

そこで、AI には `file`、`find`、`replacement`、`reason` のような構造化された編集命令を返させます。IDE 側で検証し、現在のファイル内容と一致した場合だけ diff を生成します。

### なぜ Patch Queue が必要なのか

AI の提案をすぐ適用すると危険です。

Patch Queue に積むことで、複数の提案を比較したり、失敗した patch を regenerate したり、適用前に safety checklist を確認できます。

### なぜ Demo Mode が必要なのか

WebLLM の初回モデルロードや GitHub App install は、ポートフォリオを見る人には重い可能性があります。

Demo Repo + Recorded AI Mode を用意することで、ログインやモデルセットアップなしに、Branch to PR Flow と AI workflow safety の価値を短時間で体験できます。

## 想定質問と回答

### Q. このプロジェクトで一番難しい点は何ですか？

AI の出力を実用的かつ安全にコード変更へつなげる設計です。

単に LLM API を呼ぶだけなら難しくありませんが、どの文脈を渡すか、どの範囲を編集させるか、どのように検証するか、失敗時にどう回復するかまで考える必要があります。

Git AI IDE では Context Pack、Structured Edit Operation、Patch Queue、Diff Preview に分けて、AI の不確実性を UI と設計で吸収します。

### Q. 小さいブラウザ LLM で本当に役に立ちますか？

大きな機能を自律実装させる前提にはしていません。

小さい LLM に向いている diff summary、risk checklist、commit message、PR description、selected-range patch に絞ります。IDE 側が Branch Goal と Context Pack で問題を小さく切ることで、弱いモデルでも役に立つ場面を作ります。

### Q. なぜ Cursor や VS Code ではなくブラウザ IDE を作るのですか？

既存 IDE を置き換えることが目的ではありません。

ブラウザ上で GitHub repo、Git 操作、ローカル AI runtime、patch review を統合し、無料公開できる形で AI workflow safety を検証することが目的です。

### Q. セキュリティ面では何を考えていますか？

GitHub App は選択 repo のみに権限を限定します。OAuth callback と token exchange は Cloudflare Worker に寄せ、ブラウザに app secret を置きません。

AI のコード変更も直接適用せず、Patch Queue と Diff Preview を必須にします。さらに、Context Pack を可視化して、ユーザーが AI に渡す情報を調整できるようにします。

D1 にはコード本文や diff 本文を保存せず、workflow metadata だけを保存します。

### Q. WebContainer を入れる理由は何ですか？

Branch to PR Flow では、コード変更後に tests や typecheck を実行できることが重要です。

WebContainer により、対応できる JS / TS repo ではブラウザ内で test / preview を実行し、そのログを Context Pack に入れて AI に説明や修正案を出させられます。

### Q. すべての repo を実行できますか？

実行は best-effort です。

Any repo を開けることを目指しますが、runtime 実行は repo の種類に依存します。JS / TS repo は WebContainer で実行できる可能性が高く、それ以外の repo は Git 操作、diff review、AI explanation、PR creation を中心に扱います。

### Q. PR 作成前に強制チェックしないのはなぜですか？

開発フローを止めすぎないためです。

Git AI IDE は Soft Gate を採用します。tests 未実行、risk review 未実施、runtime unavailable などを警告しますが、最終判断はユーザーに残します。

## 面接で強く言えるポイント

- AI の出力を信頼しすぎず、検証可能な workflow に落とした
- 小さい local LLM の制約を前提に、Context Pack と task gating を設計した
- GitHub Branch to PR Flow に統合することで、実際の開発フローに近づけた
- WebLLM と Ollama fallback により、無料運用と実用性を両立した
- GitHub App により、repo 権限を最小化した
- Cloudflare Pages + Workers で、無料公開しやすい構成にした
- Cloudflare D1 を workflow metadata に限定し、DB 設計と privacy-aware 設計を両立した
- Demo Mode により、採用担当者が短時間で価値を理解できるようにした

## デモで見せる順番

1. Demo Repo を開く
2. Branch Goal を表示する
3. Repo Map と Context Pack を見せる
4. `Explain diff` を実行する
5. `Suggest small patch` を実行する
6. Patch Queue と Safety Checklist を見せる
7. Diff Preview で patch を確認する
8. patch を適用する
9. tests / logs を見せる
10. commit message を生成する
11. PR description を生成する
12. Soft Gate を見せる

## README に載せる短い紹介文

Git AI IDE は、GitHub の Branch to PR フローをローカル LLM と一緒に安全に進めるための Git-aware ブラウザ IDE です。

WebLLM と Ollama fallback により、クラウド LLM API に依存せず、無料公開しやすい構成を目指しています。AI の修正提案は Structured Edit Operation として扱い、Patch Queue、Safety Checklist、Diff Preview を通して、ユーザーが確認してから適用します。

このプロジェクトでは、AI コーディング体験における「便利さ」だけでなく、「文脈の透明性」「変更の検証可能性」「Git workflow との統合」を重視しています。

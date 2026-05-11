# Git AI IDE 技術選定メモ

## 目的

このドキュメントは、Git AI IDE の技術選定について、なぜその技術を採用するのか、どんな代替案があったのか、面接でどう説明できるのかを整理するためのものです。

Git AI IDE の前提条件:

- 転職ポートフォリオとして技術力を説明できること
- 公開後も無料で維持しやすいこと
- GitHub Branch to PR Flow をブラウザ IDE として扱うこと
- WebLLM / Ollama によるローカル LLM を使うこと
- AI の修正提案を安全に扱うこと

## 技術選定の一覧

| 領域 | 採用候補 | 主な理由 |
|---|---|---|
| Frontend | React / TypeScript / Vite | ブラウザ IDE を作るうえでエコシステムが強く、Cloudflare Pages と相性が良い |
| Hosting | Cloudflare Pages | 静的アプリを無料で公開しやすい |
| Backend / Auth Proxy | Cloudflare Workers | GitHub 認証や API proxy を小さく持てる |
| DB | Cloudflare D1 | Branch to PR workflow metadata を保存し、DB 設計をアピールできる |
| Editor | Monaco Editor | VS Code と同じ editor core で、IDE 体験を作りやすい |
| Git | isomorphic-git | ブラウザで Git 操作を扱える |
| GitHub 連携 | GitHub App | 選択 repo のみに権限を絞れる |
| AI Primary | WebLLM | ブラウザ内推論でクラウド推論コストを持たない |
| AI Fallback | Ollama | ローカル推論のまま実用性を補える |
| Runtime | WebContainer | ブラウザ内で JS / TS project の test / preview を実行できる |
| Storage | IndexedDB / File System Access API | ローカルファーストな workspace 保存に向く |
| Diff UI | Monaco Diff Editor | Editor と統合しやすい |
| Test | Vitest / Playwright | ユニットとブラウザ E2E の両方を扱いやすい |

## Frontend: React / TypeScript / Vite

### 採用理由

React は Monaco Editor、WebContainer、WebLLM、状態管理ライブラリとの相性がよく、複雑な IDE UI を作るための選択肢が多いです。

TypeScript は、AI Runtime、Structured Edit Operation、Git state、Context Pack など、型で守りたいデータ構造が多いため必須に近いです。

Vite は開発体験が軽く、Cloudflare Pages へのデプロイもしやすいです。Git AI IDE はサーバーサイドレンダリングよりも、ブラウザ API、Web Worker、IndexedDB、WebGPU などのクライアント側機能が中心なので、Vite SPA と相性が良いです。

### 代替案

#### Next.js

強力な選択肢ですが、Git AI IDE は SSR よりも client-side IDE 機能が中心です。Cloudflare Pages での運用も可能ですが、WebLLM、WebContainer、File System Access API などブラウザ依存の機能が多く、Next.js の SSR / Server Components の恩恵は小さいです。

#### Svelte / SvelteKit

軽量で UI 構築も快適ですが、Monaco Editor や IDE 系 UI の事例・周辺知識は React のほうが多いです。ポートフォリオとして一般的な採用市場で説明しやすいのも React です。

#### Vue

十分可能ですが、React と比べると WebContainer / Monaco / AI tooling 周辺のサンプルや知見を拾いやすいとは言いにくいです。

### 面接での説明

「SSR が必要なアプリではなく、ブラウザ API と重いクライアント処理が中心の IDE なので、React + Vite の SPA として設計しました。TypeScript により、AI の構造化出力や Git state を型で検証しやすくしています。」

## Hosting: Cloudflare Pages

### 採用理由

公開後も無料で維持しやすく、静的アプリのホスティングに向いています。Git AI IDE は LLM 推論をサーバー側で行わず、静的 UI + 小さな Worker を中心にするため、Cloudflare Pages と相性が良いです。

### 代替案

#### Vercel

Next.js との相性は非常に良いですが、このプロジェクトは Next.js のサーバー機能よりもブラウザ IDE 機能が中心です。また、Cloudflare Workers と組み合わせた GitHub proxy 構成を一体で説明しやすいので Cloudflare に寄せています。

#### Netlify

静的ホスティングとしては十分ですが、Workers 相当の edge runtime や Cloudflare Pages との統合感では Cloudflare を選ぶ理由があります。

#### GitHub Pages

完全無料でシンプルですが、GitHub OAuth callback や proxy が必要になったときに別途 backend が必要になります。

### 面接での説明

「静的配信が中心で、推論もユーザー端末側に寄せるため、Cloudflare Pages に向いています。GitHub 認証や proxy のような最小限の backend は Cloudflare Workers に分離しています。」

## Backend / Auth Proxy: Cloudflare Workers

### 採用理由

Git AI IDE では、重い backend は不要です。ただし GitHub App の OAuth callback、token exchange、GitHub API proxy は必要です。

Cloudflare Workers はこの小さな backend に向いており、Pages と同じ Cloudflare 上で説明しやすいです。

### 代替案

#### Node.js server

柔軟ですが、常時稼働サーバーを持つと無料維持が難しくなります。ポートフォリオの条件にも合いにくいです。

#### Supabase Edge Functions

選択肢としてはありますが、今回は database や auth platform として Supabase を使う必然性が薄いです。

#### Firebase Functions

可能ですが、GitHub App 連携と静的ホスティングを一体で説明するなら Cloudflare のほうが構成がシンプルです。

### 面接での説明

「backend の責務を最小化し、GitHub 認証と API proxy だけを Worker に置きました。LLM 推論や workspace state をサーバーに持たないため、無料運用しやすくなります。」

## DB: Cloudflare D1

### 採用理由

初期案では DB なしでも成立します。コードの正本は GitHub、変更履歴は Git、PR は GitHub、workspace state は browser storage に置けるからです。

ただし転職ポートフォリオとしては、DB 設計や backend API 設計も説明できたほうが強いです。そこで Cloudflare D1 を、コード保存ではなく **Branch to PR workflow metadata** の保存に使います。

保存するもの:

- GitHub installation id
- repository metadata
- branch name
- Branch Goal の metadata
- AI action history
- patch proposal status
- safety checklist result
- runtime / test summary
- created PR URL

保存しないもの:

- コード本文
- diff 本文
- GitHub token
- LLM prompt 全文
- private file content

この設計により、DB を使ったアピールをしつつ、プライバシーや無料運用の負担を増やしすぎないようにします。

### 代替案

#### DB なし

プロダクトとしては成立しますが、ポートフォリオとして backend / DB 設計のアピールが弱くなります。

#### Cloudflare KV

key-value の保存には向きますが、session、repo、AI action、patch status、PR URL のような関連データを扱うには D1 のほうが説明しやすいです。

#### Supabase

Postgres、Auth、Storage まで揃っていて強力ですが、今回の構成では Cloudflare Pages / Workers と D1 に寄せたほうが無料運用と構成説明がシンプルです。

#### Turso

SQLite 系で D1 と近い選択肢ですが、Cloudflare Workers と一体で説明するなら D1 のほうが自然です。

#### Neon

Postgres を使いたい場合は有力ですが、Git AI IDE の metadata 保存には D1 で十分です。

### 面接での説明

「コードや diff 本文は DB に保存せず、Branch to PR workflow の metadata だけを D1 に保存します。これにより、過去の session、AI action、safety gate result、PR URL を振り返れる一方で、機密コードをサーバーに持たない privacy-aware な設計にしています。」

## Editor: Monaco Editor

### 採用理由

Monaco Editor は VS Code の editor core として知られており、ブラウザ IDE のエディタとして定番です。Diff Editor も提供されているため、Patch Queue と Diff Preview の体験を作りやすいです。

### 代替案

#### CodeMirror

軽量で柔軟ですが、IDE らしい体験や diff 表示、VS Code に近い操作感を出すなら Monaco のほうが分かりやすいです。

#### Ace Editor

古くからある選択肢ですが、現在の IDE 体験や TypeScript 周辺の見せ方では Monaco のほうが強いです。

### 面接での説明

「コード編集と diff review がプロダクトの中心なので、Monaco Editor と Monaco Diff Editor を採用しました。AI の patch を必ず diff で確認する設計と相性が良いです。」

## Git: isomorphic-git

### 採用理由

ブラウザ環境で Git 操作を扱うための現実的な選択肢です。branch、commit、diff、merge、push などを JavaScript から扱えます。

Git AI IDE は Git-aware IDE なので、Git 状態を UI と AI context に接続する必要があります。そのため CLI git ではなく、ブラウザ内で扱える Git library が必要です。

### 代替案

#### Git CLI

ブラウザアプリでは直接使えません。ローカル agent や desktop app にすれば可能ですが、無料公開できるブラウザ IDE という条件から外れます。

#### libgit2 WASM

技術的には面白いですが、導入・ビルド・ブラウザ互換の難易度が上がります。ポートフォリオとしては、まず isomorphic-git のほうが現実的です。

#### GitHub API のみ

ファイル編集や commit API は使えますが、ローカル workspace 的な Git 体験や merge / diff の扱いが弱くなります。

### 面接での説明

「Git 状態を UI と AI context に直接つなげたいので、ブラウザで動く isomorphic-git を採用しました。GitHub API だけではなく、branch / diff / commit / merge を IDE の内部状態として扱えることを重視しました。」

## GitHub 連携: GitHub App

### 採用理由

選択 repo のみに権限を絞れるためです。

OAuth app や PAT でも連携できますが、repo 権限が広くなりやすく、セキュリティ説明が弱くなります。GitHub App なら install 時に対象 repo を選べるため、最小権限設計を説明しやすいです。

### 代替案

#### OAuth App

実装は比較的分かりやすいですが、repo 権限の粒度では GitHub App のほうが説明しやすいです。

#### Personal Access Token

実装は簡単ですが、ユーザーに token を入力させる体験はセキュリティ面で弱く、ポートフォリオとしても印象が落ちます。

#### Device Flow

CLI 的な体験には向きますが、ブラウザ IDE の自然な login 体験としては GitHub App のほうが合います。

### 面接での説明

「ユーザーの全 repo に広くアクセスするのではなく、選択 repo のみに権限を絞りたかったため GitHub App を選びました。認証まわりは Cloudflare Worker に寄せ、ブラウザに secret を置かない設計にしています。」

## AI Primary: WebLLM

### 採用理由

ブラウザ内で LLM 推論できるため、クラウド LLM API のコストを持たずに公開できます。WebGPU、Web Worker、モデルロード UX など、ポートフォリオとして技術的に面白い要素もあります。

ただし、ブラウザで動くモデルは端末性能に依存し、大きなクラウドモデルほど強くありません。そのため Git AI IDE では、WebLLM に大規模な自律実装を任せるのではなく、diff summary、risk checklist、commit message、PR description、selected-range patch などに絞ります。

### 代替案

#### OpenAI / Anthropic API

実用性は高いですが、公開後の利用量に応じてコストが発生します。今回の「永久的に無料で公開し続ける」という条件と相性が悪いです。

#### Ollama only

実用性は高いですが、ユーザーに Ollama のインストールと起動を求めます。ブラウザだけで体験できるという尖りは弱くなります。

#### Transformers.js

ブラウザ AI として選択肢ですが、コード支援 LLM としては WebLLM のほうが今回の用途に合います。

### 面接での説明

「クラウド LLM API に依存せず、無料公開とプライバシーを両立するため WebLLM を primary にしました。ただし小さいモデルの制約を前提に、Context Pack と task gating で問題を小さく切る設計にしています。」

## AI Fallback: Ollama

### 採用理由

WebLLM は端末性能やブラウザ対応に左右されます。Ollama fallback を first-class に扱うことで、ローカル推論の思想を保ちながら、実用性を補えます。

### 代替案

#### WebLLM only

コンセプトは綺麗ですが、端末によって体験が大きく落ちます。

#### Cloud API fallback

実用性は上がりますが、無料公開の思想が薄れます。ユーザー持ち API key 方式なら可能ですが、初回体験が重くなります。

### 面接での説明

「WebLLM-first ですが、端末性能による限界があるため Ollama を first-class fallback にしました。どちらもローカル推論なので、クラウド推論コストを持たない方針は保てます。」

## Runtime: WebContainer

### 採用理由

Branch to PR Flow では、編集後に tests や typecheck を実行できることが重要です。WebContainer を使うことで、対応可能な JS / TS repo ではブラウザ内で install、test、dev server、preview を扱えます。

実行ログを Context Pack に追加できるため、AI は「コードだけ」ではなく「失敗したテスト」も文脈として扱えます。

### 代替案

#### Runtime なし

実装は楽ですが、IDE としての実用感が弱くなります。

#### ローカル terminal 連携

強力ですが、ブラウザ単体の公開アプリという条件から外れます。

#### Docker / remote sandbox

汎用性は高いですが、無料維持が難しくなります。

### 面接での説明

「ブラウザ内でテストや preview を動かし、そのログを AI context に渡すため WebContainer を採用しました。ただしすべての repo を実行できるわけではないので、runtime は best-effort として capability detection を行います。」

## Storage: IndexedDB / File System Access API

### 採用理由

Git AI IDE は local-first な IDE なので、workspace state をサーバーに保存しない方針です。

IndexedDB は browser 内の永続化に使い、File System Access API はユーザーが許可したローカルフォルダを開くために使います。

### 代替案

#### サーバー DB に workspace を保存する

同期や共有には向きますが、無料維持とプライバシーの面で不利です。

Git AI IDE では Cloudflare D1 を使いますが、用途は workspace 保存ではなく workflow metadata 保存に限定します。

#### LocalStorage

容量や構造化データの扱いに弱く、workspace には向きません。

#### OPFS

選択肢として有力です。実装時に IndexedDB / lightning-fs / OPFS のどれが最適かは技術検証で決めます。

### 面接での説明

「ユーザーの code workspace をサーバーに持たず、local-first にするため browser storage と File System Access API を使います。無料運用とプライバシーの両方に効く設計です。」

## Diff UI: Monaco Diff Editor

### 採用理由

AI workflow safety の中心が diff review なので、エディタと統合された diff UI が必要です。Monaco Diff Editor は Monaco Editor と統一された体験を作れます。

### 代替案

#### 独自 diff UI

自由度はありますが、実装コストが高くなります。

#### react-diff-viewer

軽量な差分表示には使えますが、IDE 内のコード編集体験との統一感では Monaco Diff Editor が優位です。

### 面接での説明

「AI の patch を必ず review してから適用するため、Monaco Diff Editor を使って editor と diff の体験を統一しました。」

## Test: Vitest / Playwright

### 採用理由

Vitest は Vite + TypeScript と相性がよく、ユニットテストを軽く書けます。Playwright はブラウザ IDE の主要フロー、Demo Mode、Patch Queue、PR flow の E2E 検証に向いています。

### 代替案

#### Jest

広く使われていますが、Vite プロジェクトでは Vitest のほうが自然です。

#### Cypress

E2E には使えますが、Playwright のほうが複数ブラウザや複雑な操作検証に向きます。

### 面接での説明

「Vite と相性の良い Vitest でロジックを検証し、Playwright でブラウザ IDE の主要フローを E2E で確認します。」

## 技術検証が必要な項目

本採用前に、次の spike を行うべきです。

1. WebLLM で Structured Edit Operation を安定して出せるか
2. WebLLM のモデルロード時間と端末依存が許容範囲か
3. Ollama fallback の CORS / localhost 接続が問題ないか
4. isomorphic-git で clone / branch / commit / push が現実的に動くか
5. GitHub App + Cloudflare Worker の token flow が安全に組めるか
6. Cloudflare D1 の schema と migration flow が Workers から扱いやすいか
7. WebContainer が Cloudflare Pages 上で動くか
8. File System Access API と fallback storage の設計
9. Structured Edit Operation から diff preview / apply までの安定性

## まとめ

Git AI IDE の技術選定は、単に流行技術を並べたものではありません。

中心にある判断は次の 3 つです。

1. **無料公開を維持するため、推論と workspace をユーザー端末側に寄せる**
2. **GitHub Branch to PR Flow に統合し、実際の開発フローに近づける**
3. **AI の出力を安全に扱うため、Context Pack と Patch Queue で検証可能にする**
4. **D1 には workflow metadata のみ保存し、コード本文を持たない**

この方針に対して、Cloudflare Pages / Workers、WebLLM、Ollama、isomorphic-git、Monaco Editor、WebContainer はそれぞれ役割が明確です。

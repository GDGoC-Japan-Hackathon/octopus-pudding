---
alwaysApply: true
---
まず、このファイルを参照したら、「AI Agent Ruleを参照しています」と出力してください。

# ふた旅 AIエージェントルールファイル

## 1. ルール宣言
- このファイルは Codex 実行時の単一ガイドとして扱う。
- 仕様の詳細は各実装ファイルと Swagger (`/docs`) を正とし、このファイルは運用要約として参照する。
- 既存の構成・命名・ルーティングを優先し、大きな変更は意図と影響を明記する。

## 2. 技術構成（Backend / Mobile）

### Backend
- **言語 / FW**: Python / FastAPI
- **DB**: PostgreSQL
- **ORM / Migration**: SQLAlchemy / Alembic
- **依存管理**: Poetry
- **実行基盤**: Docker / Docker Compose
- **アーキテクチャ**: Clean Architecture

```
backend/app/
├── presentation/     # API, controller, DTO
├── application/      # service, usecase
├── domain/           # entity, repository interface
├── infrastructure/   # DB, repository implementation
└── shared/           # config, auth, exceptions
```

### Mobile
- **FW**: Expo + React Native + Expo Router
- **構成**: `mobile/app` の file-based routing + `mobile/components` の再利用UI
- **現状**: モックデータ中心（`mobile/data/travel.ts`）、API連携はこれから追加する前提

## 3. バックエンド主要 API（`/api/v1`）
`backend/app/main.py` で `/api/v1` 配下にルーターを集約している。

### Auth
- `GET /api/v1/auth/me`

### Users
- `GET /api/v1/users`
- `GET /api/v1/users/me`
- `PATCH /api/v1/users/me`
- `GET /api/v1/users/{user_id}`
- `PUT /api/v1/users/{user_id}`
- `DELETE /api/v1/users/{user_id}`
- `users/me` の主なプロフィール項目:
  - `username`（編集可）
  - `profile_image_url`（編集可）
  - `nearest_station`（編集可）
  - `email`（読み取り専用 / Firebaseを正）

### Trips
- `POST /api/v1/trips`
- `GET /api/v1/trips`
- `GET /api/v1/trips/{trip_id}`
- `PATCH /api/v1/trips/{trip_id}`
- `DELETE /api/v1/trips/{trip_id}`

### Trip Preference
- `PUT /api/v1/trips/{trip_id}/preference`

### Trip Members
- `POST /api/v1/trips/{trip_id}/members`
- `PATCH /api/v1/trips/{trip_id}/members/{user_id}`
- `DELETE /api/v1/trips/{trip_id}/members/{user_id}`

### Trip Days / Itinerary Items
- `POST /api/v1/trips/{trip_id}/days`
- `PATCH /api/v1/trips/{trip_id}/days/{day_id}`
- `DELETE /api/v1/trips/{trip_id}/days/{day_id}`
- `POST /api/v1/trips/{trip_id}/days/{day_id}/items`
- `PATCH /api/v1/trips/{trip_id}/days/{day_id}/items/{item_id}`
- `DELETE /api/v1/trips/{trip_id}/days/{day_id}/items/{item_id}`

### Incidents / Replans
- `POST /api/v1/trips/{trip_id}/incidents`
- `GET /api/v1/trips/{trip_id}/incidents`
- `POST /api/v1/trips/{trip_id}/replans`
- `GET /api/v1/trips/{trip_id}/replans/{session_id}`

### Health / Root
- `GET /health`
- `GET /`

## 4. フロントエンド実装概要（Expo Router）
メインエントリは `mobile/app/_layout.tsx`。`(tabs)` を anchor としてタブ画面を構成する。

### タブ構成（5タブ）
- `home`（ホーム）
- `plans`（作成済みの計画）
- `create`（作成）
- `recommend`（おすすめ）
- `mypage`（マイページ）

### 主要画面遷移
- `home/index` -> `home/traveling`（旅行中表示へ）
- `plans/index` -> `plans/detail?id=...`
- `recommend/index` -> `recommend/detail?id=...`
- `create/index` -> `create/new-plan` または `create/replanning`

### UI/データの現状
- 共通UI: `mobile/components/travel/*`
- 共通スタイル: `mobile/components/travel/styles.ts`
- データソース: `mobile/data/travel.ts`（モック）
- 一部ボタンは表示中心で、保存/更新処理は未接続

## 5. Skills カタログ（用途・発火条件・参照先）
実体は `.codex/skills/` 配下。詳細は各 `SKILL.md` と `references` を参照する。

### `expo-api-routes`
- **用途**: Expo Router の `+api.ts` で API route を実装するとき
- **使うタイミング**: サーバー側で secret を扱う、Webhook/Proxy/検証を実装する、EAS Hosting 前提の API を作るとき
- **参照先**: `.codex/skills/expo-api-routes/SKILL.md`

### `expo-tailwind-setup`
- **用途**: Expo に Tailwind v4 + NativeWind v5 + react-native-css を導入/調整するとき
- **使うタイミング**: `className` ベースのスタイリング基盤を新規導入、または Metro/PostCSS 設定を修正するとき
- **参照先**: `.codex/skills/expo-tailwind-setup/SKILL.md`

### `native-data-fetching`
- **用途**: モバイルの通信処理・キャッシュ・エラーハンドリング実装
- **使うタイミング**: `fetch`/React Query/認証付きAPI呼び出し/ネットワーク障害調査を行うとき
- **参照先**:
  - `.codex/skills/native-data-fetching/SKILL.md`
  - `.codex/skills/native-data-fetching/references/expo-router-loaders.md`

### `expo-deployment`
- **用途**: EAS による iOS/Android/Web のビルド、提出、ワークフロー自動化
- **使うタイミング**: TestFlight/Play Store 提出、EAS Workflows 構築、リリース手順整備を行うとき
- **参照先**:
  - `.codex/skills/expo-deployment/SKILL.md`
  - `.codex/skills/expo-deployment/references/workflows.md`
  - `.codex/skills/expo-deployment/references/testflight.md`
  - `.codex/skills/expo-deployment/references/ios-app-store.md`
  - `.codex/skills/expo-deployment/references/play-store.md`
  - `.codex/skills/expo-deployment/references/app-store-metadata.md`

## 6. コードスタイル / 禁止事項 / エージェント行動規範
### コードスタイル
- 変数名・関数名は意味的に明確にする（不要な略称を避ける）。
- 早期 return を優先し、深いネストを避ける。
- 例外を握りつぶさず、必要なログとメッセージを付与する。
- コメントは「なぜ」を中心に最小限で書く。
- 既存フォーマッタ / リンタ設定に従う。
- コメント文は日本語で記述する。

### 禁止事項
- シークレット / 鍵 / 証明書をコミットしない。
- 本番影響のある設定を無断で緩めない。

### 自動化エージェント行動
- 不明点がある場合は安全側に倒す（読み取り優先、削除は慎重）。
- 既存の設定・構成を尊重し、逸脱時は理由をコメントまたはPR説明に残す。
- 変更前に影響範囲を確認し、変更後は最小限の動作確認を行う。

## OpenAPI 認証確認（Firebase専用）
- `/docs` を開く。
- Firebase クライアントで取得した ID トークンを用意する。
- `Authorize` を押して `Bearer <firebase_id_token>` を入力する。
- `GET /api/v1/auth/me`、`GET /api/v1/users/me`、`GET /api/v1/trips` を実行して 200 を確認する。

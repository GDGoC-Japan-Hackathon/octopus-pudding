# ふた旅 アプリケーション

FastAPI、PostgreSQL、Dockerを使用したクリーンアーキテクチャに基づくAPIサーバーです。

## アーキテクチャ

このプロジェクトはクリーンアーキテクチャの原則に従って設計されています：

```
app/
├── presentation/     # プレゼンテーション層（API、コントローラー、DTO）
├── application/      # アプリケーション層（ユースケース、サービス）
├── domain/          # ドメイン層（エンティティ、リポジトリインターフェース）
├── infrastructure/  # インフラ層（データベース、外部サービス）
└── shared/          # 共有コンポーネント（設定、例外）
```

### レイヤーの説明

- **Presentation Layer**: APIエンドポイント、コントローラー、DTO
- **Application Layer**: ビジネスロジック、ユースケース、サービス
- **Domain Layer**: エンティティ、リポジトリインターフェース、ドメインルール
- **Infrastructure Layer**: データベース実装、外部サービス、リポジトリ実装
- **Shared Layer**: 設定、例外、ユーティリティ

## 技術スタック

- **FastAPI**: モダンなPython Webフレームワーク
- **PostgreSQL**: リレーショナルデータベース
- **SQLAlchemy**: ORM
- **Alembic**: データベースマイグレーション
- **Poetry**: 依存関係管理
- **Docker**: コンテナ化


# 環境構築
## バックエンド

### 前提条件

- Docker
- Docker Compose
- Poetry (ローカル開発用)

### 環境変数の設定

```bash
cp env.example .env
```

`.env`ファイルを編集して、必要に応じて設定を変更してください。


```
$ cd backend
$ poetry lock //ローカルでロックファイルを更新
$ docker compose build
$ docker compose up -d
$ docker compose down
```

`docker compose up -d`でエラーが出る場合，pyproject.toml と poetry.lock の内容が食い違っている可能性が高いです．`poetry lock`でバージョンを合わせてからdockerを立ち上げてください

dockerのAPIサーバーが立ち上がっている状態で`http://localhost:8000/docs`にアクセスするとSwagger UIのAPIドキュメントが開きます．ここでAPIの動作確認等を行うことができます．

パッケージ管理は`poetry`を用いています．
poetry はPythonのパッケージ管理を行ってくれるツールです．RubyにおけるBundlerやJavaにおけるMavenのように，パッケージ同士の依存関係を解決してくれます．
Pythonでは，最もプリミティブなパッケージ管理として pip が有名ですが，poetry では pip が行わないパッケージ同士の依存関係の解決や，lockファイルを利用したバージョン固定，Pythonの仮想環境管理など，より高機能でモダンなバージョン管理が行えます．

新しいPythonパッケージを追加した場合などは以下のようにイメージを再ビルドするだけで、 pyproject.toml に含まれている全てのパッケージをインストールすることができます．
```
$ docker-compose build --no-cache
```

## ローカルでのDB確認方法

```
$ docker compose exec db psql -U postgres -d entry_up_db
```
docker desktop上のconsoleで確認したい時は
```
$ psql -U postgres -d entry_up_db
```

## マイグレート方法

このプロジェクトではAlembicを使用してデータベースマイグレーションを管理しています。Makefileを使用して簡単にマイグレーション操作を行えます。

### 基本的なマイグレーション操作

#### 1. マイグレーションファイルの自動生成
モデルを変更した後、以下のコマンドでマイグレーションファイルを自動生成します：

```bash
make migrate name="マイグレーションの説明"
```

例：
```bash
make migrate name="add user table"
make migrate name="add email column to users"
```

#### 2. マイグレーションの確認
生成されたマイグレーションファイルの変更差分をローカルで確認することができます．migration.sqlで確認できます
```bash
make dry-run
```

#### 2. マイグレーションの適用
生成されたマイグレーションファイルをデータベースに適用します：

```bash
make apply
```

#### 3. 現在のマイグレーション状態の確認
データベースの現在のマイグレーション状態を確認します：

```bash
make current
```

#### 4. マイグレーションのロールバック
1つ前のマイグレーションに戻します：

```bash
make rollback
```

### 手動でのマイグレーション操作

Makefileを使用しない場合は、以下のコマンドを直接実行できます：

```bash
# マイグレーションファイルの生成
docker compose exec backend poetry run alembic revision --autogenerate -m "マイグレーションの説明"

# マイグレーションの確認
docker compose exec backend poetry run alembic upgrade head --sql > migration.sql

# マイグレーションの適用
docker compose exec backend poetry run alembic upgrade head

# 現在の状態確認
docker compose exec backend poetry run alembic current

# ロールバック
docker compose exec backend poetry run alembic downgrade -1
```

### 注意事項

- マイグレーションファイルは`backend/alembic/versions/`に生成されます
- 生成されたマイグレーションファイルは必ず内容を確認して`make dry-run`で変更を確認してから適用してください
- チーム開発では、マイグレーションファイルをコミットして共有してください


## API エンドポイント

### ヘルスチェック
- `GET /health` - アプリケーションの状態確認

### ユーザー管理
- `GET /api/v1/users/` - ユーザー一覧取得
- `GET /api/v1/users/{user_id}` - 特定ユーザー取得
- `POST /api/v1/users/` - ユーザー作成
- `PUT /api/v1/users/{user_id}` - ユーザー更新
- `DELETE /api/v1/users/{user_id}` - ユーザー削除

## プロジェクト構造

```
backend/
├── app/
│   ├── presentation/          # プレゼンテーション層
│   │   ├── controllers/       # APIコントローラー
│   │   ├── dto/              # データ転送オブジェクト
│   │   └── routes/           # APIルート
│   ├── application/          # アプリケーション層
│   │   └── services/         # アプリケーションサービス
│   ├── domain/               # ドメイン層
│   │   ├── entities/         # ドメインエンティティ
│   │   └── repositories/     # リポジトリインターフェース
│   ├── infrastructure/       # インフラ層
│   │   ├── database/         # データベース関連
│   │   └── repositories/     # リポジトリ実装
│   └── shared/               # 共有コンポーネント
│       ├── config.py         # 設定管理
│       └── exceptions.py     # カスタム例外
├── alembic/                  # データベースマイグレーション
├── docker-compose.yml        # Docker Compose設定
├── Dockerfile               # Docker設定
├── pyproject.toml           # Poetry設定
└── README.md               # プロジェクト説明
```
.PHONY: migrate dry-run apply current rollback up down status logs logs-api logs-db deps

# Docker Composeサービスを起動
up:
	docker compose up -d --build

# APIコンテナ内の依存関係を再同期
deps:
	docker compose exec api poetry install --only=main --no-interaction --no-ansi --no-root

# Docker Composeサービスを停止
down:
	docker compose down

# サービスの状態を確認
status:
	docker compose ps

# 全サービスのログを表示
logs:
	docker compose logs -f

# APIサービスのログを表示
logs-api:
	docker compose logs api

# DBサービスのログを表示
logs-db:
	docker compose logs db

# マイグレーションを作成（例: make migrate name="add hoge table"）
migrate:
	docker compose exec api poetry run alembic revision --autogenerate -m '$(name)'

# マイグレーションをローカルで確認（SQLファイル出力）
dry-run:
	docker compose exec api poetry run alembic upgrade head --sql > migration.sql

# マイグレーションを適用
apply:
	docker compose exec api poetry run alembic upgrade head

# DBの状態を確認
current:
	docker compose exec api poetry run alembic current

# DBのダウングレード（1つ前に戻す）
rollback:
	docker compose exec api poetry run alembic downgrade -1

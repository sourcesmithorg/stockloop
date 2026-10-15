.PHONY: template env db-up db-down db-logs up down logs seed shell-api

template:
	cd .template && python3 -m http.server 4173

env:
	test -f .env || cp .env.example .env

db-up:
	docker compose up -d db

db-down:
	docker compose down

db-logs:
	docker compose logs -f db

up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f

# Re-run the idempotent migration + fixture seed against the running db.
seed:
	docker compose run --rm migrate

shell-api:
	docker compose exec api /bin/sh

.PHONY: template env db-up db-down db-logs

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

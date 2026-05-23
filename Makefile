.PHONY: up down logs pull-model db-shell dev install

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

pull-model:
	docker compose exec ollama ollama pull llama3.2

db-shell:
	docker compose exec postgres psql -U postgres ai_support

install:
	npm install

dev: install
	npm run dev

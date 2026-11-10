.PHONY: up down reset logs ps build dashboard api test-frontend

up:            ## build + start full stack
	docker compose up --build

down:          ## stop stack
	docker compose down

reset:         ## stop + wipe data volumes
	docker compose down -v

logs:          ## follow backend logs
	docker compose logs -f backend

ps:            ## service status
	docker compose ps

dashboard:     ## open dashboard
	open http://localhost:5173 || xdg-open http://localhost:5173

api:           ## open API docs
	open http://localhost:8000/docs || xdg-open http://localhost:8000/docs

test-frontend: ## typecheck + build frontend locally
	cd frontend && npm install && npm run build

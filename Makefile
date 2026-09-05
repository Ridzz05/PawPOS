.PHONY: dev db-up db-down api-test api-run web-install web-dev web-build format contract-check

dev:
	@powershell -NoProfile -ExecutionPolicy Bypass -File ./scripts/dev.ps1

db-up:
	docker compose up -d postgres

db-down:
	docker compose down

api-test:
	cd apps/api && go test ./...

api-run:
	cd apps/api && go run ./cmd/server

web-install:
	npm install

web-dev:
	npm --workspace apps/web run dev

web-build:
	npm --workspace apps/web run build

format:
	gofmt -w apps/api/cmd apps/api/internal

contract-check:
	npx --yes @redocly/cli lint packages/api-contract/openapi.yaml

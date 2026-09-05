# AI Operational POS

Phase 0 foundation for a web POS focused on reliable operations. The repository is a small monorepo with a Go API, a React/MUI web app, a PostgreSQL migration, and an OpenAPI contract.

## Prerequisites

- Go 1.23 or newer for `apps/api`.
- Node.js 20 or newer and npm.
- Docker Desktop for PostgreSQL and `docker compose`.
- GNU Make is optional. Every Make target is also documented as a direct PowerShell command below.

## Run locally

From `C:\Users\muhri\Documents\ai-operational-pos`:

```powershell
Copy-Item .env.example .env
npm install
docker compose up -d postgres
Start-Process powershell -ArgumentList '-NoProfile','-Command','go run ./cmd/server' -WorkingDirectory .\apps\api
npm --workspace apps/web run dev
```

The real `.env` file is local-only and must not be committed. Leave `AI_ENABLED=false` for manual operation, or set `GROQ_API_KEY` and `AI_ENABLED=true` to enable voice transcription.

Open `http://localhost:5173`. The API exposes `http://localhost:8080/health/live`, `http://localhost:8080/health/ready`, `http://localhost:8080/api/v1/ping`, and `POST http://localhost:8080/api/v1/assistant/transcriptions` for in-memory audio transcription.

The migration is mounted into PostgreSQL's initialization directory. PostgreSQL only runs those files when the data volume is first created. To recreate the local database, run `docker compose down -v` and then `docker compose up -d postgres`.

## Validation commands

```powershell
gofmt -w apps/api/cmd apps/api/internal
Push-Location apps/api; go test ./...; Pop-Location
npm --workspace apps/web run test:run
npm --workspace apps/web run build
npx --yes @redocly/cli lint packages/api-contract/openapi.yaml
```

`make dev` delegates to `scripts/dev.ps1`. Use `make api-test`, `make web-build`, or the direct commands above when Make is not installed on Windows.

## Scope boundary

Phase 0 intentionally does not claim authentication, product, inventory, POS, shift, LLM intent recognition, mutations, or conversation state. The backend includes only the voice transcription adapter and handler needed for the assistant slice. The database contains only the foundational tables required by the plan.

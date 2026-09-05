---
title: "PawPOS Local Dev & Testing Runbook"
type: "devops"
tags:
  - pawpos
  - devops
  - testing
  - runbook
  - local-dev
status: "active"
updated_at: "2026-09-06"
related_links:
  - "[[00 - PawPOS Second Brain MOC]]"
  - "[[System Topology]]"
  - "[[Deployment Guide (PaaS & VPS)]]"
---

# 🛠️ Local Dev & Testing Runbook

Dokumen ini adalah panduan teknis untuk menjalankan, mengembangkan, dan memvalidasi sistem **PawPOS** di lingkungan komputer pengembang (Windows, macOS, Linux).

---

## 📋 1. Menjalankan Lingkungan Lokal

Dari root repository `ai-operational-pos`:

```powershell
# 1. Salin template konfigurasi environment
Copy-Item .env.example .env

# 2. Pasang semua dependensi frontend
npm install

# 3. Jalankan container PostgreSQL via Docker Compose
docker compose up -d postgres

# 4. Jalankan backend server Go (Terminal 1)
cd apps/api
go run ./cmd/server

# 5. Jalankan dev server Vite frontend (Terminal 2)
npm --workspace apps/web run dev
```

Buka peramban di:
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8080/health/live`

---

## 🧪 2. Menjalankan Skrip Seeding & Screenshot

```powershell
# Isi 7 produk pakan demo, stok mutasi, shift aktif, dan 3 transaksi:
node scripts/seed-demo-data.mjs

# Tangkap screenshot visual sistem menggunakan Playwright:
node apps/web/scripts/capture-readme-screenshots.mjs
```

---

## ✅ 3. Perintah Validasi Kualitas & Test Suite

```powershell
# Format kode Go
gofmt -w apps/api/cmd apps/api/internal

# Jalankan unit test Go
Push-Location apps/api; go test ./...; Pop-Location

# Jalankan test suite frontend Vitest
npm --workspace apps/web run test:run

# Validasi build produksi frontend
npm --workspace apps/web run build

# Linting kontrak OpenAPI 3.1
npx --yes @redocly/cli lint packages/api-contract/openapi.yaml
```

---
*Kembali ke:* [[00 - PawPOS Second Brain MOC]] | *Topik Terkait:* [[Deployment Guide (PaaS & VPS)]], [[Offline Fallback & Reliability]]

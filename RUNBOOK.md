# Runbook: Menjalankan PawPOS (Backend API & Frontend Web)

Sistem PawPOS menggunakan arsitektur monorepo yang terdiri dari:
- **Backend API**: Go (Chi Router, Port `8080`)
- **Frontend Web**: React + Vite (Port `5173`)

---

## Cara Menjalankan Server

Buka **2 terminal terpisah** (satu untuk Backend, satu untuk Frontend).

### Terminal 1: Menjalankan Backend API (Go)

**Opsi A — Dari root repository:**
```bash
go run ./apps/api/cmd/server
```

**Opsi B — Masuk ke folder API terlebih dahulu:**
```bash
cd apps/api
go run ./cmd/server
```
> Server API akan aktif di: `http://localhost:8080` (cek status: `http://localhost:8080/health/live`)

---

### Terminal 2: Menjalankan Frontend Web (React + Vite)

**Opsi A — Dari root repository:**
```bash
npm run dev
```

**Opsi B — Masuk ke folder Web terlebih dahulu:**
```bash
cd apps/web
npm run dev
```
> Aplikasi web akan aktif di: `http://localhost:5173`

---

## Verifikasi URL Penting

- **Landing Page SaaS**: `http://localhost:5173/landing`
- **Dashboard Operasional**: `http://localhost:5173/dashboard`
- **Register Kasir POS**: `http://localhost:5173/pos`
- **Katalog Produk**: `http://localhost:5173/products`
- **Health Check API**: `http://localhost:8080/health/live`
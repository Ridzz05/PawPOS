---
title: "PawPOS Monorepo Structure"
type: "architecture"
tags:
  - pawpos
  - monorepo
  - structure
status: "active"
updated_at: "2026-09-06"
related_links:
  - "[[00 - PawPOS Second Brain MOC]]"
  - "[[System Topology]]"
---

# 📦 Monorepo Structure

PawPOS dikelola dalam format **Lightweight Modern Monorepo**. Format ini menyatukan backend Go, frontend React, dokumentasi sistem, dan kontrak OpenAPI dalam satu repository terpadu untuk menjamin sinkronisasi versi yang mulus.

---

## 📂 Struktur Direktori Utama

```
ai-operational-pos/
├── apps/
│   ├── api/                     # Backend Go 1.23+ Service
│   │   ├── cmd/server/          # HTTP server bootstrap & router wiring
│   │   ├── internal/            # Domain core modules (DDD)
│   │   │   ├── assistant/       # AI Copilot, Groq & ElevenLabs logic
│   │   │   ├── auth/            # Tenant context & auth resolver
│   │   │   ├── inventory/       # Stock balances & movements ledger
│   │   │   ├── orders/          # Cart checkout & multi-tender split payment
│   │   │   ├── products/        # Product master catalog & WebP compressor
│   │   │   ├── shifts/          # Cash drawer sessions & Z-Report reconciliation
│   │   │   └── tenant/          # Multi-tenant scoping & management
│   │   ├── migrations/          # PostgreSQL DDL SQL migration files
│   │   └── go.mod               # Go dependencies declaration
│   │
│   └── web/                     # Frontend React 19 + TypeScript + Vite
│       ├── public/              # Static assets, icons, manifest
│       ├── scripts/             # Playwright automation & visual tests
│       └── src/                 # Application source code
│           ├── components/      # Common UI (Buttons, Navbar, Sidebar, Modals)
│           ├── features/        # Business feature vertical slices
│           │   ├── ai-assistant/# AI Copilot chat drawer & mic recorder
│           │   ├── dashboard/   # Executive store dashboard
│           │   ├── inventory/   # Stock tables & movement modal
│           │   ├── landing/     # SaaS marketing landing page
│           │   ├── orders/      # Transaction history & receipt audit
│           │   ├── pos/         # Cashier register POS & cart
│           │   ├── products/    # Product catalog & SKU management
│           │   ├── shifts/      # Shift sessions, denominations & Z-Report
│           │   └── tenant/      # Store profile & tenant switcher
│           └── theme/           # Material-UI custom theme & tokens
│
├── docs/                        # Dokumentasi visual & branding
│   ├── branding/                # Logo resmi PawPOS & maskot
│   └── screenshots/             # Tangkapan layar otomatis Playwright High-DPI
│
├── packages/
│   └── api-contract/            # OpenAPI 3.1 YAML Contract
│
├── scripts/
│   ├── dev.ps1                  # Development runner script untuk Windows
│   └── seed-demo-data.mjs       # Seeding data produk, stok, dan shift demo
│
├── vault/                       # Obsidian Knowledge Graph (Second Brain)
├── OBSIDIAN.md                  # Second Brain master entrypoint
├── DESIGN.md                    # Design tokens & color specifications
└── README.md                    # Dokumentasi utama GitHub
```

---

## 🛠️ Workspaces & Script Orchestration

Monorepo diorkestrasi menggunakan **NPM Workspaces** pada root:
```json
{
  "workspaces": [
    "apps/web"
  ]
}
```

Perintah cepat dari root:
- `npm --workspace apps/web run dev` — Menjalankan frontend Vite dev server.
- `npm --workspace apps/web run build` — Meng-compile bundle frontend produksi.
- `npm --workspace apps/web run test:run` — Menjalankan unit test Vitest.
- `node scripts/seed-demo-data.mjs` — Mengisi data demo ke server aktif.
- `node apps/web/scripts/capture-readme-screenshots.mjs` — Menjalankan Playwright screenshot automasi.

---
*Kembali ke:* [[00 - PawPOS Second Brain MOC]]

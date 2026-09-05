<p align="center">
  <a href="https://github.com/Ridzz05/PawPOS">
    <img src="docs/branding/pawpos_logo_enhanced.png" alt="PawPOS Logo" width="460" />
  </a>
</p>

<p align="center">
  <strong>Next-Generation AI Operational POS & Copilot Platform for Pet Care, Grooming & Veterinary Clinics</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Go-1.23+-00ADD8?style=for-the-badge&logo=go&logoColor=white" alt="Go" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Vite-6-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Playwright-E2E-2EAD33?style=for-the-badge&logo=playwright&logoColor=white" alt="Playwright" />
  <img src="https://img.shields.io/badge/Groq_AI-120B_Llama_3-F05032?style=for-the-badge&logoColor=white" alt="Groq AI" />
  <img src="https://img.shields.io/badge/ElevenLabs-Voice_TTS-black?style=for-the-badge&logoColor=white" alt="ElevenLabs" />
</p>

---

## 🐾 Overview

**PawPOS** adalah sistem operasional kasir pintar (**Smart Point of Sale**) berbasis Cloud & Edge Hybrid yang dirancang khusus untuk ekosistem **Pet Shop**, klinik dokter hewan, salon grooming, dan penitipan hewan. 

Dibangun dengan arsitektur monorepo berkinerja tinggi (**Go Clean Architecture** pada backend dan **React 19 + Material-UI Modern** pada frontend), PawPOS memadukan kecepatan checkout kasir sub-detik, rekonsiliasi kas fisik anti-selisih, manajemen batch stok pakan, dan **AI Copilot Voice (Groq 120B & ElevenLabs Multilingual v2)** yang dapat diajak berkonsultasi mengenai inventori, resep nutrisi hewan, dan panduan transaksi secara hands-free.

---

## 🌐 Live Production Demo & Akun Uji Coba (Trial Mode)

Aplikasi PawPOS telah aktif dan dapat diakses secara publik pada domain resmi:
- **URL Resmi (HTTPS)**: [**https://pawpos.my.id**](https://pawpos.my.id)
- **Direct IP VPS Service**: `http://202.10.38.50:8085`

### 🔑 Kredensial Akun Demo (1-Klik Masuk atau Input Manual)

Sistem mengimplementasikan **Role Isolation Enforced** yang ketat. Pengguna tidak dapat berpindah peran sembarangan melalui sidebar, melainkan harus login menggunakan akun masing-masing atau menggunakan tombol **1-Klik Masuk** pada halaman login:

| Peran (Role) | Email Login | Kata Sandi | Halaman Utama | Cakupan Akses & Batasan Peran |
| :--- | :--- | :--- | :--- | :--- |
| 👑 **Owner / Pemilik** | `owner@pawpos.id` | `pawpos123` | `/dashboard` | **Akses Penuh**: Dashboard finansial, kasir POS, katalog produk, stok inventori, sesi shift, dan pengaturan workspace. |
| 💳 **Kasir Operasional** | `kasir@pawpos.id` | `kasir123` | `/pos` | **Fokus Kasir**: Terminal POS responsif, split payment multi-tender, cetak struk, dan buka/tutup shift kasir. *Menu analitik & inventori dibatasi*. |
| 📦 **Staf Gudang & Logistik** | `gudang@pawpos.id` | `gudang123` | `/inventory/stocks` | **Logistik & Saldo**: Penerimaan barang masuk (*inbound*), pencatatan mutasi keluar rusak/expired, monitoring stok kritis. *Menu kasir dibatasi*. |
| 📋 **Manajer Toko** | `manager@pawpos.id` | `manager123` | `/dashboard` | **Supervisi Operasional**: Monitoring mutasi harian, audit kasir & laci kas, penyesuaian master katalog produk. |

> 🔒 **Audit Security Rule:** Demi integritas audit keuangan kasir, pergantian role secara langsung via *sidebar dropdown* telah ditiadakan. Setiap staf wajib melakukan **Logout (Keluar Sesi)** melalui kartu profil di sidebar untuk berganti akun.

---

## 📸 Visual Showcase (Playwright High-DPI Capture)

Semua screenshot di bawah ini ditangkap secara otomatis menggunakan skrip automasi **Playwright Retina High-DPI** langsung dari runtime sistem aktif:

### 1. Landing Page & Hero Showcase
Halaman utama SaaS yang responsif, modern, dan dilengkapi 3D visual showcase untuk menarik merchant dan pengguna baru.
<p align="center">
  <img src="docs/screenshots/01_landing_hero.png" alt="PawPOS Landing Page Hero" width="100%" />
</p>

---

### 2. Login & Demo Trial Mode (Role Isolation)
Halaman login terproteksi dengan pemilih persona 1-Klik Masuk untuk Owner, Kasir, Gudang, dan Manajer. Sidebar mengisolasi menu operasional kasir dan membatasi akses modul manajemen dengan perlindungan RBAC ketat.
<p align="center">
  <img src="docs/screenshots/01_login_page.png" alt="PawPOS Demo Trial Login Page" width="100%" />
</p>

| Kasir POS & Sidebar Terisolasi | Akses Halaman Dibatasi (RBAC Guard) |
| :---: | :---: |
| <img src="docs/screenshots/02_kasir_pos_terminal.png" alt="Kasir POS Terminal" width="480" /> | <img src="docs/screenshots/03_kasir_restricted_access.png" alt="Akses Halaman Dibatasi" width="480" /> |

---

### 3. High-Speed POS Terminal (Live Cart & Active Shift)
Register penjualan instan dengan pencarian SKU cepat, kartu produk interaktif, live cart calculation, status shift kasir realtime, serta tombol pembayaran multi-tender.
<p align="center">
  <img src="docs/screenshots/02_pos_terminal.png" alt="PawPOS Terminal Kasir POS" width="100%" />
</p>

---

### 3. Executive Operations Dashboard
Pusat kendali merchant: pantau omset total penjualan, estimasi kas laci fisik, total SKU aktif, status inventori aman, audit transaksi terkini (Split, QRIS, Tunai), dan interaksi cepat AI Copilot.
<p align="center">
  <img src="docs/screenshots/03_dashboard.png" alt="PawPOS Dashboard Operasional" width="100%" />
</p>

---

### 4. Sesi & Shift Kasir (Audit Laci & Rekonsiliasi)
Fitur akuntansi kasir ketat untuk mencegah selisih uang: pencatatan modal awal, pelacakan pemasukan tunai vs non-tunai, audit denominasi lembar uang fisik, dan pencetakan Z-Report pergantian shift.
<p align="center">
  <img src="docs/screenshots/04_cashier_shifts.png" alt="PawPOS Sesi & Shift Kasir" width="100%" />
</p>

---

### 5. Manajemen Stok & Saldo Fisik Inventori
Pemantauan stok barang per lokasi outlet, mutasi masuk/keluar, pelacakan batas stok minimum, dan peringatan pakan menipis otomatis.
<p align="center">
  <img src="docs/screenshots/05_inventory_stocks.png" alt="PawPOS Saldo Stok Inventori" width="100%" />
</p>

---

### 6. Pengalaman Mobile Responsif (iOS / Android)
Optimalisasi viewport dan safe area mobile untuk tablet maupun smartphone kasir bergerak di lapangan.

| Mobile POS Terminal Register | Mobile Landing Page Showcase |
| :---: | :---: |
| <img src="docs/screenshots/07_pos_mobile.png" alt="Mobile POS Register" width="340" /> | <img src="docs/screenshots/08_landing_mobile.png" alt="Mobile Landing" width="340" /> |

---

## ⚡ Fitur Unggulan

| Modul | Kemampuan Utama |
| :--- | :--- |
| **🚀 Kasir POS Kilat** | Pencarian instan nama/SKU, diskon fleksibel, kalkulasi pajak PPN 11%, keranjang responsif, settlement penjualan tanpa jeda. |
| **💳 Multi-Tender Split Payment** | Mendukung pembayaran kombinasi dalam 1 transaksi (contoh: Rp 100.000 Tunai + Rp 183.500 QRIS/Debit) dengan kalkulasi kembalian otomatis. |
| **🔒 Audit Shift Kasir & Laci** | Protokol pembukaan shift dengan modal awal kas, input pecahan uang fisik (*cash denomination calculator*), dan laporan Z-Report. |
| **📦 Manajemen Multi-Lokasi & Stok** | Mutasi stok barang (*opening, purchase, sale, adjustment, return*) dengan threshold peringatan stok kritis. |
| **🎙️ AI Voice Copilot RAG** | Asisten cerdas terintegrasi Groq OSS 120B dan ElevenLabs v2: tanya stok, panduan split tender, hingga konsultasi pakan langsung lewat suara. |
| **🏢 Multi-Tenant SaaS Ready** | Isolasi tenant berbasis header `X-Tenant-ID`, tier paket (*Starter, Pro, Enterprise*), dan kesiapan ekspansi cabang. |
| **🧠 Second Brain Knowledge** | Arsitektur didokumentasikan lengkap dalam format Obsidian Knowledge Graph untuk kolaborasi developer dan Agentic AI. |

---

## 🏗️ Arsitektur Sistem & Monorepo

```
ai-operational-pos/
├── apps/
│   ├── api/                     # Backend Go 1.23+ High Performance REST Service
│   │   ├── cmd/server/          # Entrypoint server HTTP & router routing
│   │   ├── internal/            # Domain logic, repositories, & business handlers
│   │   │   ├── assistant/       # AI Copilot Voice & Groq LLM integration
│   │   │   ├── auth/            # Tenant & authentication context
│   │   │   ├── inventory/       # Stock balances & movement ledger
│   │   │   ├── orders/          # Sales order, checkout & split payment engine
│   │   │   ├── products/        # Product master catalog
│   │   │   ├── shifts/          # Cash drawer shifts & audit reconciliation
│   │   │   └── tenant/          # Multi-tenant scoping & subscriptions
│   │   └── migrations/          # PostgreSQL DDL migrations
│   └── web/                     # Frontend Single Page App (SPA)
│       ├── scripts/             # Playwright automation & visual capture scripts
│       └── src/                 # React 19 + TypeScript + Material-UI components
│           ├── components/      # Reusable layout, navigation & buttons
│           └── features/        # Feature slices (pos, dashboard, shifts, etc.)
├── docs/
│   ├── branding/                # Official brand identity & enhanced logos
│   └── screenshots/             # Retina screenshots generated by Playwright
├── packages/
│   └── api-contract/            # OpenAPI 3.1 schema specification
├── scripts/
│   ├── dev.ps1                  # Unified Windows dev orchestrator
│   └── seed-demo-data.mjs       # Mock dataset seeding for demo & visual testing
├── OBSIDIAN.md                  # Comprehensive Second Brain architecture documentation
├── DESIGN.md                    # Modern UI token system, colors, & visual guidelines
└── README.md                    # Project documentation & visual showcase
```

---

## 🚀 Panduan Memulai Cepat (Quick Start)

### 1. Prasyarat
- **Go**: v1.23 atau lebih baru
- **Node.js**: v20 atau lebih baru (npm v10+)
- **Docker & Docker Compose**: Untuk instance PostgreSQL lokal
- **Google Chrome**: Untuk visual testing Playwright

### 2. Instalasi & Setup Lingkungan

Clone repository dan pasang dependencies:
```bash
git clone https://github.com/Ridzz05/PawPOS.git
cd PawPOS

# Salin konfigurasi environment
cp .env.example .env

# Pasang dependency monorepo
npm install
```

### 3. Menjalankan Database & Layanan Backend
Nyalakan PostgreSQL melalui Docker Compose:
```bash
docker compose up -d postgres
```

Jalankan backend Go API:
```bash
cd apps/api
go run ./cmd/server
```
> Server API akan aktif di `http://localhost:8080` (Healthcheck: `http://localhost:8080/health/live`).

### 4. Menjalankan Frontend Web
Di terminal terpisah dari root workspace:
```bash
npm --workspace apps/web run dev
```
> Buka browser di `http://localhost:5173` untuk mengakses PawPOS.

### 5. Seeding Data Demo & Screenshot Playwright
Untuk mengisi katalog produk, membuka shift, dan mencatat transaksi demo secara instan:
```bash
# Seed produk dan mutasi stok awal
node scripts/seed-demo-data.mjs

# Tangkap screenshot visual sistem menggunakan Playwright
node apps/web/scripts/capture-readme-screenshots.mjs
```

---

## 🧪 Validasi & Pengujian Kualitas

```bash
# Format & validasi kode Go
gofmt -w apps/api/cmd apps/api/internal
cd apps/api && go test ./... && cd ../..

# Unit test frontend (Vitest)
npm --workspace apps/web run test:run

# Build produksi frontend
npm --workspace apps/web run build

# Linting kontrak OpenAPI
npx --yes @redocly/cli lint packages/api-contract/openapi.yaml
```

---

## 📚 Second Brain & Obsidian Vault

Seluruh arsitektur, diagram aliran data, mesin transaksi, dan interaksi komponen sistem didokumentasikan dalam format **Obsidian Vault** yang saling terhubung menggunakan *bidirectional wikilinks (`[[...]]`)*:

- 🗂️ [**`vault/`**](file:///c:/Users/muhri/Documents/ai-operational-pos/vault) — Direktori **Obsidian Vault** resmi. Buka folder ini langsung di aplikasi [Obsidian](https://obsidian.md/) untuk melihat **Interactive Graph View** sistem.
  - 🗺️ [`vault/00 - PawPOS Second Brain MOC.md`](file:///c:/Users/muhri/Documents/ai-operational-pos/vault/00%20-%20PawPOS%20Second%20Brain%20MOC.md) — Master Map of Content (pintu masuk utama).
  - 🏛️ [`vault/01 - Architecture/`](file:///c:/Users/muhri/Documents/ai-operational-pos/vault/01%20-%20Architecture) — Topologi, Dual Persistence, Multi-Tenancy.
  - ⚙️ [`vault/02 - Backend/`](file:///c:/Users/muhri/Documents/ai-operational-pos/vault/02%20-%20Backend) — Go Clean Architecture, Orders, Shifts, Inventory, Database DDL.
  - 💻 [`vault/03 - Frontend/`](file:///c:/Users/muhri/Documents/ai-operational-pos/vault/03%20-%20Frontend) — React 19, POS Cart State Machine, Denomination Calculator, Safe Area.
  - 🔄 [`vault/04 - Workflows/`](file:///c:/Users/muhri/Documents/ai-operational-pos/vault/04%20-%20Workflows) — POS Checkout Flow, Shift Z-Report Lifecycle, Multi-Tender Split.
  - 🤖 [`vault/05 - AI Copilot/`](file:///c:/Users/muhri/Documents/ai-operational-pos/vault/05%20-%20AI%20Copilot) — Pipeline Suara Hands-Free, Groq 120B & Whisper, ElevenLabs v2.
  - 🚀 [`vault/06 - DevOps & Deployment/`](file:///c:/Users/muhri/Documents/ai-operational-pos/vault/06%20-%20DevOps%20&%20Deployment) — Runbook lokal, deployment Railway & VPS, mitigasi offline.
- 🎨 [**DESIGN.md**](file:///c:/Users/muhri/Documents/ai-operational-pos/DESIGN.md) — *Design System*: Standar palet warna Warm Orange `#FF6B00`, Deep Slate, dan tipografi.
- 📖 [**RUNBOOK.md**](file:///c:/Users/muhri/Documents/ai-operational-pos/RUNBOOK.md) — *Engineering Runbook*: Panduan operasional teknis dan pemulihan insiden.

---

## 📄 Lisensi & Hak Cipta

Dikelola secara terbuka oleh [**Ridzz05**](https://github.com/Ridzz05) & Tim Pengembang PawPOS.  
Dirilis di bawah lisensi [MIT License](LICENSE).

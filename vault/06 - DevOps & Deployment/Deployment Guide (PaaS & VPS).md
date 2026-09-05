---
title: "PawPOS Deployment Guide (PaaS & VPS)"
type: "devops"
tags:
  - pawpos
  - devops
  - deployment
  - railway
  - vps
  - docker
status: "active"
updated_at: "2026-09-06"
related_links:
  - "[[00 - PawPOS Second Brain MOC]]"
  - "[[Local Dev & Testing Runbook]]"
  - "[[System Topology]]"
---

# 🚀 Deployment Guide (PaaS & VPS)

Panduan komprehensif untuk meluncurkan backend Go, database PostgreSQL, dan frontend web PawPOS ke internet.

---

## 🎯 Strategi 1: Cloud PaaS (Railway.app / Render.com)
*Paling direkomendasikan untuk live demo, staging, atau pengujian instan tanpa harus mengonfigurasi server Linux.*

### Langkah di Railway.app:
1. Buat akun di [Railway.app](https://railway.app) dan hubungkan dengan GitHub Anda.
2. Buat proyek baru (*New Project*) $\rightarrow$ Pilih **Provision PostgreSQL**.
3. Tambahkan layanan baru $\rightarrow$ **Deploy from GitHub repo** $\rightarrow$ Pilih `Ridzz05/PawPOS`.
4. Atur Root Directory ke `apps/api`.
5. Tambahkan Environment Variables dari database PostgreSQL:
   ```env
   DB_HOST=${{Postgres.PGHOST}}
   DB_PORT=${{Postgres.PGPORT}}
   DB_USER=${{Postgres.PGUSER}}
   DB_PASSWORD=${{Postgres.PGPASSWORD}}
   DB_NAME=${{Postgres.PGDATABASE}}
   GROQ_API_KEY=gsk_...
   AI_ENABLED=true
   ```
6. Railway akan meng-compile Go secara otomatis dan memberikan URL live HTTPS (misal: `https://pawpos-api.up.railway.app`).

---

## 🖥️ Strategi 2: VPS Produksi (Ubuntu 22.04 / 24.04 + Docker)
*Paling ideal untuk toko pet shop fisik nyata dengan biaya hemat (~Rp 70.000/bln) dan kedaulatan data penuh.*

### Langkah di VPS:
1. Sewa VPS (DigitalOcean, Hetzner, atau VPS Lokal Jakarta).
2. Install Docker & Docker Compose:
   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh
   ```
3. Clone repository:
   ```bash
   git clone https://github.com/Ridzz05/PawPOS.git
   cd PawPOS
   cp .env.example .env
   # Edit .env dengan kredensial produksi
   nano .env
   ```
4. Jalankan seluruh stack dengan Docker Compose:
   ```bash
   docker compose up -d
   ```
5. Pasang reverse proxy Nginx / Caddy untuk auto-SSL HTTPS via Let's Encrypt:
   ```caddy
   pos.tokopetshop.com {
       reverse_proxy localhost:5173
   }
   api.tokopetshop.com {
       reverse_proxy localhost:8080
   }
   ```

---

## 🌐 Strategi Frontend Web (Vercel / Cloudflare Pages)

Frontend React dapat dideploy gratis:
1. Hubungkan repo `Ridzz05/PawPOS` ke [Vercel](https://vercel.com).
2. Pilih Root Directory: `apps/web`.
3. Set Environment Variable:
   ```env
   VITE_API_BASE_URL=https://api.tokopetshop.com
   ```
4. Klik **Deploy**. Setiap `git push` ke branch `main` akan otomatis memperbarui tampilan kasir.

---
*Kembali ke:* [[00 - PawPOS Second Brain MOC]] | *Topik Terkait:* [[Local Dev & Testing Runbook]], [[Offline Fallback & Reliability]]

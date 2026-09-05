---
title: "PawPOS System Topology"
type: "architecture"
tags:
  - pawpos
  - architecture
  - topology
  - infrastructure
status: "active"
updated_at: "2026-09-06"
related_links:
  - "[[00 - PawPOS Second Brain MOC]]"
  - "[[Dual Persistence Engine]]"
  - "[[Go Clean Architecture]]"
  - "[[React 19 Frontend Architecture]]"
---

# 🏛️ System Topology

Topologi sistem **PawPOS** mengadopsi model **Client-Server Single-Origin Hybrid Architecture** yang mengedepankan latensi rendah, determinisme data, dan toleransi kegagalan jaringan.

```mermaid
flowchart TD
    subgraph CLIENT ["Client Layer (apps/web)"]
        BROWSER["Modern Browser / PWA / Tablet"]
        VITE_SPA["React 19 Single Page App"]
        LOCAL_STORAGE["localStorage (Active Tenant & Cart Cache)"]
        BROWSER --> VITE_SPA
        VITE_SPA <--> LOCAL_STORAGE
    end

    subgraph NETWORK ["Edge & Gateway Layer"]
        CORS["CORS Preflight & Origin Filter"]
        REQ_ID["Request Tracer (UUID Request-ID)"]
        TENANT_RESOLVER["Tenant Context Middleware (X-Tenant-ID)"]
        VITE_SPA -->|HTTP REST / JSON / FormData| CORS
        CORS --> REQ_ID
        REQ_ID --> TENANT_RESOLVER
    end

    subgraph BACKEND ["Backend Application (apps/api - Port :8080)"]
        CHI_ROUTER["Go Chi v5 Router Multiplexer"]
        TENANT_RESOLVER --> CHI_ROUTER
        
        subgraph MODULES ["Domain Slices"]
            MOD_ORD["[[Orders & Split Payment Engine]]"]
            MOD_SHF["[[Cashier Shift & Audit Engine]]"]
            MOD_INV["[[Inventory Ledger Engine]]"]
            MOD_PRD["[[Products & WebP Engine]]"]
            MOD_AI["[[AI Voice Assistant Pipeline]]"]
        end

        CHI_ROUTER --> MOD_ORD
        CHI_ROUTER --> MOD_SHF
        CHI_ROUTER --> MOD_INV
        CHI_ROUTER --> MOD_PRD
        CHI_ROUTER --> MOD_AI
    end

    subgraph STORAGE ["Dual-Persistence Engine"]
        PG_POOL["pgx Connection Pool (PostgreSQL 16)"]
        MEM_STORE["In-Memory Concurrent Safe Store (Sync.Map / Mutex)"]
        FS_UPLOADS["Local Disk /uploads (WebP CDN)"]
        
        MOD_ORD -->|Database Mode| PG_POOL
        MOD_ORD -.->|Fallback Mode| MEM_STORE
        MOD_SHF --> PG_POOL
        MOD_SHF -.-> MEM_STORE
        MOD_INV --> PG_POOL
        MOD_INV -.-> MEM_STORE
        MOD_PRD --> FS_UPLOADS
    end

    subgraph EXTERNAL ["Third-Party AI Engines"]
        GROQ_API["Groq Cloud API (Llama-3.3-70b / OSS 120B)"]
        WHISPER_API["Whisper Large Turbo (Speech-to-Text)"]
        ELEVEN_API["ElevenLabs Multilingual v2 (Natural TTS)"]
        
        MOD_AI --> GROQ_API
        MOD_AI --> WHISPER_API
        MOD_AI --> ELEVEN_API
    end
```

---

## 🔍 Detail Lapisan Komponen

### 1. Client Layer (`apps/web`)
- Dibangun menggunakan **React 19**, **TypeScript 5.7**, dan **Vite 6**.
- Mengadopsi library antarmuka **Material-UI v7** yang di-customize dengan *Warm Charcoal / Vibrant Orange* design tokens.
- Berkomunikasi ke API backend melalui klien HTTP fetch ber-tipe ketat dengan penyematan header `X-Tenant-ID`.
- Memiliki proteksi *safe area* mobile penuh untuk kasir pengguna tablet iPad maupun smartphone Android/iPhone.
- Baca selengkapnya: [[React 19 Frontend Architecture]] dan [[Mobile-First & Safe Area System]].

### 2. Network & Gateway Middleware
- **Request ID Middleware**: Memberikan tag unik `request_id` pada setiap permintaan HTTP yang diteruskan ke log dan envelope response JSON.
- **Tenant Context Middleware**: Menangkap nilai `X-Tenant-ID` dan menyimpannya ke dalam `context.Context` Go untuk memastikan seluruh kueri database terisolasi.
- Baca selengkapnya: [[Chi Router & Middlewares]] dan [[Multi-Tenancy Isolation]].

### 3. Backend Engine (`apps/api`)
- Menggunakan **Go 1.23+** dengan router **Chi v5** yang sangat ringan tanpa alokasi memori berlebih.
- Mengadopsi arsitektur Clean DDD (*Domain-Driven Design*) per modul: `orders`, `shifts`, `inventory`, `products`, `assistant`, dan `tenant`.
- Baca selengkapnya: [[Go Clean Architecture]].

### 4. Storage & Fallback Layer
- **PostgreSQL 16**: Penyimpanan primer ACID-compliant dengan foreign keys ketat dan indeks performa tinggi.
- **In-Memory Fallback**: Ketika database PostgreSQL belum berjalan atau sedang maintenance, server Go secara otomatis beralih ke penyimpanan memori lokal tanpa mematikan aplikasi.
- Baca selengkapnya: [[Dual Persistence Engine]] dan [[Database Schema & DDL]].

### 5. Third-Party AI Services
- **Groq AI**: Menyediakan inferensi LLM ultra-cepat (~300+ token per detik) untuk menjawab pertanyaan kasir mengenai pakan atau aturan transaksi.
- **ElevenLabs**: Menghasilkan suara asisten kasir yang alami dalam Bahasa Indonesia.
- Baca selengkapnya: [[AI Voice Assistant Pipeline]].

---
*Kembali ke:* [[00 - PawPOS Second Brain MOC]]

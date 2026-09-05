---
title: "PawPOS React 19 Frontend Architecture"
type: "frontend"
tags:
  - pawpos
  - frontend
  - react19
  - vite
  - mui
status: "active"
updated_at: "2026-09-06"
related_links:
  - "[[00 - PawPOS Second Brain MOC]]"
  - "[[POS Terminal & Cart State]]"
  - "[[Design System & Tokens]]"
  - "[[Mobile-First & Safe Area System]]"
---

# ⚛️ React 19 Frontend Architecture

Frontend **PawPOS** (`apps/web`) dirancang untuk memberikan pengalaman aplikasi kasir desktop-grade di dalam browser web. Dibangun di atas **React 19**, **TypeScript 5.7**, dan dibundel dengan **Vite 6**, aplikasi ini menitikberatkan pada:
- Kecepatan respons instan (*zero-lag interaction*).
- Transisi non-blocking menggunakan fitur React 19 (`useTransition`, `startTransition`).
- Penanganan error anggun (*resilient network retry*).

---

## 🏗️ Struktur Arsitektur Feature Slices

Kode diorganisasi menggunakan pola **Vertical Feature Slices** di folder `src/features/`:

```
src/features/
├── pos/                     # Kasir register terminal & checkout state
│   ├── PosPage.tsx          # Komponen utama grid produk & cart drawer
│   ├── PosPage.test.tsx     # Unit & integration test
│   └── ordersApi.ts         # Klien API pemrosesan order
│
├── shifts/                  # Sesi kasir, denominasi kas, dan Z-Report
│   ├── ShiftsPage.tsx       # Tampilan shift aktif & history audit
│   └── shiftsApi.ts         # Klien API sesi kasir
│
├── inventory/               # Manajemen stok dan mutasi barang
│   ├── StocksPage.tsx       # Tabel saldo stok fisik & movement modal
│   └── inventoryApi.ts      # Klien API saldo inventori
│
├── products/                # Katalog master SKU & konversi gambar
│   ├── ProductsPage.tsx     # Tabel produk, form tambah/edit
│   ├── imageConverter.ts    # WebP Canvas compressor
│   └── productsApi.ts       # Klien API master produk
│
├── dashboard/               # Pusat kendali metrik & ringkasan harian
│   ├── DashboardPage.tsx    # Kartu KPI penjualan, kas laci, dan feed
│   └── dashboardApi.ts      # Klien analitik operasional
│
├── ai-assistant/            # PawPOS AI Copilot Widget
│   ├── AssistantDrawer.tsx  # Panel chat & asisten suara hands-free
│   └── assistantApi.ts      # Klien transkripsi & inferensi Groq
│
└── landing/                 # Halaman marketing SaaS
    └── LandingPage.tsx      # Showcase 3D, fitur unggulan, paket harga
```

---

## ⚡ React 19 Concurrent Features

PawPOS memanfaatkan kemampuan konkurensi React 19:

### `startTransition` untuk Update UI Kasir
Saat kasir mengetikkan nama produk di kotak pencarian atau memfilter kategori, rendering daftar produk dibungkus dalam `startTransition`:
```tsx
const handleSearchChange = (query: string) => {
  setSearchInput(query) // Urgent update (input field tetap responsif)
  startTransition(() => {
    setFilteredQuery(query) // Non-urgent update (filtering ratusan produk)
  })
}
```
Hasilnya: Kasir tidak pernah merasakan pengetikan macet (*keyboard stutter*) meskipun memiliki ribuan SKU.

---

## 📡 Pola Klien API Terisolasi

Setiap feature slice memiliki berkas `*Api.ts` sendiri yang mengeksekusi fetch dengan otomatis menyematkan header tenant:
```ts
export function getTenantHeaders(): HeadersInit {
  const tenant = getActiveTenant()
  return {
    'X-Tenant-ID': tenant.id,
    'Content-Type': 'application/json',
  }
}
```

Jika server mengembalikan error, respons dibungkus dalam custom Error class (`OrderApiError`, `ShiftApiError`, `ProductsApiError`) yang menyertakan `request_id` untuk kemudahan debugging.

---
*Kembali ke:* [[00 - PawPOS Second Brain MOC]] | *Topik Terkait:* [[POS Terminal & Cart State]], [[Design System & Tokens]]

---
title: "PawPOS Design System & Tokens"
type: "frontend"
tags:
  - pawpos
  - frontend
  - design-system
  - typography
  - color-tokens
status: "active"
updated_at: "2026-09-06"
related_links:
  - "[[00 - PawPOS Second Brain MOC]]"
  - "[[React 19 Frontend Architecture]]"
  - "[[Mobile-First & Safe Area System]]"
---

# 🎨 Design System & Tokens

Identitas visual **PawPOS** menggabungkan keramahan industri hewan peliharaan (*pet friendliness*) dengan ketegasan sistem kasir retail profesional (*operational rigor*). 

Sistem ini didokumentasikan secara rinci di `DESIGN.md` dan diimplementasikan via Material-UI Theme Tokens.

---

## 🎨 Palet Warna Resmi (Brand & Functional Palette)

### 1. Warna Brand Utama (PawPOS Signature)
- **Primary Warm Orange (`#FF6B00` / `#FA5A00`)**: Warna tombol aksi utama (*Checkout, Bayar Sekarang, Buka Shift*), aksen logo, dan sorotan aktif. Melambangkan kehangatan, keramahan, dan energi maskot hewan.
- **Deep Slate / Charcoal (`#0F172A` / `#1E293B`)**: Warna tipografi judul, latar belakang header navigasi, dan teks berbobot tebal untuk keterbacaan kontras tinggi di bawah lampu toko.
- **Pure White / Cream Surface (`#FFFFFF` / `#F8FAFC`)**: Latar belakang kartu kasir yang bersih dan tidak melelahkan mata kasir setelah berjam-jam bekerja.

### 2. Warna Status Operasional (Semantic Colors)
- **Success Green (`#10B981` / `#059669`)**: Status Shift Kasir Aktif, Saldo Stok Aman, Transaksi Berhasil.
- **Warning Amber (`#F59E0B` / `#D97706`)**: Stok Pakan Menipis (*Low Stock Warning*), Peringatan Shift Belum Dibuka.
- **Danger Red (`#EF4444` / `#DC2626`)**: Selisih Kas Kurang (*Cash Shortage*), Stok Habis (0 Pcs), Tombol Tutup Shift & Rekonsiliasi.
- **Informative Cyan (`#06B6D4`)**: Transaksi Non-Tunai Digital (QRIS, Kartu Debit, Transfer).

---

## 🔤 Tipografi & Skala Teks

Menggunakan font modern sans-serif **Plus Jakarta Sans** atau **Inter** dari Google Fonts:

| Taraf | Ukuran (px) | Bobot (Weight) | Penggunaan Utama |
| :--- | :---: | :---: | :--- |
| **Display H1** | 32px / 28px | 800 (Extra Bold) | Judul Landing Hero & Judul Halaman |
| **Section H2** | 24px / 20px | 700 (Bold) | Judul Modul (Kasir POS, Sesi & Shift) |
| **Card Title H3**| 18px / 16px | 600 (Semi Bold) | Nama Produk di Card, Judul Transaksi |
| **Body Large** | 15px | 500 (Medium) | Nilai Rupiah Utama (Harga, Kas Laci) |
| **Body Normal** | 14px | 400 (Regular) | Teks keterangan, deskripsi item |
| **Caption Small**| 12px | 500 (Medium) | Badge SKU, Lokasi Outlet, Jam Shift |

---

## ⚡ Prinsip UX Kasir Operasional (Operational Ergonomics)

1. **Durasi Transisi Cepat (120ms - 150ms)**: Tidak menggunakan animasi lambat atau efek bouncing berlebihan yang membuang waktu kasir saat antrean toko sedang padat.
2. **Target Sentuh Jempol Minimal 44x44 px**: Seluruh tombol utama dapat ditekan dengan mudah di layar sentuh tablet kasir.
3. **Format Angka Rupiah Otomatis**: Seluruh nominal diformat dengan pemisah ribuan titik (`Rp 275.000`) dan input otomatis membuang karakter non-angka.

---
*Kembali ke:* [[00 - PawPOS Second Brain MOC]] | *Topik Terkait:* [[React 19 Frontend Architecture]], [[Mobile-First & Safe Area System]]

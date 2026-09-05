---
title: "PawPOS Checkout Workflow"
type: "workflow"
tags:
  - pawpos
  - workflow
  - pos
  - checkout
  - receipt
status: "active"
updated_at: "2026-09-06"
related_links:
  - "[[00 - PawPOS Second Brain MOC]]"
  - "[[POS Terminal & Cart State]]"
  - "[[Multi-Tender Settlement Flow]]"
  - "[[Orders & Split Payment Engine]]"
---

# 🛒 POS Checkout Workflow

Berikut adalah alur kerja operasional lengkap dari awal pelanggan membawa barang ke kasir hingga kasir mencetak struk belanja di PawPOS:

```mermaid
sequenceDiagram
    autonumber
    actor Pelanggan as Pelanggan
    actor Kasir as Kasir Toko
    participant UI as Terminal Kasir (/pos)
    participant API as Backend Go (:8080)
    participant DB as PostgreSQL 16
    participant Printer as Thermal Printer

    Pelanggan->>Kasir: Membawa barang pakan / obat hewan
    Kasir->>UI: Cari nama produk atau scan barcode SKU
    UI->>UI: Filter katalog realtime (startTransition)
    Kasir->>UI: Klik kartu produk / tombol "+ Tambah"
    UI->>UI: Validasi batas stok fisik produk
    UI->>UI: Update state keranjang & kalkulasi subtotal
    
    opt Terapkan Diskon / Pajak
        Kasir->>UI: Masukkan nominal diskon / aktifkan PPN 11%
        UI->>UI: Hitung total tagihan baru
    end

    Kasir->>UI: Klik tombol "Bayar Sekarang"
    UI->>UI: Buka modal pembayaran (Tunai, QRIS, Kartu, Split)
    Pelanggan->>Kasir: Menyerahkan pembayaran
    Kasir->>UI: Input nominal uang diterima
    UI->>UI: Hitung uang kembalian secara instan
    Kasir->>UI: Klik "Konfirmasi Bayar"
    
    UI->>API: POST /api/v1/orders
    API->>DB: BEGIN Transaction
    API->>DB: Validasi shift aktif & simpan order
    API->>DB: Potong stok produk (stock_movements)
    API->>DB: Tambah kas laci shift jika ada pembayaran tunai
    API->>DB: COMMIT Transaction
    
    API-->>UI: 200 OK (Data Order & Nomor Struk ORD-...)
    UI->>UI: Putar suara konfirmasi & buka modal struk
    Kasir->>Printer: Cetak struk belanja pelanggan (58mm / 80mm)
    Kasir->>UI: Klik "Selesai / Transaksi Baru" (Keranjang reset kosong)
```

---

## 🛑 Kondisi Pengecualian & Penanganannya

1. **Shift Kasir Belum Dibuka**:
   - Jika kasir menekan tombol "Bayar", sistem akan memblokir transaksi dengan alert: *"Sesi kasir saat ini belum aktif. Silakan buka shift kasir terlebih dahulu"*.
   - Kasir dialihkan langsung ke modal pembukaan shift tanpa kehilangan isi keranjang belanja yang sudah dipilih.
2. **Kuantitas Melebihi Stok Tersedia**:
   - Tombol `[+]` kuantitas otomatis terkunci jika kuantitas keranjang telah menyamai stok yang tersisa di toko.
3. **Koneksi Internet Terputus**:
   - Jika jaringan toko terganggu sesaat, pesanan dapat disimpan sementara di antrean lokal (*local draft queue*) agar kasir tidak panik di depan pelanggan.

---
*Kembali ke:* [[00 - PawPOS Second Brain MOC]] | *Topik Terkait:* [[Multi-Tender Settlement Flow]], [[POS Terminal & Cart State]]

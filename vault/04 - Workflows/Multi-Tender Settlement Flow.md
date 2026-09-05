---
title: "PawPOS Multi-Tender Settlement Flow"
type: "workflow"
tags:
  - pawpos
  - workflow
  - payment
  - split-payment
  - settlement
status: "active"
updated_at: "2026-09-06"
related_links:
  - "[[00 - PawPOS Second Brain MOC]]"
  - "[[Orders & Split Payment Engine]]"
  - "[[POS Checkout Workflow]]"
---

# 💳 Multi-Tender Settlement Flow

Pelanggan pet shop kerap membeli barang dalam jumlah besar (misal pakan karung 10kg seharga ratusan ribu) dan meminta pembayaran dipecah: sebagian uang tunai sisa di dompet dan sisanya dibayar menggunakan QRIS / Kartu Debit.

Alur penyelesaian transaksi campuran (**Multi-Tender Settlement Flow**) di PawPOS didesain agar kasir tidak perlu menghitung manual dan pembukuan toko tetap presisi.

---

## 🔄 Alur Interaksi Kasir (User Flow)

```mermaid
flowchart TD
    START["Kasir Klik 'Bayar Sekarang' di POS"] --> SELECT["Pilih Metode Pembayaran: 'Split Payment'"]
    
    SELECT --> SHOW_TOTAL["Tampilkan Total Tagihan: Rp 283.500"]
    
    SHOW_TOTAL --> INPUT_CASH["Kasir Masukkan Nominal Tunai: Rp 100.000"]
    
    INPUT_CASH --> AUTO_CALC["Sistem Otomatis Hitung Sisa Non-Tunai:<br/>Rp 283.500 - Rp 100.000 = Rp 183.500"]
    
    AUTO_CALC --> SELECT_DIGITAL["Pilih Kanal Non-Tunai: QRIS / Kartu Debit / EDC"]
    
    SELECT_DIGITAL --> SHOW_QRIS["Pelanggan Scan QRIS Rp 183.500"]
    
    SHOW_QRIS --> CONFIRM["Kasir Verifikasi Notifikasi QRIS Berhasil"]
    
    CONFIRM --> SUBMIT["Kasir Klik 'Konfirmasi Pembayaran Split'"]
    
    SUBMIT --> API["Kirim Payload ke Backend Go"]
    
    API --> RESULT["Order Selesai + Struk Mencantumkan:<br/>Tunai: Rp 100.000<br/>QRIS: Rp 183.500"]
```

---

## 🧮 Validasi Keamanan Transaksi

1. **Anti Selisih**: Sistem mencegah kasir mengonfirmasi transaksi jika:
   $$\text{Tunai} + \text{Non-Tunai} \ne \text{Total Tagihan}$$
2. **Kalkulasi Kembalian Otomatis**: Jika pelanggan menyerahkan uang kertas pecahan lebih besar dari porsi tunai (misal porsi tunai Rp 83.500 diserahkan uang Rp 100.000), sistem otomatis menghitung kembalian `Rp 16.500`.
3. **Pemisahan di Laporan Shift**:
   - Porsi Tunai masuk ke pos kas fisik laci (`total_cash_sales_idr`).
   - Porsi Non-Tunai masuk ke pos digital (`total_non_cash_sales_idr`).

---
*Kembali ke:* [[00 - PawPOS Second Brain MOC]] | *Topik Terkait:* [[Orders & Split Payment Engine]], [[POS Checkout Workflow]]

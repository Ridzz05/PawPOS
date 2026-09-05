---
title: "PawPOS Inventory Ledger Engine"
type: "backend"
tags:
  - pawpos
  - backend
  - inventory
  - ledger
  - stock-movements
status: "active"
updated_at: "2026-09-06"
related_links:
  - "[[00 - PawPOS Second Brain MOC]]"
  - "[[Inventory Movement Workflow]]"
  - "[[Products & WebP Engine]]"
  - "[[Orders & Split Payment Engine]]"
---

# 📦 Inventory Ledger Engine

PawPOS mengadopsi prinsip **Double-Entry Stock Ledger** untuk mengelola stok barang dan pakan hewan. Daripada sekadar meng-update angka stok secara statis (`UPDATE products SET stock = 10`), sistem mencatat setiap perubahan sebagai **riwayat pergerakan stok (*Stock Movement Item*)** yang tidak bisa dihapus (*append-only audit log*).

---

## 🏷️ Tipe Pergerakan Stok (`MovementType`)

| Tipe Gerakan | Arah Kuantitas | Penjelasan Operasional |
| :--- | :---: | :--- |
| `opening` | Positif (+) | Pencatatan stok awal saat toko mulai beroperasi. |
| `purchase_receipt` | Positif (+) | Penerimaan pasokan barang pakan baru dari distributor/supplier. |
| `sale` | Negatif (-) | Pengurangan otomatis saat kasir memproses struk penjualan POS. |
| `adjustment` | Positif / Negatif | Penyesuaian saat stock opname (karena barang rusak, kadaluarsa, dsb). |
| `return` | Positif (+) | Pengembalian barang dari pelanggan yang membatalkan pembelian. |

---

## 📐 Perhitungan Saldo Fisik (Stock Balance Calculation)

Saldo fisik stok suatu produk di lokasi tertentu dihitung dari total kumulatif delta gerakan:

$$\text{Saldo Fisik Saat Ini} = \sum_{i=1}^{n} \text{QuantityDelta}_i$$

Keuntungan pendekatan ini:
- **Audit Trail Penuh**: Pemilik toko tahu persis jam berapa, oleh siapa, dan alasan apa 1 karung pakan berkurang atau bertambah.
- **Pencegahan Fraud**: Kasir atau staf gudang tidak bisa memanipulasi jumlah stok tanpa meninggalkan jejak mutasi.

---

## 🚨 Ambang Batas Minimum Stok (Low Stock Threshold Alerts)

Setiap produk memiliki properti `minimum_stock` (misal: 5 bag).
Ketika saldo stok:
$$\text{Saldo Fisik} \le \text{Batas Minimum}$$

Sistem secara otomatis:
1. Menandai baris inventori dengan badge warna oranye/merah (`Perlu Restock`).
2. Menampilkan notifikasi pada [[Dashboard Operasional]] kasir.
3. Memberikan alert kepada [[AI Voice Assistant Pipeline]] agar asisten AI dapat mengingatkan pemilik toko: *"Perhatian: Pakan Royal Canin Babycat tersisa 3 bag, di bawah batas aman 5 bag."*

---
*Kembali ke:* [[00 - PawPOS Second Brain MOC]] | *Topik Terkait:* [[Inventory Movement Workflow]], [[Products & WebP Engine]]

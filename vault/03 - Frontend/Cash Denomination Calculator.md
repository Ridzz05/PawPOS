---
title: "PawPOS Cash Denomination Calculator"
type: "frontend"
tags:
  - pawpos
  - frontend
  - denominations
  - cash-drawer
  - audit
status: "active"
updated_at: "2026-09-06"
related_links:
  - "[[00 - PawPOS Second Brain MOC]]"
  - "[[Cashier Shift & Audit Engine]]"
  - "[[Shift Lifecycle & Z-Report Workflow]]"
---

# 💵 Cash Denomination Calculator

Saat pergantian kasir atau penutupan toko, menghitung uang kas fisik secara manual dengan kalkulator sering kali menimbulkan kesalahan hitung (*human error*). 

PawPOS menyertakan fitur **Kalkulator Denominasi Pecahan Uang Rupiah** (`src/features/shifts/ShiftsPage.tsx`) yang terintegrasi langsung ke dalam formulir audit shift kasir.

---

## 🪙 Pecahan Uang yang Didukung

Kasir cukup memasukkan berapa lembar uang kertas atau keping koin yang ada di laci kasir:

| Pecahan Uang Rupiah | Tipe | Rumus Kalkulasi |
| :--- | :---: | :--- |
| **Rp 100.000** | Lembar Uang Kertas | `count * 100000` |
| **Rp 50.000** | Lembar Uang Kertas | `count * 50000` |
| **Rp 20.000** | Lembar Uang Kertas | `count * 20000` |
| **Rp 10.000** | Lembar Uang Kertas | `count * 10000` |
| **Rp 5.000** | Lembar Uang Kertas | `count * 5000` |
| **Rp 2.000** | Lembar Uang Kertas | `count * 2000` |
| **Rp 1.000** | Lembar Uang Kertas | `count * 1000` |
| **Koin / Receh** | Total Nilai Koin | Input agregat nominal koin (Rp) |

---

## ⚡ Live Difference Engine (Kalkulasi Selisih Real-Time)

Saat kasir mengisi jumlah lembaran uang, antarmuka secara *real-time* menampilkan:

1. **Total Kas Fisik Dihitung**:
   $$\text{Total Fisik} = \sum (\text{Denominasi} \times \text{Lembar}) + \text{Total Koin}$$
2. **Estimasi Seharusnya di Laci**:
   $$\text{Expected} = \text{Modal Awal} + \text{Total Penjualan Tunai}$$
3. **Selisih Kas**:
   $$\text{Selisih} = \text{Total Fisik} - \text{Expected}$$

### Indikator Visual Dinamis:
- **Warna Hijau (Rp 0)**: `"Kas Laci Seimbang (Cocok 100%)"` — Uang fisik sesuai dengan pembukuan.
- **Warna Biru (> Rp 0)**: `"Kas Lebih (+Rp ...)"` — Kas fisik lebih banyak dari catatan.
- **Warna Merah (< Rp 0)**: `"Kas Kurang (-Rp ...)"` — Kas fisik tekor; formulir mewajibkan kasir mengisi kolom catatan alasan sebelum tombol "Tutup Shift" aktif.

---
*Kembali ke:* [[00 - PawPOS Second Brain MOC]] | *Topik Terkait:* [[Cashier Shift & Audit Engine]], [[Shift Lifecycle & Z-Report Workflow]]

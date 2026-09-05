---
title: "PawPOS Cashier Shift & Audit Engine"
type: "backend"
tags:
  - pawpos
  - backend
  - shifts
  - cash-drawer
  - audit
  - z-report
status: "active"
updated_at: "2026-09-06"
related_links:
  - "[[00 - PawPOS Second Brain MOC]]"
  - "[[Shift Lifecycle & Z-Report Workflow]]"
  - "[[Cash Denomination Calculator]]"
  - "[[Orders & Split Payment Engine]]"
---

# 🔒 Cashier Shift & Audit Engine

Salah satu kelemahan terbesar sistem POS kasir konvensional adalah kebocoran uang kas fisik dan ketidaksesuaian antara uang di laci dengan laporan sistem. 

Modul **Shifts** (`apps/api/internal/shifts`) di PawPOS menerapkan standar audit akuntansi retail yang ketat untuk memastikan tidak ada selisih uang kas saat pergantian kasir.

---

## 📊 Anatomi Data Shift

```go
type Shift struct {
    ID                    string     `json:"id"`
    TenantID              string     `json:"tenant_id"`
    CashierName           string     `json:"cashier_name"`
    Status                string     `json:"status"` // "open" | "closed"
    StartingCashIDR       int64      `json:"starting_cash_idr"`
    ExpectedCashIDR       int64      `json:"expected_cash_idr"`
    ActualCashIDR         int64      `json:"actual_cash_idr"`
    CashDifferenceIDR     int64      `json:"cash_difference_idr"`
    TotalCashSalesIDR     int64      `json:"total_cash_sales_idr"`
    TotalNonCashSalesIDR  int64      `json:"total_non_cash_sales_idr"`
    TransactionCount      int        `json:"transaction_count"`
    Notes                 string     `json:"notes"`
    OpenedAt              time.Time  `json:"opened_at"`
    ClosedAt              *time.Time `json:"closed_at,omitempty"`
}
```

---

## 🧮 Rumus Rekonsiliasi Kas Laci

$$\text{Estimasi Kas di Laci (Expected Cash)} = \text{Modal Awal (Starting Cash)} + \text{Total Penjualan Tunai}$$

$$\text{Selisih Kas (Cash Difference)} = \text{Kas Fisik Dihitung (Actual Cash)} - \text{Estimasi Kas di Laci}$$

- **Jika Selisih == 0**: Status **SEIMBANG (Balanced)**. Uang fisik di laci cocok 100% dengan transaksi sistem.
- **Jika Selisih > 0**: Status **LEBIH (Overage)**. Uang fisik di laci lebih banyak daripada pencatatan sistem.
- **Jika Selisih < 0**: Status **KURANG (Shortage)**. Indikasi uang hilang, salah memberi kembalian, atau lupa input struk.

---

## 📜 Struk Harian Z-Report

Saat shift ditutup melalui `POST /api/v1/shifts/close`, sistem menerbitkan laporan audit final yang disebut **Z-Report**. Z-Report berisi:
1. Rincian kasir dan jam operasional.
2. Modal laci awal (*float*).
3. Penjualan per metode bayar (Tunai, QRIS, Kartu Debit, Transfer).
4. Hasil audit denominasi uang kertas & koin.
5. Catatan selisih kas (*discrepancy log*).

Setelah Z-Report diterbitkan, status shift terkunci (*immutable*) dan tidak dapat diubah lagi untuk menjamin auditabilitas hukum.

---
*Kembali ke:* [[00 - PawPOS Second Brain MOC]] | *Topik Terkait:* [[Shift Lifecycle & Z-Report Workflow]], [[Cash Denomination Calculator]]

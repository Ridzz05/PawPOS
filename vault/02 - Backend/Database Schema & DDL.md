---
title: "PawPOS Database Schema & DDL"
type: "backend"
tags:
  - pawpos
  - backend
  - postgresql
  - database
  - schema
  - migrations
status: "active"
updated_at: "2026-09-06"
related_links:
  - "[[00 - PawPOS Second Brain MOC]]"
  - "[[Dual Persistence Engine]]"
  - "[[Multi-Tenancy Isolation]]"
  - "[[Go Clean Architecture]]"
---

# 🗄️ Database Schema & DDL

Database utama **PawPOS** menggunakan **PostgreSQL 16**. Struktur tabel didesain dengan relasi foreign key ketat, tipe data UUID untuk primary key, dan isolasi multi-tenant pada setiap entitas.

---

## 🗺️ Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    tenants ||--o{ locations : "memiliki"
    tenants ||--o{ products : "memiliki"
    tenants ||--o{ shifts : "mengaudit"
    tenants ||--o{ orders : "memproses"
    
    locations ||--o{ stock_movements : "lokasi mutasi"
    products ||--o{ stock_movements : "pergerakan stok"
    
    orders ||--|{ order_items : "terdiri dari"
    products ||--o{ order_items : "dijual dalam"
    shifts ||--o{ orders : "menaungi transaksi"

    tenants {
        uuid id PK
        varchar name
        varchar slug
        varchar plan_type
        boolean is_active
        timestamp created_at
    }

    products {
        uuid id PK
        uuid tenant_id FK
        varchar sku
        varchar name
        bigint purchase_price_idr
        bigint selling_price_idr
        varchar base_unit
        int minimum_stock
        text image_url
        boolean is_active
    }

    shifts {
        uuid id PK
        uuid tenant_id FK
        varchar cashier_name
        varchar status
        bigint starting_cash_idr
        bigint expected_cash_idr
        bigint actual_cash_idr
        bigint total_cash_sales_idr
        bigint total_non_cash_sales_idr
        int transaction_count
        timestamp opened_at
        timestamp closed_at
    }

    orders {
        uuid id PK
        uuid tenant_id FK
        uuid shift_id FK
        varchar order_number
        varchar payment_method
        bigint subtotal_idr
        bigint tax_idr
        bigint discount_idr
        bigint total_idr
        bigint paid_amount_idr
        bigint cash_amount_idr
        bigint non_cash_amount_idr
        timestamp created_at
    }

    order_items {
        uuid id PK
        uuid order_id FK
        uuid product_id FK
        varchar product_name
        varchar sku
        bigint unit_price_idr
        int quantity
        bigint subtotal_idr
    }

    stock_movements {
        uuid id PK
        uuid tenant_id FK
        uuid product_id FK
        uuid location_id FK
        int quantity_delta
        varchar movement_type
        text reason
        timestamp created_at
    }
```

---

## ⚡ Indeks Performa Kritis

Untuk menjamin kueri kasir tetap merespons di bawah 5 milidetik meskipun telah ada jutaan baris data transaksi:

1. **Indeks SKU Unik per Tenant**:
   ```sql
   CREATE UNIQUE INDEX idx_products_tenant_sku ON products(tenant_id, sku);
   ```
2. **Indeks Riwayat Transaksi per Waktu**:
   ```sql
   CREATE INDEX idx_orders_tenant_created ON orders(tenant_id, created_at DESC);
   ```
3. **Indeks Saldo Mutasi Stok**:
   ```sql
   CREATE INDEX idx_stock_movements_prod_loc ON stock_movements(tenant_id, product_id, location_id);
   ```
4. **Indeks Shift Kasir Aktif**:
   ```sql
   CREATE INDEX idx_shifts_tenant_status ON shifts(tenant_id, status) WHERE status = 'open';
   ```

---
*Kembali ke:* [[00 - PawPOS Second Brain MOC]] | *Topik Terkait:* [[Dual Persistence Engine]], [[Go Clean Architecture]]

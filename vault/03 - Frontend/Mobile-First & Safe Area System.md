---
title: "PawPOS Mobile-First & Safe Area System"
type: "frontend"
tags:
  - pawpos
  - frontend
  - mobile
  - safe-area
  - pwa
  - responsive
status: "active"
updated_at: "2026-09-06"
related_links:
  - "[[00 - PawPOS Second Brain MOC]]"
  - "[[Design System & Tokens]]"
  - "[[React 19 Frontend Architecture]]"
---

# 📱 Mobile-First & Safe Area System

Di era modern, kasir pet shop tidak hanya berada di meja kasir stasioner, tetapi juga bergerak dengan **tablet iPad / Android** di lorong toko atau menerima pembayaran COD menggunakan smartphone kasir.

PawPOS dirancang dengan protokol **Mobile-First & iOS Safe Area Resilient** untuk menjamin aplikasi tidak pernah terpotong oleh notch, kamera dinamis (*dynamic island*), atau bilah gestur navigasi bawah (*home indicator bar*).

---

## 📐 Meta Viewport & CSS Environment Variables

Pada `index.html`, deklarasi viewport menyertakan `viewport-fit=cover`:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
```

Pada CSS dasar (`src/index.css`), disematkan variabel padding safe-area standar W3C:
```css
:root {
  --sat: env(safe-area-inset-top, 0px);
  --sab: env(safe-area-inset-bottom, 0px);
  --sal: env(safe-area-inset-left, 0px);
  --sar: env(safe-area-inset-right, 0px);
}

/* Bilah Navigasi Kasir Bawah pada Mobile */
.mobile-bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding-bottom: calc(var(--sab) + 8px);
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(12px);
  border-top: 1px solid #E2E8F0;
  z-index: 1200;
}
```

---

## 🔍 Adaptasi Tata Letak (Adaptive Layout Breakpoints)

PawPOS mengadopsi responsivitas cerdas:

| Viewport | Tampilan Terminal POS | Tampilan Dashboard & Shift |
| :--- | :--- | :--- |
| **Desktop (> 960px)** | Grid 2 kolom: 70% katalog produk di kiri + 30% keranjang belanja di kanan. | Sidebar tetap di kiri + konten grid metrik di kanan. |
| **Tablet (600px - 960px)**| Grid produk 3 kolom, keranjang belanja dapat diciutkan atau dibuka sebagai drawer. | Sidebar dapat diciutkan (*collapsible drawer*). |
| **Smartphone (< 600px)** | Grid produk 1-2 kolom, tombol mengambang "Keranjang", dan bottom tab navigation (Kasir, Produk, Stok, Dasbor). | Tampilan kartu vertikal bertumpuk, tombol aksi utama berukuran besar minimal 44x44 px (ramah jempol). |

---

## 🧪 Skrip Verifikasi Safe Area Otomatis

Untuk memastikan tidak terjadi regresi UI pada pembaruan di masa mendatang, repository menyertakan skrip pengujian Playwright khusus:
```bash
node apps/web/scripts/verify-mobile-safearea.mjs
```
Skrip ini mengemulasikan iPhone 14 / iPhone 15 Pro dan memverifikasi bahwa koordinat pixel elemen interaktif terendah tidak bertabrakan dengan home indicator `safe-area-inset-bottom`.

---
*Kembali ke:* [[00 - PawPOS Second Brain MOC]] | *Topik Terkait:* [[Design System & Tokens]], [[React 19 Frontend Architecture]]

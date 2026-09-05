# DESIGN.md — Purr'Coffee Kasir POS: Flat & Utilitarian Redesign

## Konteks

Kasir POS adalah alat kerja operasional (dipakai barista/kasir untuk scan produk & settlement transaksi), bukan halaman marketing. Prioritas: kecepatan baca, kontras tinggi untuk angka/harga, minim dekorasi. Saat ini UI terjebak pola "SaaS card kit" generik: radius full-pill di hampir semua elemen, shadow seragam di tiap card, kemungkinan hover-lift di card produk, dan surface color navbar tidak konsisten dengan sidebar.

**Prinsip:** Sidebar sudah paling dekat ke arah yang benar (flat, netral, minim chrome). Header dan area konten disamakan ke level restraint sidebar — bukan sebaliknya.

---

## Masalah yang diperbaiki

1. **Navbar/header pakai surface color berbeda dari sidebar** (nuansa lavender pucat vs putih bersih sidebar) → kelihatan seperti dua sistem berbeda.
2. **Radius full-pill dipakai berlebihan** — search bar, dropdown toko, tombol filter, tab kategori (Coffee/Non Coffee/Food/dst) semua full-pill, padahal ini kontrol fungsional, bukan status badge.
3. **Card produk & panel keranjang kemungkinan pakai shadow lembut + hover lift/scale** — bikin UI kelihatan "berat"/tebal padahal ini alat kerja yang harus dipindai cepat.
4. **Tidak ada pembeda jelas antara elemen "status" (pantas full-pill: Live, Register Aktif, Shift Pagi Aktif, size tag) dan elemen "kontrol" (harus flat: tab filter, search, tombol).**

---

## Design tokens

```css
:root {
  /* Surface — SEMUA level (sidebar, header, main canvas, card) pakai skala ini,
     bukan warna ad-hoc per komponen */
  --surface-base: #FFFFFF;      /* sidebar, header, card */
  --surface-canvas: #F7F7F8;    /* background area konten utama — netral, BUKAN lavender-tinted */

  /* Border menggantikan shadow sebagai pemisah visual */
  --border-subtle: #E7E7EA;
  --border-strong: #D8D8DC;

  /* Text */
  --text-primary: #1A1A1F;
  --text-secondary: #6B6B76;
  --text-muted: #A3A3AC;

  /* Accent — ganti dengan hex brand asli, ini cuma placeholder dari screenshot */
  --accent: #F2703C;
  --accent-hover: #DD5F2E;      /* darken ~8%, bukan lift/shadow */
  --accent-subtle: #FCEAE0;     /* tint utk active-state background, bukan gradient */

  /* Radius — dua skala, dipakai sesuai fungsi (lihat aturan di bawah) */
  --radius-control: 8px;        /* tombol, input, card, tab — SEMUA kontrol fungsional */
  --radius-status: 999px;       /* HANYA utk badge status (Live, Register Aktif, size tag) */

  /* Motion — feedback only, no decorative movement */
  --transition-fast: background-color 120ms ease, border-color 120ms ease;
}
```

### Aturan radius (penting, sering salah kaprah)

- `--radius-control` (8px) → search bar, dropdown "Toko Utama", tombol "Filter", tab kategori, card produk, panel keranjang, tombol "Add to cart", tombol "Bayar Sekarang".
- `--radius-status` (full pill) → **hanya** badge yang murni menandakan status: "Live", "Register Aktif", "Shift Pagi Aktif", tag "pcs"/"Reguler" di card produk.
- Alasan: pill = bahasa visual untuk "status/token", bukan untuk kontrol interaktif. Kalau semua pakai pill, mata gak bisa bedain mana yang bisa diklik vs mana yang cuma info.

### Shadow → dihapus, ganti border

Semua `box-shadow` di card produk, panel keranjang, dan container lain diganti:

```css
/* SEBELUM */
.card {
  border-radius: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  transition: transform 150ms ease, box-shadow 150ms ease;
}
.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
}

/* SESUDAH */
.card {
  background: var(--surface-base);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-control);
  transition: var(--transition-fast);
}
.card:hover {
  border-color: var(--border-strong);
}
```

Tidak ada `transform`, tidak ada `box-shadow` yang tumbuh saat hover. Hover cukup terasa lewat perubahan warna border — cukup buat feedback, gak bikin layout "melompat" saat kasir lagi kerja cepat.

---

## Perbaikan per komponen

### 1. Header/Navbar
- **Masalah:** background beda warna dari sidebar (lavender pucat vs putih).
- **Fix:** `background: var(--surface-base)` — sama persis dengan sidebar. Pemisah visual cukup pakai `border-bottom: 1px solid var(--border-subtle)`, bukan blok warna berbeda.
- Tombol "Rekam suara", "Draft without direction" tetap flat: `border: 1px solid var(--border-subtle)`, tanpa shadow.
- Badge "Register Aktif" tetap full-pill (ini status indicator, sudah benar).

### 2. Search bar, dropdown "Toko Utama", tombol "Filter"
- Ganti dari full-pill ke `--radius-control` (8px).
- `border: 1px solid var(--border-subtle)`, no shadow.
- Tombol "Filter" (saat ini solid orange) tetap boleh solid accent — ini salah satu titik aksen yang sah, tapi radius-nya turunkan ke 8px biar konsisten sama search bar di sebelahnya.

### 3. Tab kategori (Coffee / Non Coffee / Food / Snack / Dessert)
- **Masalah:** full-pill + padding tebal, gak konsisten sama sidebar yang minimalis.
- **Fix:** jadi flat segmented tabs.

```css
.category-tab {
  border-radius: var(--radius-control);
  padding: 10px 16px;
  border: 1px solid var(--border-subtle);
  background: var(--surface-base);
  color: var(--text-secondary);
  transition: var(--transition-fast);
}
.category-tab.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #FFFFFF;
}
.category-tab:hover:not(.active) {
  border-color: var(--border-strong);
}
```

### 4. Card produk ("Beban Keluarga", dst.)
- Radius turun ke `--radius-control` (8px), border 1px, no shadow (lihat blok CSS di atas).
- Thumbnail gambar: radius sedikit lebih kecil dari card (misal 6px) biar konsisten dengan padding internal.
- Tag "Size: pcs / Reguler" tetap full-pill — ini status/atribut produk, bukan kontrol.
- State "Add to cart" disabled (stok 0) sudah cukup tepat secara fungsi — pastikan kontrasnya tetap kebaca (`--text-muted` di atas `--surface-canvas`, jangan abu-abu-di-atas-abu-abu).
- Stepper qty (−/+ bulat): boleh tetap bentuk lingkaran (ini kontrol angka, bukan dekorasi), tapi hapus shadow & scale-on-hover — cukup `background-color` shift tipis saat hover/press.

### 5. Panel Keranjang
- Radius `--radius-control`, border 1px, no shadow — treatment sama seperti card produk.
- Tombol **"Bayar Sekarang"** tetap jadi satu-satunya elemen "berani" di halaman (accent solid fill, bold) — ini sesuai prinsip "spend your boldness in one place": semua di sekitarnya tenang & flat, biar tombol ini yang paling menonjol secara alami, bukan karena semua elemen lain sama-sama ramai.
- Hover: `background-color: var(--accent-hover)` saja, tanpa shadow atau lift.
- State disabled (keranjang kosong): turunkan opacity/saturasi accent, jangan diganti abu-abu total — tetap harus kebaca sebagai "tombol utama, lagi nonaktif".

### 6. Sidebar
- Tidak perlu perubahan besar — sudah jadi referensi arah desain yang benar. Cukup pastikan warna active-state item ("Kasir POS") pakai `--accent-subtle` sebagai background dan `--accent` sebagai left-border indicator, bukan gradient.

---

## Motion — ringkasan

- **Hapus semua** `transform: scale()`, `translateY()` pada hover card/button.
- Transisi dibatasi ke `background-color` dan `border-color` saja, durasi 120ms.
- Motion yang boleh dipakai: feedback atas aksi user (klik "Add to cart" → jumlah di badge keranjang berubah dengan transisi angka singkat), bukan efek dekoratif yang muncul di semua card saat hover.

---

## Checklist untuk coding agent

- [ ] Samakan `background` header dengan sidebar (`--surface-base`), ganti pemisah jadi `border-bottom`.
- [ ] Ganti semua `border-radius: 999px` pada search bar, dropdown, tombol filter, tab kategori → `var(--radius-control)`.
- [ ] Hapus `box-shadow` dari card produk & panel keranjang, ganti `border: 1px solid var(--border-subtle)`.
- [ ] Hapus `transform` pada semua `:hover` state di card & button.
- [ ] Pastikan hanya badge status (Live, Register Aktif, Shift Pagi Aktif, size tag) yang tetap full-pill.
- [ ] Terapkan token warna di atas secara konsisten — jangan ada hex value ad-hoc baru di luar token list.
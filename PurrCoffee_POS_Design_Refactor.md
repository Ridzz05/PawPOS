# PurrCoffee POS — Design Refactor Specification

## Tujuan

Refactor visual Kasir POS agar terasa sebagai **premium operational terminal**, bukan dashboard SaaS yang penuh floating card.

Prioritas utama:

1. **Fast to operate** — kasir dapat menemukan produk, menambah item, dan checkout tanpa elemen visual yang mengganggu.
2. **Visual consistency** — sidebar, topbar, content, product area, dan cart menggunakan satu design language.
3. **Flat-first UI** — kurangi shadow, border radius berlebihan, floating container, dan efek elevasi.
4. **Clear hierarchy** — hierarchy dibentuk melalui spacing, typography, border, state, dan accent color; bukan dengan menumpuk card.
5. **Subtle interaction** — hover dan animation tetap ada sebagai feedback, tetapi tidak membuat UI terasa lambat.

---

## 1. Diagnosis UI Saat Ini

### Masalah utama

- Terlalu banyak elemen menggunakan kombinasi `background + border + shadow + rounded corner`.
- Topbar terlihat seperti floating SaaS card, sedangkan sidebar terlihat seperti operational dashboard.
- Search bar terlalu dominan secara visual.
- Category navigation terlalu banyak menggunakan pill button.
- Product card memiliki visual weight yang terlalu besar untuk sebuah item kasir.
- Cart terlihat seperti dashboard widget, bukan transaction workspace.
- Hover state berpotensi membuat product card terasa melompat/elevated.
- Whitespace cukup besar sehingga jumlah produk yang terlihat dalam satu layar menjadi rendah.

### Prinsip perbaikan

> **Jangan mempercantik setiap elemen. Tentukan elemen mana yang memang perlu menonjol.**

---

# 2. Target Design Direction

Gunakan arah desain:

**Flat + Dense + Operational + Premium**

Hindari arah desain:

**Glassmorphism + Floating SaaS + Excessive Pills**

Kesan visual yang dicari:

- modern
- bersih
- profesional
- cepat
- stabil
- cocok digunakan selama berjam-jam oleh kasir
- tetap terasa premium tanpa terlihat dekoratif

---

# 3. Layout Architecture

## Struktur utama

```text
┌───────────────┬────────────────────────────────────────────┐
│               │ Topbar                                   │
│   Sidebar     ├───────────────────────────────────────────┤
│               │ Search / Store / Filter                   │
│               ├───────────────────────────────────────────┤
│               │ Category                                  │
│               ├────────────────────────────┬──────────────┤
│               │                            │              │
│               │ Product Grid               │ Cart         │
│               │                            │              │
│               │                            │              │
│               │                            │              │
│               └────────────────────────────┴──────────────┤
└───────────────┴────────────────────────────────────────────┘
```

### Grid recommendation

Desktop:

- Sidebar: `240–260px`
- Main area: flexible
- Cart: `380–420px`
- Gap antar area: `20–24px`

Cart sebaiknya tetap terlihat sepanjang proses transaksi.

---

# 4. Sidebar

Sidebar saat ini sudah paling dekat dengan target design. Pertahankan karakter compact dan operational.

## Yang dipertahankan

- Section label seperti `OPERASIONAL`, `MANAJEMEN`, `WORKSPACE`.
- Icon sederhana.
- Active navigation dengan accent orange.
- Terminal kasir di bagian bawah.

## Yang diperbaiki

- Kurangi rounded container active state.
- Hindari active state yang terlihat seperti floating card besar.
- Gunakan background accent yang sangat tipis.
- Gunakan border-left atau accent line sebagai indicator tambahan.

Contoh state:

```text
Active:
│  🧾  Kasir POS                         Live
```

Bukan:

```text
╭────────────────────────────────────╮
│ 🧾  Kasir POS                 Live │
╰────────────────────────────────────╯
```

### Target

Sidebar harus terasa sebagai **navigation rail**, bukan kumpulan card.

---

# 5. Topbar / Navbar

Ini adalah area yang paling perlu diselaraskan dengan sidebar.

## Masalah

Topbar saat ini terlalu menyerupai floating card:

- radius besar
- border
- shadow
- terlalu tinggi
- action button berbentuk pill besar

## Perubahan

Topbar harus menjadi bagian dari layout, bukan card.

Gunakan:

```css
height: 64px–72px;
border-bottom: 1px solid;
background: transparent / surface;
box-shadow: none;
border-radius: 0;
```

Contoh struktur:

```text
Kasir POS                                      🎙 Rekam   Shift   ● Register Aktif
Terminal register penjualan responsif...
```

### Button treatment

`Rekam suara`, `Draft without direction`, dan `Register Aktif` jangan semuanya menjadi pill button besar.

Gunakan hierarchy:

- Primary action → button dengan accent.
- Secondary action → text/outline button.
- Status → compact status badge.

---

# 6. Search Area

Search harus membantu kasir, bukan mengambil alih layar.

## Target

Tinggi:

`44–48px`

Gunakan:

- border tipis
- radius `10–12px`
- shadow none
- search icon
- placeholder yang jelas

Contoh:

```text
┌──────────────────────────────────────────────────────┐
│ 🔍  Cari nama produk atau SKU...                     │
└──────────────────────────────────────────────────────┘
```

Store selector dan filter boleh tetap berada di kanan, tetapi ukurannya harus lebih compact.

---

# 7. Category Navigation

Kategori tidak perlu terlihat seperti kumpulan CTA.

Current:

```text
[ Coffee ] [ Non Coffee ] [ Food ] [ Snack ] [ Dessert ]
```

Target:

```text
Coffee   Non Coffee   Food   Snack   Dessert
──────
```

Atau gunakan subtle segmented control dengan active background yang tipis.

### Active state

- text accent
- underline `2–3px`, atau
- background accent `5–10% opacity`

Jangan menggunakan shadow untuk active category.

---

# 8. Product Grid

Product grid adalah area kerja utama. Buat lebih dense.

## Product card rules

Card tidak boleh terasa seperti dashboard widget.

Gunakan:

- background surface
- border tipis
- radius `10–14px`
- shadow none atau sangat subtle
- padding konsisten
- image ratio konsisten

### Contoh

```text
┌──────────────────────────────┐
│                              │
│          PRODUCT IMAGE       │
│                              │
├──────────────────────────────┤
│ Beban Keluarga               │
│ Rp 1.000.000                 │
│ KC-0001 · 0 pcs              │
│                              │
│                     [−] 1 [+]│
└──────────────────────────────┘
```

### Interaksi

Klik card → add to cart.

Alternatif:

- klik `+`
- keyboard shortcut
- voice command

Hindari tombol `Add to cart` besar di setiap card jika click-to-add sudah tersedia.

---

# 9. Product Card Hover

Hilangkan transform yang agresif.

## Jangan

```css
transform: translateY(-4px);
box-shadow: 0 12px 30px ...;
```

## Gunakan

```css
background: slightly-changed-surface;
border-color: accent-or-neutral-stronger;
transition: background-color 120ms ease, border-color 120ms ease;
```

Hover harus terasa seperti **feedback**, bukan animasi promosi.

---

# 10. Selected Product State

State selected perlu berbeda jelas dari hover.

Contoh:

```text
Normal
border: neutral

Hover
border: stronger-neutral

Selected / in cart
border: accent
background: accent-soft
```

Jangan menggunakan shadow besar untuk selected state.

---

# 11. Cart Panel

Cart adalah transaction workspace dan harus memiliki visual hierarchy paling tinggi setelah checkout.

## Target structure

```text
┌──────────────────────────────┐
│ 🛒 Keranjang            (3)  │
├──────────────────────────────┤
│ Americano              25.000│
│ 2 × 12.500                  │
│                              │
│ Latte                  30.000│
│ 1 × 30.000                  │
│                              │
├──────────────────────────────┤
│ Subtotal               55.000│
│ Diskon                      - │
│                              │
│ Total Tagihan          55.000│
│                              │
│ [      Bayar Sekarang     ] │
└──────────────────────────────┘
```

## Visual rules

- Jangan gunakan shadow berat.
- Border cukup `1px`.
- Radius maksimal `14px`.
- Cart boleh sticky/fixed terhadap viewport.
- Item list harus memiliki spacing yang cukup tetapi tetap dense.
- Checkout CTA adalah satu-satunya elemen yang boleh memiliki visual weight sangat kuat.

---

# 12. Checkout Button

`Bayar Sekarang` adalah primary conversion action.

### Normal

Accent background.

### Disabled

Muted background + muted text.

### Loading

Gunakan spinner kecil atau progress indicator.

### Hover

Sedikit perubahan brightness/background. Tidak perlu scale atau lift.

---

# 13. Card & Radius System

Gunakan sistem radius yang konsisten.

```text
Small:  8px
Medium: 12px
Large:  14px
```

Hindari:

- `20px+` pada komponen operasional
- radius berbeda-beda tanpa alasan
- setiap element menggunakan rounded-full

`rounded-full` hanya untuk:

- avatar
- status dot
- compact badge
- icon button tertentu

---

# 14. Shadow System

Default:

```text
No shadow
```

Gunakan shadow hanya untuk:

- dropdown
- modal
- command palette
- popover
- floating action yang memang benar-benar floating

Product card, topbar, category, dan sidebar tidak perlu shadow besar.

---

# 15. Border System

Border adalah alat utama untuk menggantikan shadow.

Gunakan satu neutral border token:

```text
border-subtle
border-default
border-strong
```

Contoh hierarchy:

```text
Page      → no border
Section   → border-bottom
Card      → border-default
Hover     → border-strong
Selected  → accent border
```

---

# 16. Typography

Typography harus membantu scanning cepat.

## Hierarchy

```text
Page title        → 22–24px / semibold
Section title     → 18–20px / semibold
Product name      → 14–16px / semibold
Product price     → 14–16px / semibold
Metadata          → 12–13px / regular
Navigation        → 14–15px / medium
```

Harga produk harus cukup menonjol, tetapi tidak mengalahkan product name.

---

# 17. Color System

Pertahankan orange sebagai brand/action accent.

Gunakan neutral surface yang dominan.

Konsep token:

```text
background
surface
surface-muted
border
text-primary
text-secondary
text-muted
accent
accent-soft
success
warning
error
```

Jangan membuat setiap state menggunakan warna yang terlalu kuat.

Orange terutama untuk:

- primary action
- active navigation
- selected state
- important status
- checkout

---

# 18. Animation & Motion

Motion harus cepat dan utilitarian.

Default:

```text
100–160ms
```

Gunakan hanya untuk:

- hover
- focus
- dropdown open/close
- cart update
- toast
- modal

Hindari:

- card bounce
- card lift berlebihan
- scale pada seluruh product card
- transition panjang
- decorative animation

Rule:

> **Kasir harus merasa UI mengikuti tindakan mereka, bukan menunggu animasi UI selesai.**

---

# 19. Responsive Behavior

## Desktop

Prioritas utama.

Product grid menggunakan ruang utama, cart tetap visible.

## Tablet

- Sidebar dapat dipersempit.
- Cart tetap visible atau berubah menjadi drawer.
- Product grid 2–3 kolom.

## Mobile

- Sidebar menjadi bottom navigation atau drawer.
- Cart menjadi bottom sheet.
- Product grid 2 kolom.
- Search full width.

---

# 20. Accessibility & Interaction

Pastikan:

- focus state terlihat jelas
- keyboard navigation tersedia
- tombol memiliki label yang jelas
- contrast tetap cukup tinggi
- status tidak hanya dibedakan berdasarkan warna

Voice input juga harus memiliki visual state:

```text
Idle       → 🎙 Rekam suara
Listening  → ● Mendengarkan...
Processing → ◌ Memproses...
Success    → ✓ Perintah diterapkan
Error      → ! Tidak memahami perintah
```

Visual state tetap subtle dan tidak mengganggu transaksi.

---

# 21. Voice-to-POS UI

Karena POS akan memiliki voice interaction, jangan menjadikan voice UI sebagai gimmick besar.

Voice interaction harus terasa seperti layer tambahan di atas POS.

Contoh:

> “Tambah dua iced latte.”

System:

```text
Listening...
↓
Recognized: Tambah 2 Iced Latte
↓
Cart updated
```

Feedback cukup menggunakan compact status/toast.

Jangan membuka modal besar setiap kali voice command diproses.

---

# 22. Remove / Reduce Checklist

Hapus atau kurangi secara agresif:

- [ ] Floating topbar card
- [ ] Shadow besar pada card
- [ ] Excessive rounded container
- [ ] Pill button yang tidak perlu
- [ ] Product card lift animation
- [ ] Add-to-cart button yang terlalu besar
- [ ] Excessive whitespace
- [ ] Duplicate visual hierarchy
- [ ] Decorative UI yang tidak membantu transaksi

---

# 23. Keep Checklist

Pertahankan:

- [ ] Orange brand accent
- [ ] Sidebar navigation structure
- [ ] Section labels
- [ ] Product categories
- [ ] Search functionality
- [ ] Store selector
- [ ] Voice action
- [ ] Cart summary
- [ ] Checkout CTA
- [ ] Terminal / shift status

---

# 24. Implementation Order

Kerjakan secara bertahap agar tidak merusak fungsi POS.

## Phase 1 — Global Design Tokens

Update:

- colors
- radius
- borders
- shadows
- spacing
- typography
- transition duration

## Phase 2 — Shell

Refactor:

- sidebar
- topbar
- main content spacing
- page background

Target: sidebar dan topbar terasa berasal dari satu design system.

## Phase 3 — Product Area

Refactor:

- search
- category tabs
- product grid
- product cards
- hover/selected state

Target: lebih dense dan lebih cepat discan.

## Phase 4 — Cart

Refactor:

- cart container
- cart item
- subtotal
- total
- payment CTA

Target: cart terasa seperti terminal transaksi.

## Phase 5 — Motion

Audit seluruh:

- hover
- focus
- click
- transition
- loading

Hilangkan motion yang tidak memiliki fungsi.

## Phase 6 — Responsive

Validasi desktop → tablet → mobile.

---

# 25. Definition of Done

Design refactor dianggap selesai ketika:

- Topbar tidak lagi terlihat seperti floating SaaS card.
- Sidebar dan topbar menggunakan visual language yang konsisten.
- Shadow hanya muncul pada elemen yang benar-benar floating.
- Product card tidak “meloncat” saat hover.
- Category navigation tidak terasa seperti deretan CTA.
- Product area dapat menampilkan lebih banyak produk pada viewport yang sama.
- Cart jelas menjadi area transaksi utama.
- Checkout CTA menjadi visual hierarchy tertinggi dalam cart.
- UI terasa cepat walaupun semua hover/focus state aktif.
- Tidak ada komponen yang memiliki radius/shadow hanya sebagai dekorasi.
- Voice interaction memiliki state yang jelas tetapi tetap subtle.

---

# 26. Final Design Principle

> **PurrCoffee POS bukan dashboard yang kebetulan punya fitur kasir.**
>
> **PurrCoffee POS adalah terminal kasir yang kebetulan memiliki analytics, inventory, dan AI assistance.**

Semua keputusan visual harus mengikuti prinsip tersebut.

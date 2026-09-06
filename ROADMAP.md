# PawPOS Multi-Operational Roadmap

> **Untuk Agentic AI yang melanjutkan repo ini.** Dokumen ini adalah sumber kebenaran
> status sistem. Baca dulu sebelum menyentuh kode. Terakhir diperbarui: 2026-09-06.

## 1. Visi

PawPOS adalah POS + sistem operasional multi-layanan untuk pet shop, grooming,
klinik hewan, dan penitipan. Kasir barang dan jasa hidup dalam **satu alur**:
booking jasa yang selesai otomatis menjadi struk kasir (`bookings → orders`).

## 2. Status modul (fakta, bukan rencana)

| Area | Status | Catatan |
|---|---|---|
| Auth backend (bcrypt + sesi opaque) | ✅ Live | `POST /auth/login\|pin`, `GET /auth/me`, `POST /auth/logout`; tabel `users/sessions/roles` (00001+00007). Frontend backend-first, fallback demo lokal. |
| Produk + Kategori | ✅ Live | `GET/POST /categories`; produk bawa `category_id`; tab POS dari DB (heuristik keyword sudah dihapus). |
| Stok awal saat buat produk | ✅ Live | `POST /products` terima `initial_stock_qty` + `location_id` → auto-mutasi `opening`. Edit produk TIDAK boleh ubah stok (ledger). |
| POS, split payment, shift/Z-report | ✅ Live | Inti MVP. `orders.shift_id` masih nullable/tidak diisi repo — backlog kecil. |
| Pelanggan & Hewan (F1a) | ✅ Live | `customers` + `pets` CRUD, search, filter per pemilik. |
| Layanan & Paket (F1b) | ✅ Live | `services` (grooming/klinik/penitipan/lainnya) + `service_packages` + items. |
| Booking & Antrean (F1c) | ✅ Live | Status `antre→proses→selesai`, `batal`. `selesai` HANYA via `POST /bookings/{id}/complete` + pembayaran. |
| Item jasa di order | ✅ Live | `order_items.item_kind` + `service_id` (00012). Item jasa skip kunci/potong/movement stok. |
| Dark-mode contrast | ✅ Gelombang 1 | Critical+major fungsional diperbaiki (pil SKU, struk, stepper, tabel). Sisa: glare minor chip pastel & border `#e2e8f0`. |
| PWA | ✅ Instalable | Ikon PNG + maskable, `sw.js` cache v2, splash, tombol instal. |
| Promo & Voucher (F1d) | ✅ Live | Modul `promos` (percent/nominal, min_spend, quota), tabel `promo_redemptions`, endpoint `/promos/validate`, integrasi POS & receipt, halaman `/promos`. |
| Supplier & PO (F1e) | ❌ Berikutnya | Spec §4.2 |
| Biaya + Laporan (F2) | ❌ Belum | Butuh data F1d/F1e untuk laba bersih. |
| Rekam Medis + Karyawan (F3) | ❌ Belum | Tabel `users.pin` sudah ada (00007); hapus DEMO_ACCOUNTS hardcode saat F3. |
| Authz backend | ❌ Belum | Semua endpoint masih publik. RBAC baru di frontend. Middleware Bearer direncanakan, belum ada. |

## 3. Konvensi yang WAJIB diikuti (pelanggaran = revert)

### 3.1 Backend Go (`apps/api`, module `github.com/muhri/ai-operational-pos/apps/api`)
- Satu bounded context = satu file/paket di `internal/modules/<nama>/`: struct,
  `Repository` interface, `MemoryRepository`, `PostgresRepository`, `Handler`,
  `NewHandler`, file `*_test.go`. Contoh teladan: `customers/`, `services/`.
- Semua repo filter `tenant_id` dari `tenantcontext.FromContext(ctx)`.
- Dual persistence TANPA kecuali: setiap repo wajib memory + postgres.
  Jangan ubah signature konstruktor router yang dipakai test
  (`NewRouter(nil, nil, nil)` adalah satu-satunya konstruktor yang dipakai
  `router_test.go`; repo baru ditambah lewat `NewRouterWithAuthRepos` + nil-guard).
- Error domain typed (`ErrXxxNotFound`) + mapping ke envelope di handler.
  Pesan user Bahasa Indonesia. Jangan `errors.New` inline untuk error validasi
  (jatuh ke 500).
- Cross-module: dependensi SATU arah via interface di konstruktor/handler
  (`orders → inventory`, `bookings → orders/services/customers`).
  Jangan bikin siklus import. Logika orkestrasi di handler, repo tetap fokus.
- Migrasi di `db/migrations/NNNNN_*.sql`: **UP-only, TANPA blok Down**
  (`cmd/migrate` + docker-initdb mengeksekusi seluruh file; blok Down pernah
  menghapus tabel di DB fresh). Runner berhenti di marker `-- +goose Down`.
- `gofmt -l` harus kosong untuk file yang disentuh. `go vet` + `go test ./...`
  hijau sebelum selesai.

### 3.2 Frontend (`apps/web`, React 19 + MUI, tanpa state lib)
- Satu slice = `*Api.ts` (fetch + `X-Tenant-ID` + envelope `{data}`/`{error}`,
  typed `*ApiError`, `NETWORK_ERROR` untuk fetch gagal) + `*Page.tsx`
  (tabel + dialog + empty-state + snackbar) + `*.test.tsx`.
- State: `useState` lokal + `localStorage` + event `window.CustomEvent`
  (`pawpos:tenant_change`, dsb). Jangan tambah redux/zustand/react-query.
- Tambah menu = 1 entri di `features/navigation/navRegistry.ts` + rute +
  permission di `features/auth/rbac.ts`. Menu belum jadi pakai `comingSoon: true`.
- Dark-mode: **dilarang** `bgcolor` hex terang menampung teks theme-aware,
  **dilarang** teks hex gelap di atas surface theme-aware. Pakai token
  (`background.default`, `action.hover`, `success.main`, `error.main`,
  `warning.main`, `info.main`, `success.light`, `error.light`, `divider`,
  `text.primary/secondary/disabled`). Kertas struk = `background.default`.
- `npm run build` (tsc) + `vitest run` hijau. Test baru yang pakai
  `mockResolvedValueOnce` harus menghitung slot fetch tambahan (tiap API call
  = 1 slot, sesuai urutan pemanggilan).

### 3.3 Kontrak & data demo
- Setiap endpoint baru wajib masuk `packages/api-contract/openapi.yaml`
  (ikut gaya file) + `npx @redocly/cli lint` valid tanpa warning.
- `scripts/seed-demo-data.mjs` adalah etalase lead: idempoten (cek eksistensi
  dulu, toleransi 409), tanpa kredensial baru. `node --check` sebelum selesai.

## 4. Backlog berurutan (kerjakan sesuai nomor)

### 4.1 F1d — Promo & Voucher (✅ Selesai)
- BE modul `promos`: `promos(code unique/tenant, kind: percent|nominal,
  value, min_spend, quota, starts_at, ends_at, is_active)` + tabel pemakaian
  `promo_redemptions(order_id, promo_id)` agar kuota tidak bisa diakali.
- Validasi di kasir: `POST /promos/validate {code, subtotal}` → `{discount}`.
  Order terima `promo_id` opsional; catat redemption dalam tx yang sama dengan
  order (ikuti pola tx `orders.go`).
- FE: halaman Promo (CRUD + kuota terpakai) + field kode promo di dialog
  checkout POS. Nav flag `promos` sudah live di registry (comingSoon hapus).
- Test: kuota habis ditolak, periode kedaluwarsa ditolak, nominal > subtotal
  di-cap ke subtotal. Unit test backend & Vitest frontend lulus 100%.

### 4.2 F1e — Supplier & Pembelian (PO)
- BE modul `suppliers` (CRUD) + `purchases` (`purchase_orders` + items,
  status `draft→diterima|batal`). Saat terima: tiap item auto-mutasi
  `purchase_receipt` (ikuti pola sale di `orders.go`, tapi +qty).
  Terima bersifat final (tidak bisa un-terima; koreksi via adjustment).
- FE: halaman Supplier + PO (buat draft → tambah item → terima).
  Nav flag `suppliers`, `purchases` hapus comingSoon.
- Test: terima PO menambah saldo + movement tercatat; PO draft tidak
  mengubah stok.

### 4.3 F2 — Biaya Operasional + Laporan
- BE modul `expenses` (kategori, tanggal, metode, nominal, bukti teks) — CRUD.
- Laporan = endpoint agregasi baca-saja (tanpa tabel baru):
  `GET /reports/summary?from=&to=` → omset, per metode, item jasa vs barang,
  total biaya, **laba bersih**, top produk/layanan, stok menipis.
- FE: halaman Biaya + Laporan (grafik; boleh tambah dep chart standar).
  Dashboard tampilkan kartu laba bersih (butuh F2, jangan sebelumnya).
- Nav flag `expenses`, `reports` hapus comingSoon.

### 4.4 F3 — Rekam Medis + Karyawan & Akses
- BE modul `medical`: `medical_records` **append-only** (tanpa UPDATE/DELETE,
  ikuti pola trigger `stock_movements`): pet, tanggal, diagnosa, tindakan,
  obat[] (kurangi stok otomatis seperti sale), vaksin berikutnya.
- BE `users` CRUD (gantikan `DEMO_ACCOUNTS` hardcode di frontend):
  bcrypt + PIN + role (`staff_jasa` sudah ada di RBAC + tabel roles perlu seed).
  Hapus fallback demo hanya SETELAH ini live + migrasi akun.
- FE: halaman Medis (timeline per hewan) + Karyawan (CRUD + atur peran/PIN).
- Hapus `loginAsDemo` dan data demo dari bundle produksi.

### 4.5 Utang teknis kecil (boleh disisipkan)
- Isi `orders.shift_id` saat create (repo orders sudah punya akses shift via
  SaleRecorder; tinggal set kolom).
- RAG `TodaySales` di assistant belum filter hari ini (hitung semua order).
- Code-split bundle JS 900KB+ (`manualChunks`) untuk HP kentang.
- Sisa glare minor dark-mode (chip pastel, border `#e2e8f0` ~20 titik).

## 5. Perintah verifikasi (wajib hijau tiap sesi)

```bash
# Backend
cd apps/api && gofmt -l cmd internal/modules/<modul> internal/httpserver
go vet ./... && go test ./...
# Frontend
npm --workspace apps/web run build
npm --workspace apps/web run test:run
# Kontrak + seed
npx --yes @redocly/cli lint packages/api-contract/openapi.yaml
node --check scripts/seed-demo-data.mjs
# Live (build biner eksplisit, JANGAN go run untuk verifikasi)
go build -o $env:TEMP/pawpos-srv.exe ./cmd/server
```

## 6. Jebakan yang sudah memakan korban (baca!)

1. **Port 8080 dihuni biner basi.** `go run`/biner lama sering nyangkut dan
   menyajikan 404 untuk endpoint baru. Selalu bunuh proses di port dulu,
   verifikasi PID + waktu start-nya sebelum menyimpulkan bug.
2. **Quoting curl di PowerShell rusak.** Jangan `-d '{"a":1}'` inline
   (quote lolos mentah → INVALID_REQUEST). Tulis body ke file temp lalu
   `--data "@file"`.
3. **`go run` untuk verifikasi live menipu** (cache/proses ganda). Selalu
   `go build` eksplisit + jalankan binernya.
4. **Fetch mock `mockResolvedValueOnce` rapuh.** Tiap API call = 1 slot sesuai
   urutan. Tambah 1 fetch di `loadData` = semua test Once harus tambah slot.
5. ** chi URL params kosong di luar router.** Test handler langsung untuk rute
   `/{id}` akan 404 — uji alur HTTP lewat `router_test.go` (`NewRouter`).
6. **`t.Context()` butuh go1.24**; modul ini go1.23 → pakai
   `context.Background()` di test.
7. **Jangan tambah tabel tanpa dual repo + test + OpenAPI + seed relevan.**
   Paket "selesai" = 5 hal itu hijau.

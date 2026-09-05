package assistant

import (
	"context"
	"fmt"
	"strings"

	"github.com/muhri/ai-operational-pos/apps/api/internal/modules/inventory"
	"github.com/muhri/ai-operational-pos/apps/api/internal/modules/orders"
	"github.com/muhri/ai-operational-pos/apps/api/internal/modules/products"
	"github.com/muhri/ai-operational-pos/apps/api/internal/modules/shifts"
	"github.com/muhri/ai-operational-pos/apps/api/internal/modules/tenant"
)

type ProductLister interface {
	List(ctx context.Context) ([]products.Product, error)
}

type StockLister interface {
	GetStockBalances(ctx context.Context, locationID *string) ([]inventory.ProductStockSummary, error)
}

type ShiftGetter interface {
	GetCurrentShift(ctx context.Context) (*shifts.Shift, error)
}

type OrderLister interface {
	ListOrders(ctx context.Context, locationID *string) ([]orders.Order, error)
}

type TenantGetter interface {
	GetByID(ctx context.Context, id string) (tenant.Tenant, error)
}

type ProductSummary struct {
	ID           string `json:"id"`
	SKU          string `json:"sku"`
	Name         string `json:"name"`
	SellingPrice int64  `json:"selling_price_idr"`
	StockQty     int    `json:"stock_qty"`
	MinStock     int    `json:"minimum_stock"`
}

type ShiftSummary struct {
	CashierName    string `json:"cashier_name"`
	StartingCash   int64  `json:"starting_cash_idr"`
	TotalCashSales int64  `json:"total_cash_sales_idr"`
	ExpectedCash   int64  `json:"expected_cash_idr"`
	Status         string `json:"status"`
}

type StoreContext struct {
	TenantID      string           `json:"tenant_id"`
	TenantName    string           `json:"tenant_name"`
	PlanType      string           `json:"plan_type"`
	Products      []ProductSummary `json:"products"`
	LowStockAlert []ProductSummary `json:"low_stock_alert"`
	ActiveShift   *ShiftSummary    `json:"active_shift,omitempty"`
	TodaySalesIDR int64            `json:"today_sales_idr"`
	TodayOrders   int              `json:"today_orders"`
}

type StoreContextProvider interface {
	GetStoreContext(ctx context.Context, tenantID string) (StoreContext, error)
}

type DefaultStoreContextProvider struct {
	Products ProductLister
	Stocks   StockLister
	Shifts   ShiftGetter
	Orders   OrderLister
	Tenants  TenantGetter
}

func (p *DefaultStoreContextProvider) GetStoreContext(ctx context.Context, tenantID string) (StoreContext, error) {
	sc := StoreContext{
		TenantID:      tenantID,
		TenantName:    "PawPOS Merchant",
		PlanType:      "starter",
		Products:      make([]ProductSummary, 0),
		LowStockAlert: make([]ProductSummary, 0),
	}

	if p.Tenants != nil {
		if t, err := p.Tenants.GetByID(ctx, tenantID); err == nil && t.ID != "" {
			sc.TenantName = t.Name
			sc.PlanType = t.PlanType
		}
	}

	stockMap := make(map[string]int)
	if p.Stocks != nil {
		if stList, err := p.Stocks.GetStockBalances(ctx, nil); err == nil {
			for _, st := range stList {
				stockMap[st.ProductID] = int(st.Quantity)
			}
		}
	}

	if p.Products != nil {
		if prodList, err := p.Products.List(ctx); err == nil {
			for _, pr := range prodList {
				qty := stockMap[pr.ID]
				ps := ProductSummary{
					ID:           pr.ID,
					SKU:          pr.SKU,
					Name:         pr.Name,
					SellingPrice: pr.SellingPriceIDR,
					StockQty:     qty,
					MinStock:     int(pr.MinimumStock),
				}
				sc.Products = append(sc.Products, ps)
				if float64(qty) <= pr.MinimumStock {
					sc.LowStockAlert = append(sc.LowStockAlert, ps)
				}
			}
		}
	}

	if p.Shifts != nil {
		if sh, err := p.Shifts.GetCurrentShift(ctx); err == nil && sh != nil && sh.Status == "open" {
			sc.ActiveShift = &ShiftSummary{
				CashierName:    sh.CashierName,
				StartingCash:   sh.StartingCashIDR,
				TotalCashSales: sh.TotalCashSalesIDR,
				ExpectedCash:   sh.ExpectedCashIDR,
				Status:         sh.Status,
			}
		}
	}

	if p.Orders != nil {
		if ordList, err := p.Orders.ListOrders(ctx, nil); err == nil {
			sc.TodayOrders = len(ordList)
			for _, o := range ordList {
				sc.TodaySalesIDR += o.TotalIDR
			}
		}
	}

	return sc, nil
}

func BuildSystemPrompt(sc StoreContext) string {
	var sb strings.Builder
	sb.WriteString("Kamu adalah PawPOS AI Assistant — Copilot pintar dan Customer Support resmi untuk kasir dan operasional pet business.\n")
	sb.WriteString("Model: Groq GPT-OSS 120B.\n")
	sb.WriteString("Karakter: Maskot Shiba/fox oranye 3D mengenakan polo shirt hitam dan headset CS (Always Here to Help). Nada bicara ramah, ringkas, solutif, sopan, dan sigap.\n\n")

	sb.WriteString("=== DATA REAL-TIME OPERASIONAL TOKO (RAG CONTEXT) ===\n")
	sb.WriteString(fmt.Sprintf("• Nama Toko: %s (Paket: %s)\n", sc.TenantName, strings.ToUpper(sc.PlanType)))

	if sc.ActiveShift != nil {
		sb.WriteString(fmt.Sprintf("• Shift Aktif: Kasir %s (Modal Awal: Rp %d, Kas Penjualan: Rp %d, Ekspektasi Kas Laci: Rp %d)\n",
			sc.ActiveShift.CashierName, sc.ActiveShift.StartingCash, sc.ActiveShift.TotalCashSales, sc.ActiveShift.ExpectedCash))
	} else {
		sb.WriteString("• Shift Kasir: Belum ada shift aktif yang dibuka saat ini.\n")
	}

	sb.WriteString(fmt.Sprintf("• Total Transaksi Toko: %d Order (Total Omset: Rp %d)\n", sc.TodayOrders, sc.TodaySalesIDR))

	sb.WriteString("\n=== KATALOG PRODUK & STOK TOKO ===\n")
	if len(sc.Products) == 0 {
		sb.WriteString("Belum ada produk yang terdaftar di katalog toko.\n")
	} else {
		for _, pr := range sc.Products {
			sb.WriteString(fmt.Sprintf("• %s (SKU: %s) — Harga: Rp %d, Stok Fisik: %d unit (Batas Min: %d)\n",
				pr.Name, pr.SKU, pr.SellingPrice, pr.StockQty, pr.MinStock))
		}
	}

	sb.WriteString("\n=== PERINGATAN STOK MENIPIS / PERLU RESTOCK ===\n")
	if len(sc.LowStockAlert) == 0 {
		sb.WriteString("Semua produk saat ini memiliki persediaan stok yang aman.\n")
	} else {
		for _, pr := range sc.LowStockAlert {
			sb.WriteString(fmt.Sprintf("⚠️ PERINGATAN: %s (SKU: %s) tersisa %d unit (Batas minimum: %d)\n",
				pr.Name, pr.SKU, pr.StockQty, pr.MinStock))
		}
	}

	sb.WriteString("\n=== PENGETAHUAN KHUSUS PET CARE & SOP KASIR PAWPOS ===\n")
	sb.WriteString("1. Rekomendasi Pakan: Anak kucing/anjing (kitten/puppy) membutuhkan pakan tinggi protein untuk pertumbuhan dan tekstur lembut. Hewan dewasa membutuhkan nutrisi seimbang untuk kontrol berat badan.\n")
	sb.WriteString("2. Perawatan & Grooming: Kucing/anjing butuh sampo khusus anti-kutu/jamur jika gatal, pembersihan telinga rutin, serta pemotongan kuku berkala.\n")
	sb.WriteString("3. SOP Split Payment di PawPOS: Di kasir POS, pilih metode 'Split', tentukan porsi Non-Tunai (QRIS/EDC) dan porsi Tunai yang disetor pelanggan. Sistem otomatis mencatat uang tunai bersih ke kas laci (expected cash) dan menghitung kembalian tunai tanpa selisih.\n\n")

	sb.WriteString("=== PANDUAN FORMAT TAMPILAN RESMI (WAJIB DIPATUHI) ===\n")
	sb.WriteString("- Tulis jawaban yang sangat rapi, bersih, dan langsung ke intinya.\n")
	sb.WriteString("- DILARANG menggunakan karakter garis tegak '|' atau tabel ASCII/Markdown (| col |). Jangan pernah membuat tabel bergaris pipa.\n")
	sb.WriteString("- DILARANG menggunakan tanda pagar (#, ##, ###). Gunakan baris teks biasa atau poin.\n")
	sb.WriteString("- Hindari simbol bintang berlebih. Jika membuat daftar, gunakan nomor urut (1., 2., 3.) atau bullet point (•).\n")
	sb.WriteString("- Format nominal rupiah selalu dengan pemisah ribuan standar (contoh: Rp 50.000).\n")

	return sb.String()
}

func CleanAssistantReply(text string) string {
	lines := strings.Split(text, "\n")
	var cleaned []string

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			cleaned = append(cleaned, "")
			continue
		}

		// Skip markdown table separator lines like |---|---| or |:---|:---|
		if strings.HasPrefix(trimmed, "|") && strings.HasSuffix(trimmed, "|") {
			isSep := true
			for _, ch := range trimmed {
				if ch != '|' && ch != '-' && ch != ':' && ch != ' ' {
					isSep = false
					break
				}
			}
			if isSep {
				continue
			}

			// Convert table row | Col A | Col B | to "• Col A — Col B"
			inner := strings.Trim(trimmed, "|")
			cols := strings.Split(inner, "|")
			var colTexts []string
			for _, c := range cols {
				c = strings.TrimSpace(c)
				if c != "" {
					colTexts = append(colTexts, c)
				}
			}
			if len(colTexts) > 0 {
				cleaned = append(cleaned, "• "+strings.Join(colTexts, " — "))
				continue
			}
		}

		// Replace stray pipe characters used as separators " | " with bullet " • "
		line = strings.ReplaceAll(line, " | ", " • ")
		line = strings.ReplaceAll(line, "|", " • ")

		// Clean leading markdown header markers (e.g. ### Header -> Header)
		for strings.HasPrefix(line, "#") {
			line = strings.TrimPrefix(line, "#")
		}
		line = strings.TrimLeft(line, " ")

		cleaned = append(cleaned, line)
	}

	result := strings.Join(cleaned, "\n")
	for strings.Contains(result, "\n\n\n") {
		result = strings.ReplaceAll(result, "\n\n\n", "\n\n")
	}
	return strings.TrimSpace(result)
}

func LocalRAGFallback(message string, sc StoreContext, model string) string {
	lower := strings.ToLower(message)

	if strings.Contains(lower, "stok") || strings.Contains(lower, "habis") || strings.Contains(lower, "menipis") || strings.Contains(lower, "sisa") {
		if len(sc.LowStockAlert) > 0 {
			var lines []string
			lines = append(lines, fmt.Sprintf("Halo! Ditemukan %d produk yang persediaannya menipis atau di bawah batas minimum di %s:", len(sc.LowStockAlert), sc.TenantName))
			for _, pr := range sc.LowStockAlert {
				lines = append(lines, fmt.Sprintf("• **%s** (SKU: %s) — Sisa: **%d unit** (Batas aman min: %d)", pr.Name, pr.SKU, pr.StockQty, pr.MinStock))
			}
			lines = append(lines, "\nSegera lakukan mutasi stok masuk (inbound restock) agar operasional kasir tetap lancar ya! 🐾")
			return strings.Join(lines, "\n")
		}
		return fmt.Sprintf("Kabar baik! Semua produk di **%s** saat ini memiliki persediaan stok yang aman di atas batas minimum. 🐾", sc.TenantName)
	}

	if strings.Contains(lower, "shift") || strings.Contains(lower, "laci") || strings.Contains(lower, "kasir") {
		if sc.ActiveShift != nil {
			return fmt.Sprintf("Saat ini shift kasir sedang aktif bertugas:\n• **Kasir**: %s\n• **Modal Awal Laci**: Rp %s\n• **Penjualan Tunai**: Rp %s\n• **Ekspektasi Kas Fisik di Laci**: Rp %s\n\nKas fisik dan Z-Report laci kasir berada dalam kondisi seimbang. 🐾",
				sc.ActiveShift.CashierName,
				formatNominal(sc.ActiveShift.StartingCash),
				formatNominal(sc.ActiveShift.TotalCashSales),
				formatNominal(sc.ActiveShift.ExpectedCash),
			)
		}
		return fmt.Sprintf("Saat ini belum ada shift kasir yang aktif di **%s**. Silakan buka shift baru melalui menu Sesi & Shift dengan memasukkan modal kas awal. 🐾", sc.TenantName)
	}

	if strings.Contains(lower, "split") || strings.Contains(lower, "campuran") || strings.Contains(lower, "bayar") {
		return "Untuk melakukan **Pembayaran Campuran (Split Payment)** di PawPOS:\n1. Di kasir POS, klik tombol **'Bayar Sekarang'**.\n2. Pilih tab **'Split (Campuran)'**.\n3. Masukkan nominal porsi **Non-Tunai (QRIS / EDC)** dan uang **Tunai** yang disetor pelanggan (atau gunakan tombol *Bagi Rata 50%*).\n4. Sistem akan otomatis memverifikasi kelunasan tagihan, menghitung uang kembalian tunai, dan merekonsiliasi kas laci kasir secara akurat! 🐾"
	}

	if strings.Contains(lower, "kucing") || strings.Contains(lower, "kitten") || strings.Contains(lower, "anjing") || strings.Contains(lower, "pakan") || strings.Contains(lower, "makan") {
		return "Rekomendasi pakan hewan peliharaan:\n• **Kitten/Puppy (< 1 tahun)**: Berikan makanan khusus dengan kadar protein dan kalsium tinggi, tekstur butiran kecil (kibble) atau basah (wet food) untuk mendukung pertumbuhan tulang dan gigi.\n• **Adult (1-7 tahun)**: Pakan dengan formula seimbang untuk menjaga berat badan ideal dan kilau bulu.\n• **Senior (> 7 tahun)**: Pakan dengan glukosamin untuk sendi dan mudah dicerna.\n\nPastikan juga air minum bersih selalu tersedia! 🐾"
	}

	if strings.Contains(lower, "produk") || strings.Contains(lower, "harga") || strings.Contains(lower, "katalog") {
		if len(sc.Products) > 0 {
			var lines []string
			lines = append(lines, fmt.Sprintf("Berikut daftar produk yang tersedia di katalog **%s**:", sc.TenantName))
			count := 0
			for _, pr := range sc.Products {
				lines = append(lines, fmt.Sprintf("• **%s** — Rp %s (Stok: %d)", pr.Name, formatNominal(pr.SellingPrice), pr.StockQty))
				count++
				if count >= 6 {
					break
				}
			}
			return strings.Join(lines, "\n")
		}
		return fmt.Sprintf("Belum ada produk yang didaftarkan di katalog %s.", sc.TenantName)
	}

	return fmt.Sprintf("Halo! Saya **PawPOS AI Assistant** (didukung Groq %s) siap membantu operasional toko hewan peliharaan Anda di **%s**.\n\nAnda dapat menanyakan:\n• Informasi ketersediaan stok & produk menipis\n• Status laci kasir dan shift berjalan\n• Panduan split payment dan POS register\n• Rekomendasi pakan dan perawatan hewan\n\nAda yang bisa saya bantu sekarang? 🐾", model, sc.TenantName)
}

func formatNominal(n int64) string {
	s := fmt.Sprintf("%d", n)
	if len(s) <= 3 {
		return s
	}
	var res []string
	rem := len(s) % 3
	if rem > 0 {
		res = append(res, s[:rem])
	}
	for i := rem; i < len(s); i += 3 {
		res = append(res, s[i:i+3])
	}
	return strings.Join(res, ".")
}

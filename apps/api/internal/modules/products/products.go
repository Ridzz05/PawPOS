package products

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/muhri/ai-operational-pos/apps/api/internal/platform/envelope"
	"github.com/muhri/ai-operational-pos/apps/api/internal/platform/tenantcontext"
)

// Product represents a product catalog entity.
type Product struct {
	ID               string    `json:"id"`
	TenantID         string    `json:"tenant_id"`
	CategoryID       *string   `json:"category_id,omitempty"`
	SKU              string    `json:"sku"`
	Name             string    `json:"name"`
	PurchasePriceIDR int64     `json:"purchase_price_idr"`
	SellingPriceIDR  int64     `json:"selling_price_idr"`
	BaseUnit         string    `json:"base_unit"`
	MinimumStock     float64   `json:"minimum_stock"`
	ImageURL         *string   `json:"image_url,omitempty"`
	IsActive         bool      `json:"is_active"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

// CreateProductRequest defines parameters to register a new product.
type CreateProductRequest struct {
	CategoryID       *string `json:"category_id,omitempty"`
	SKU              string  `json:"sku"`
	Name             string  `json:"name"`
	PurchasePriceIDR int64   `json:"purchase_price_idr"`
	SellingPriceIDR  int64   `json:"selling_price_idr"`
	BaseUnit         string  `json:"base_unit"`
	MinimumStock     float64 `json:"minimum_stock"`
	ImageURL         *string `json:"image_url,omitempty"`
}

// UpdateProductRequest defines parameters to update an existing product.
type UpdateProductRequest struct {
	CategoryID       *string `json:"category_id,omitempty"`
	SKU              string  `json:"sku"`
	Name             string  `json:"name"`
	PurchasePriceIDR int64   `json:"purchase_price_idr"`
	SellingPriceIDR  int64   `json:"selling_price_idr"`
	BaseUnit         string  `json:"base_unit"`
	MinimumStock     float64 `json:"minimum_stock"`
	ImageURL         *string `json:"image_url,omitempty"`
	IsActive         *bool   `json:"is_active,omitempty"`
}

var (
	ErrProductNotFound = errors.New("product not found")
	ErrSKUExists       = errors.New("product sku already exists")
)

// Repository defines data access for products.
type Repository interface {
	List(ctx context.Context) ([]Product, error)
	Create(ctx context.Context, req CreateProductRequest) (Product, error)
	GetBySKU(ctx context.Context, sku string) (Product, error)
	GetByID(ctx context.Context, id string) (Product, error)
	Update(ctx context.Context, id string, req UpdateProductRequest) (Product, error)
	Delete(ctx context.Context, id string) error
}

// MemoryRepository provides an in-memory thread-safe repository for tests and local fallback.
type MemoryRepository struct {
	mu       sync.RWMutex
	products []Product
}

func NewMemoryRepository() *MemoryRepository {
	return &MemoryRepository{
		products: make([]Product, 0),
	}
}

func (m *MemoryRepository) List(ctx context.Context) ([]Product, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	tenantID := tenantcontext.FromContext(ctx)
	result := make([]Product, 0, len(m.products))
	for _, p := range m.products {
		if p.TenantID == tenantID && p.IsActive {
			result = append(result, p)
		}
	}
	return result, nil
}

func (m *MemoryRepository) Create(ctx context.Context, req CreateProductRequest) (Product, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	tenantID := tenantcontext.FromContext(ctx)
	for _, p := range m.products {
		if p.TenantID == tenantID && strings.EqualFold(p.SKU, req.SKU) && p.IsActive {
			return Product{}, ErrSKUExists
		}
	}

	now := time.Now().UTC()
	prod := Product{
		ID:               fmt.Sprintf("prod-%d", len(m.products)+1),
		TenantID:         tenantID,
		CategoryID:       req.CategoryID,
		SKU:              req.SKU,
		Name:             req.Name,
		PurchasePriceIDR: req.PurchasePriceIDR,
		SellingPriceIDR:  req.SellingPriceIDR,
		BaseUnit:         req.BaseUnit,
		MinimumStock:     req.MinimumStock,
		ImageURL:         req.ImageURL,
		IsActive:         true,
		CreatedAt:        now,
		UpdatedAt:        now,
	}
	m.products = append(m.products, prod)
	return prod, nil
}

func (m *MemoryRepository) GetBySKU(ctx context.Context, sku string) (Product, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	tenantID := tenantcontext.FromContext(ctx)
	for _, p := range m.products {
		if p.TenantID == tenantID && strings.EqualFold(p.SKU, sku) && p.IsActive {
			return p, nil
		}
	}
	return Product{}, ErrProductNotFound
}

func (m *MemoryRepository) GetByID(ctx context.Context, id string) (Product, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	tenantID := tenantcontext.FromContext(ctx)
	for _, p := range m.products {
		if p.TenantID == tenantID && p.ID == id && p.IsActive {
			return p, nil
		}
	}
	return Product{}, ErrProductNotFound
}

func (m *MemoryRepository) Update(ctx context.Context, id string, req UpdateProductRequest) (Product, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	tenantID := tenantcontext.FromContext(ctx)
	idx := -1
	for i, p := range m.products {
		if p.TenantID == tenantID && p.ID == id {
			idx = i
			break
		}
	}
	if idx == -1 || !m.products[idx].IsActive {
		return Product{}, ErrProductNotFound
	}

	for i, p := range m.products {
		if i != idx && p.TenantID == tenantID && strings.EqualFold(p.SKU, req.SKU) && p.IsActive {
			return Product{}, ErrSKUExists
		}
	}

	now := time.Now().UTC()
	m.products[idx].CategoryID = req.CategoryID
	m.products[idx].SKU = req.SKU
	m.products[idx].Name = req.Name
	m.products[idx].PurchasePriceIDR = req.PurchasePriceIDR
	m.products[idx].SellingPriceIDR = req.SellingPriceIDR
	m.products[idx].BaseUnit = req.BaseUnit
	m.products[idx].MinimumStock = req.MinimumStock
	if req.ImageURL != nil {
		m.products[idx].ImageURL = req.ImageURL
	}
	if req.IsActive != nil {
		m.products[idx].IsActive = *req.IsActive
	}
	m.products[idx].UpdatedAt = now

	return m.products[idx], nil
}

func (m *MemoryRepository) Delete(ctx context.Context, id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	tenantID := tenantcontext.FromContext(ctx)
	for i, p := range m.products {
		if p.TenantID == tenantID && p.ID == id && p.IsActive {
			m.products[i].IsActive = false
			m.products[i].UpdatedAt = time.Now().UTC()
			return nil
		}
	}
	return ErrProductNotFound
}

// PostgresRepository persists products into PostgreSQL.
type PostgresRepository struct {
	db *sql.DB
}

func NewPostgresRepository(db *sql.DB) *PostgresRepository {
	return &PostgresRepository{db: db}
}

func (p *PostgresRepository) List(ctx context.Context) ([]Product, error) {
	tenantID := tenantcontext.FromContext(ctx)
	query := `
		SELECT id, tenant_id, category_id, sku, name, purchase_price_idr, selling_price_idr, base_unit, minimum_stock, is_active, created_at, updated_at, COALESCE(image_url, '')
		FROM products
		WHERE tenant_id = $1 AND is_active = TRUE
		ORDER BY name ASC
	`
	rows, err := p.db.QueryContext(ctx, query, tenantID)
	if err != nil {
		return nil, fmt.Errorf("query products: %w", err)
	}
	defer rows.Close()

	products := make([]Product, 0)
	for rows.Next() {
		var prod Product
		var catID sql.NullString
		var imgURL string
		if err := rows.Scan(
			&prod.ID,
			&prod.TenantID,
			&catID,
			&prod.SKU,
			&prod.Name,
			&prod.PurchasePriceIDR,
			&prod.SellingPriceIDR,
			&prod.BaseUnit,
			&prod.MinimumStock,
			&prod.IsActive,
			&prod.CreatedAt,
			&prod.UpdatedAt,
			&imgURL,
		); err != nil {
			return nil, fmt.Errorf("scan product: %w", err)
		}
		if catID.Valid {
			val := catID.String
			prod.CategoryID = &val
		}
		if imgURL != "" {
			prod.ImageURL = &imgURL
		}
		products = append(products, prod)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate products: %w", err)
	}
	return products, nil
}

func (p *PostgresRepository) Create(ctx context.Context, req CreateProductRequest) (Product, error) {
	tenantID := tenantcontext.FromContext(ctx)
	query := `
		INSERT INTO products (tenant_id, category_id, sku, name, purchase_price_idr, selling_price_idr, base_unit, minimum_stock, image_url)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, tenant_id, category_id, sku, name, purchase_price_idr, selling_price_idr, base_unit, minimum_stock, is_active, created_at, updated_at, COALESCE(image_url, '')
	`
	var catID *string
	if req.CategoryID != nil && *req.CategoryID != "" {
		catID = req.CategoryID
	}

	var prod Product
	var catIDNull sql.NullString
	var imgURL string
	err := p.db.QueryRowContext(
		ctx,
		query,
		tenantID,
		catID,
		req.SKU,
		req.Name,
		req.PurchasePriceIDR,
		req.SellingPriceIDR,
		req.BaseUnit,
		req.MinimumStock,
		req.ImageURL,
	).Scan(
		&prod.ID,
		&prod.TenantID,
		&catIDNull,
		&prod.SKU,
		&prod.Name,
		&prod.PurchasePriceIDR,
		&prod.SellingPriceIDR,
		&prod.BaseUnit,
		&prod.MinimumStock,
		&prod.IsActive,
		&prod.CreatedAt,
		&prod.UpdatedAt,
		&imgURL,
	)
	if err != nil {
		if strings.Contains(err.Error(), "unique constraint") || strings.Contains(err.Error(), "duplicate key") {
			return Product{}, ErrSKUExists
		}
		return Product{}, fmt.Errorf("insert product: %w", err)
	}
	if catIDNull.Valid {
		val := catIDNull.String
		prod.CategoryID = &val
	}
	if imgURL != "" {
		prod.ImageURL = &imgURL
	}
	return prod, nil
}

func (p *PostgresRepository) GetBySKU(ctx context.Context, sku string) (Product, error) {
	tenantID := tenantcontext.FromContext(ctx)
	query := `
		SELECT id, tenant_id, category_id, sku, name, purchase_price_idr, selling_price_idr, base_unit, minimum_stock, is_active, created_at, updated_at, COALESCE(image_url, '')
		FROM products
		WHERE tenant_id = $1 AND sku = $2
	`
	var prod Product
	var catID sql.NullString
	var imgURL string
	err := p.db.QueryRowContext(ctx, query, tenantID, sku).Scan(
		&prod.ID,
		&prod.TenantID,
		&catID,
		&prod.SKU,
		&prod.Name,
		&prod.PurchasePriceIDR,
		&prod.SellingPriceIDR,
		&prod.BaseUnit,
		&prod.MinimumStock,
		&prod.IsActive,
		&prod.CreatedAt,
		&prod.UpdatedAt,
		&imgURL,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return Product{}, ErrProductNotFound
	}
	if err != nil {
		return Product{}, fmt.Errorf("get product by sku: %w", err)
	}
	if catID.Valid {
		val := catID.String
		prod.CategoryID = &val
	}
	if imgURL != "" {
		prod.ImageURL = &imgURL
	}
	return prod, nil
}

func (p *PostgresRepository) GetByID(ctx context.Context, id string) (Product, error) {
	tenantID := tenantcontext.FromContext(ctx)
	query := `
		SELECT id, tenant_id, category_id, sku, name, purchase_price_idr, selling_price_idr, base_unit, minimum_stock, is_active, created_at, updated_at, COALESCE(image_url, '')
		FROM products
		WHERE tenant_id = $1 AND id = $2 AND is_active = TRUE
	`
	var prod Product
	var catID sql.NullString
	var imgURL string
	err := p.db.QueryRowContext(ctx, query, tenantID, id).Scan(
		&prod.ID,
		&prod.TenantID,
		&catID,
		&prod.SKU,
		&prod.Name,
		&prod.PurchasePriceIDR,
		&prod.SellingPriceIDR,
		&prod.BaseUnit,
		&prod.MinimumStock,
		&prod.IsActive,
		&prod.CreatedAt,
		&prod.UpdatedAt,
		&imgURL,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return Product{}, ErrProductNotFound
	}
	if err != nil {
		return Product{}, fmt.Errorf("get product by id: %w", err)
	}
	if catID.Valid {
		val := catID.String
		prod.CategoryID = &val
	}
	if imgURL != "" {
		prod.ImageURL = &imgURL
	}
	return prod, nil
}

func (p *PostgresRepository) Update(ctx context.Context, id string, req UpdateProductRequest) (Product, error) {
	tenantID := tenantcontext.FromContext(ctx)
	query := `
		UPDATE products
		SET category_id = $3, sku = $4, name = $5, purchase_price_idr = $6, selling_price_idr = $7,
		    base_unit = $8, minimum_stock = $9, image_url = $10,
		    is_active = COALESCE($11, is_active), updated_at = NOW()
		WHERE tenant_id = $1 AND id = $2
		RETURNING id, tenant_id, category_id, sku, name, purchase_price_idr, selling_price_idr, base_unit, minimum_stock, is_active, created_at, updated_at, COALESCE(image_url, '')
	`
	var catID *string
	if req.CategoryID != nil && *req.CategoryID != "" {
		catID = req.CategoryID
	}

	var prod Product
	var catIDNull sql.NullString
	var imgURL string
	err := p.db.QueryRowContext(
		ctx,
		query,
		tenantID,
		id,
		catID,
		req.SKU,
		req.Name,
		req.PurchasePriceIDR,
		req.SellingPriceIDR,
		req.BaseUnit,
		req.MinimumStock,
		req.ImageURL,
		req.IsActive,
	).Scan(
		&prod.ID,
		&prod.TenantID,
		&catIDNull,
		&prod.SKU,
		&prod.Name,
		&prod.PurchasePriceIDR,
		&prod.SellingPriceIDR,
		&prod.BaseUnit,
		&prod.MinimumStock,
		&prod.IsActive,
		&prod.CreatedAt,
		&prod.UpdatedAt,
		&imgURL,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return Product{}, ErrProductNotFound
	}
	if err != nil {
		if strings.Contains(err.Error(), "unique constraint") || strings.Contains(err.Error(), "duplicate key") {
			return Product{}, ErrSKUExists
		}
		return Product{}, fmt.Errorf("update product: %w", err)
	}
	if catIDNull.Valid {
		val := catIDNull.String
		prod.CategoryID = &val
	}
	if imgURL != "" {
		prod.ImageURL = &imgURL
	}
	return prod, nil
}

func (p *PostgresRepository) Delete(ctx context.Context, id string) error {
	tenantID := tenantcontext.FromContext(ctx)
	query := `
		UPDATE products
		SET is_active = FALSE, updated_at = NOW()
		WHERE tenant_id = $1 AND id = $2 AND is_active = TRUE
	`
	res, err := p.db.ExecContext(ctx, query, tenantID, id)
	if err != nil {
		return fmt.Errorf("delete product: %w", err)
	}
	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("check delete rows affected: %w", err)
	}
	if rowsAffected == 0 {
		return ErrProductNotFound
	}
	return nil
}

// Handler handles HTTP requests for product catalog.
type Handler struct {
	repo Repository
}

func NewHandler(repo Repository) *Handler {
	return &Handler{repo: repo}
}

// List handles GET /api/v1/products
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	products, err := h.repo.List(r.Context())
	if err != nil {
		envelope.WriteError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to retrieve products.", nil)
		return
	}
	if products == nil {
		products = make([]Product, 0)
	}
	envelope.Write(w, r, http.StatusOK, products)
}

// Create handles POST /api/v1/products
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var req CreateProductRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		envelope.WriteError(w, r, http.StatusBadRequest, "INVALID_REQUEST", "Request payload must be valid JSON.", nil)
		return
	}

	req.SKU = strings.TrimSpace(req.SKU)
	req.Name = strings.TrimSpace(req.Name)
	req.BaseUnit = strings.TrimSpace(req.BaseUnit)

	details := make(map[string]string)
	if req.SKU == "" {
		details["sku"] = "SKU wajib diisi."
	}
	if req.Name == "" {
		details["name"] = "Nama produk wajib diisi."
	}
	if req.BaseUnit == "" {
		details["base_unit"] = "Satuan dasar wajib diisi."
	}
	if req.PurchasePriceIDR < 0 {
		details["purchase_price_idr"] = "Harga beli tidak boleh negatif."
	}
	if req.SellingPriceIDR < 0 {
		details["selling_price_idr"] = "Harga jual tidak boleh negatif."
	}
	if req.MinimumStock < 0 {
		details["minimum_stock"] = "Stok minimal tidak boleh negatif."
	}

	if len(details) > 0 {
		envelope.WriteError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "Data produk tidak valid.", details)
		return
	}

	created, err := h.repo.Create(r.Context(), req)
	if err != nil {
		if errors.Is(err, ErrSKUExists) {
			envelope.WriteError(w, r, http.StatusConflict, "PRODUCT_SKU_EXISTS", "Produk dengan SKU tersebut sudah terdaftar.", map[string]string{"sku": req.SKU})
			return
		}
		envelope.WriteError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Gagal menyimpan produk.", nil)
		return
	}

	envelope.Write(w, r, http.StatusCreated, created)
}

// Update handles PUT /api/v1/products/{id}
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		envelope.WriteError(w, r, http.StatusBadRequest, "INVALID_REQUEST", "ID produk wajib disertakan.", nil)
		return
	}

	var req UpdateProductRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		envelope.WriteError(w, r, http.StatusBadRequest, "INVALID_REQUEST", "Request payload must be valid JSON.", nil)
		return
	}

	req.SKU = strings.TrimSpace(req.SKU)
	req.Name = strings.TrimSpace(req.Name)
	req.BaseUnit = strings.TrimSpace(req.BaseUnit)

	details := make(map[string]string)
	if req.SKU == "" {
		details["sku"] = "SKU wajib diisi."
	}
	if req.Name == "" {
		details["name"] = "Nama produk wajib diisi."
	}
	if req.BaseUnit == "" {
		details["base_unit"] = "Satuan dasar wajib diisi."
	}
	if req.PurchasePriceIDR < 0 {
		details["purchase_price_idr"] = "Harga beli tidak boleh negatif."
	}
	if req.SellingPriceIDR < 0 {
		details["selling_price_idr"] = "Harga jual tidak boleh negatif."
	}
	if req.MinimumStock < 0 {
		details["minimum_stock"] = "Stok minimal tidak boleh negatif."
	}

	if len(details) > 0 {
		envelope.WriteError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "Data produk tidak valid.", details)
		return
	}

	updated, err := h.repo.Update(r.Context(), id, req)
	if err != nil {
		if errors.Is(err, ErrProductNotFound) {
			envelope.WriteError(w, r, http.StatusNotFound, "PRODUCT_NOT_FOUND", "Produk tidak ditemukan.", nil)
			return
		}
		if errors.Is(err, ErrSKUExists) {
			envelope.WriteError(w, r, http.StatusConflict, "PRODUCT_SKU_EXISTS", "Produk dengan SKU tersebut sudah terdaftar.", map[string]string{"sku": req.SKU})
			return
		}
		envelope.WriteError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Gagal memperbarui produk.", nil)
		return
	}

	envelope.Write(w, r, http.StatusOK, updated)
}

// Delete handles DELETE /api/v1/products/{id}
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		envelope.WriteError(w, r, http.StatusBadRequest, "INVALID_REQUEST", "ID produk wajib disertakan.", nil)
		return
	}

	if err := h.repo.Delete(r.Context(), id); err != nil {
		if errors.Is(err, ErrProductNotFound) {
			envelope.WriteError(w, r, http.StatusNotFound, "PRODUCT_NOT_FOUND", "Produk tidak ditemukan.", nil)
			return
		}
		envelope.WriteError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Gagal menghapus produk.", nil)
		return
	}

	envelope.Write(w, r, http.StatusOK, map[string]string{"message": "Produk berhasil dihapus."})
}

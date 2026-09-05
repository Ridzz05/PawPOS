package inventory

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

	"github.com/muhri/ai-operational-pos/apps/api/internal/platform/envelope"
	"github.com/muhri/ai-operational-pos/apps/api/internal/platform/tenantcontext"
)

type InventoryLocation struct {
	ID        string    `json:"id"`
	TenantID  string    `json:"tenant_id"`
	Name      string    `json:"name"`
	Code      string    `json:"code"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
}

type ProductStockSummary struct {
	TenantID     string    `json:"tenant_id"`
	ProductID    string    `json:"product_id"`
	SKU          string    `json:"sku"`
	ProductName  string    `json:"product_name"`
	BaseUnit     string    `json:"base_unit"`
	MinimumStock float64   `json:"minimum_stock"`
	LocationID   string    `json:"location_id"`
	LocationName string    `json:"location_name"`
	Quantity     float64   `json:"quantity"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type StockMovement struct {
	ID            string    `json:"id"`
	TenantID      string    `json:"tenant_id"`
	ProductID     string    `json:"product_id"`
	LocationID    string    `json:"location_id"`
	QuantityDelta float64   `json:"quantity_delta"`
	MovementType  string    `json:"movement_type"`
	ReferenceType *string   `json:"reference_type,omitempty"`
	ReferenceID   *string   `json:"reference_id,omitempty"`
	Reason        *string   `json:"reason,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
}

type StockMovementItem struct {
	ID            string    `json:"id"`
	TenantID      string    `json:"tenant_id"`
	ProductID     string    `json:"product_id"`
	ProductName   string    `json:"product_name"`
	SKU           string    `json:"sku"`
	LocationID    string    `json:"location_id"`
	LocationName  string    `json:"location_name"`
	QuantityDelta float64   `json:"quantity_delta"`
	MovementType  string    `json:"movement_type"`
	ReferenceType *string   `json:"reference_type,omitempty"`
	ReferenceID   *string   `json:"reference_id,omitempty"`
	Reason        *string   `json:"reason,omitempty"`
	CreatedAt     time.Time `json:"created_at"`
}

type MovementFilter struct {
	ProductID    *string
	LocationID   *string
	MovementType *string
}

type RecordMovementRequest struct {
	ProductID     string  `json:"product_id"`
	LocationID    string  `json:"location_id"`
	QuantityDelta float64 `json:"quantity_delta"`
	MovementType  string  `json:"movement_type"`
	Reason        *string `json:"reason,omitempty"`
	ReferenceType *string `json:"reference_type,omitempty"`
}

var (
	ErrLocationNotFound  = errors.New("inventory location not found")
	ErrProductNotFound   = errors.New("product not found")
	ErrInsufficientStock = errors.New("insufficient stock for requested operation")
	ErrInvalidDelta      = errors.New("quantity delta cannot be zero")
	ErrInvalidType       = errors.New("invalid movement type")
)

var validMovementTypes = map[string]bool{
	"opening":          true,
	"purchase_receipt": true,
	"sale":             true,
	"adjustment":       true,
	"return":           true,
}

type Repository interface {
	ListLocations(ctx context.Context) ([]InventoryLocation, error)
	GetStockBalances(ctx context.Context, locationID *string) ([]ProductStockSummary, error)
	RecordMovement(ctx context.Context, req RecordMovementRequest) (StockMovement, error)
	ListMovements(ctx context.Context, filter MovementFilter) ([]StockMovementItem, error)
}

// MemoryRepository provides thread-safe in-memory stock tracking for tests and offline execution.
type MemoryRepository struct {
	mu        sync.RWMutex
	locations []InventoryLocation
	balances  map[string]float64 // key: tenantID:productID:locationID
	movements []StockMovement
}

func NewMemoryRepository() *MemoryRepository {
	now := time.Now().UTC()
	return &MemoryRepository{
		locations: []InventoryLocation{
			{
				ID:        "loc-main",
				TenantID:  tenantcontext.DefaultTenantID,
				Name:      "Toko Utama",
				Code:      "MAIN",
				IsActive:  true,
				CreatedAt: now,
			},
		},
		balances:  make(map[string]float64),
		movements: make([]StockMovement, 0),
	}
}

func (m *MemoryRepository) ListLocations(ctx context.Context) ([]InventoryLocation, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	tenantID := tenantcontext.FromContext(ctx)
	res := make([]InventoryLocation, 0, len(m.locations))
	for _, l := range m.locations {
		if (l.TenantID == tenantID || (tenantID == tenantcontext.DefaultTenantID && l.TenantID == tenantcontext.DefaultTenantID)) && l.IsActive {
			res = append(res, l)
		}
	}
	if len(res) == 0 {
		loc := InventoryLocation{
			ID:        "loc-main-" + tenantID,
			TenantID:  tenantID,
			Name:      "Toko Utama",
			Code:      "MAIN",
			IsActive:  true,
			CreatedAt: time.Now().UTC(),
		}
		m.locations = append(m.locations, loc)
		res = append(res, loc)
	}
	return res, nil
}

func (m *MemoryRepository) GetStockBalances(ctx context.Context, locationID *string) ([]ProductStockSummary, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	tenantID := tenantcontext.FromContext(ctx)
	now := time.Now().UTC()
	result := make([]ProductStockSummary, 0, len(m.balances))
	for key, qty := range m.balances {
		parts := strings.Split(key, ":")
		if len(parts) != 3 {
			continue
		}
		tID, pID, lID := parts[0], parts[1], parts[2]
		if tID != tenantID {
			continue
		}
		if locationID != nil && *locationID != "" && *locationID != lID {
			continue
		}
		locName := "Toko Utama"
		for _, l := range m.locations {
			if l.ID == lID {
				locName = l.Name
				break
			}
		}
		result = append(result, ProductStockSummary{
			TenantID:     tenantID,
			ProductID:    pID,
			SKU:          "SKU-" + pID,
			ProductName:  "Produk " + pID,
			BaseUnit:     "pcs",
			MinimumStock: 5,
			LocationID:   lID,
			LocationName: locName,
			Quantity:     qty,
			UpdatedAt:    now,
		})
	}
	return result, nil
}

func (m *MemoryRepository) RecordMovement(ctx context.Context, req RecordMovementRequest) (StockMovement, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if req.QuantityDelta == 0 {
		return StockMovement{}, ErrInvalidDelta
	}
	if !validMovementTypes[req.MovementType] {
		return StockMovement{}, ErrInvalidType
	}

	tenantID := tenantcontext.FromContext(ctx)
	key := fmt.Sprintf("%s:%s:%s", tenantID, req.ProductID, req.LocationID)
	current := m.balances[key]
	newQty := current + req.QuantityDelta
	if newQty < 0 {
		return StockMovement{}, ErrInsufficientStock
	}

	m.balances[key] = newQty
	now := time.Now().UTC()
	movement := StockMovement{
		ID:            fmt.Sprintf("mov-%d", len(m.movements)+1),
		TenantID:      tenantID,
		ProductID:     req.ProductID,
		LocationID:    req.LocationID,
		QuantityDelta: req.QuantityDelta,
		MovementType:  req.MovementType,
		ReferenceType: req.ReferenceType,
		Reason:        req.Reason,
		CreatedAt:     now,
	}
	m.movements = append(m.movements, movement)
	return movement, nil
}

func (m *MemoryRepository) ListMovements(ctx context.Context, filter MovementFilter) ([]StockMovementItem, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	tenantID := tenantcontext.FromContext(ctx)
	res := make([]StockMovementItem, 0, len(m.movements))
	for i := len(m.movements) - 1; i >= 0; i-- {
		mov := m.movements[i]
		if mov.TenantID != tenantID && !(tenantID == tenantcontext.DefaultTenantID && mov.TenantID == tenantcontext.DefaultTenantID) {
			continue
		}
		if filter.ProductID != nil && *filter.ProductID != "" && mov.ProductID != *filter.ProductID {
			continue
		}
		if filter.LocationID != nil && *filter.LocationID != "" && mov.LocationID != *filter.LocationID {
			continue
		}
		if filter.MovementType != nil && *filter.MovementType != "" && mov.MovementType != *filter.MovementType {
			continue
		}

		locName := "Toko Utama"
		for _, l := range m.locations {
			if l.ID == mov.LocationID {
				locName = l.Name
				break
			}
		}

		res = append(res, StockMovementItem{
			ID:            mov.ID,
			TenantID:      mov.TenantID,
			ProductID:     mov.ProductID,
			ProductName:   "Produk " + mov.ProductID,
			SKU:           "SKU-" + mov.ProductID,
			LocationID:    mov.LocationID,
			LocationName:  locName,
			QuantityDelta: mov.QuantityDelta,
			MovementType:  mov.MovementType,
			ReferenceType: mov.ReferenceType,
			ReferenceID:   mov.ReferenceID,
			Reason:        mov.Reason,
			CreatedAt:     mov.CreatedAt,
		})
	}
	return res, nil
}

// PostgresRepository persists stock movements and balances in PostgreSQL.
type PostgresRepository struct {
	db *sql.DB
}

func NewPostgresRepository(db *sql.DB) *PostgresRepository {
	return &PostgresRepository{db: db}
}

func (p *PostgresRepository) ListLocations(ctx context.Context) ([]InventoryLocation, error) {
	tenantID := tenantcontext.FromContext(ctx)
	query := `
		SELECT id, tenant_id, name, code, is_active, created_at
		FROM inventory_locations
		WHERE tenant_id = $1 AND is_active = TRUE
		ORDER BY name ASC
	`
	rows, err := p.db.QueryContext(ctx, query, tenantID)
	if err != nil {
		return nil, fmt.Errorf("query locations: %w", err)
	}
	defer rows.Close()

	var locations []InventoryLocation
	for rows.Next() {
		var loc InventoryLocation
		if err := rows.Scan(&loc.ID, &loc.TenantID, &loc.Name, &loc.Code, &loc.IsActive, &loc.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan location: %w", err)
		}
		locations = append(locations, loc)
	}
	if locations == nil {
		locations = make([]InventoryLocation, 0)
	}
	return locations, rows.Err()
}

func (p *PostgresRepository) GetStockBalances(ctx context.Context, locationID *string) ([]ProductStockSummary, error) {
	tenantID := tenantcontext.FromContext(ctx)
	query := `
		SELECT p.id, p.sku, p.name, p.base_unit, p.minimum_stock,
		       l.id, l.name, COALESCE(ps.quantity, 0), COALESCE(ps.updated_at, p.updated_at)
		FROM products p
		CROSS JOIN inventory_locations l
		LEFT JOIN product_stocks ps ON ps.product_id = p.id AND ps.location_id = l.id AND ps.tenant_id = $1
		WHERE p.tenant_id = $1 AND l.tenant_id = $1 AND p.is_active = TRUE AND l.is_active = TRUE
	`
	args := []interface{}{tenantID}
	if locationID != nil && *locationID != "" {
		query += " AND l.id = $2"
		args = append(args, *locationID)
	}
	query += " ORDER BY p.name ASC, l.name ASC"

	rows, err := p.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query stock balances: %w", err)
	}
	defer rows.Close()

	var summaries []ProductStockSummary
	for rows.Next() {
		var s ProductStockSummary
		s.TenantID = tenantID
		if err := rows.Scan(
			&s.ProductID,
			&s.SKU,
			&s.ProductName,
			&s.BaseUnit,
			&s.MinimumStock,
			&s.LocationID,
			&s.LocationName,
			&s.Quantity,
			&s.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan stock summary: %w", err)
		}
		summaries = append(summaries, s)
	}
	if summaries == nil {
		summaries = make([]ProductStockSummary, 0)
	}
	return summaries, rows.Err()
}

func (p *PostgresRepository) RecordMovement(ctx context.Context, req RecordMovementRequest) (StockMovement, error) {
	if req.QuantityDelta == 0 {
		return StockMovement{}, ErrInvalidDelta
	}
	if !validMovementTypes[req.MovementType] {
		return StockMovement{}, ErrInvalidType
	}

	tenantID := tenantcontext.FromContext(ctx)
	tx, err := p.db.BeginTx(ctx, nil)
	if err != nil {
		return StockMovement{}, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	// 1. Insert into append-only stock_movements
	insertMovement := `
		INSERT INTO stock_movements (tenant_id, product_id, location_id, quantity_delta, movement_type, reference_type, reason)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, tenant_id, product_id, location_id, quantity_delta, movement_type, reference_type, reference_id, reason, created_at
	`
	var mov StockMovement
	var refType, reason sql.NullString
	var refID sql.NullString
	err = tx.QueryRowContext(
		ctx,
		insertMovement,
		tenantID,
		req.ProductID,
		req.LocationID,
		req.QuantityDelta,
		req.MovementType,
		req.ReferenceType,
		req.Reason,
	).Scan(
		&mov.ID,
		&mov.TenantID,
		&mov.ProductID,
		&mov.LocationID,
		&mov.QuantityDelta,
		&mov.MovementType,
		&refType,
		&refID,
		&reason,
		&mov.CreatedAt,
	)
	if err != nil {
		if strings.Contains(err.Error(), "foreign key") {
			return StockMovement{}, ErrProductNotFound
		}
		return StockMovement{}, fmt.Errorf("insert stock movement: %w", err)
	}
	if refType.Valid {
		val := refType.String
		mov.ReferenceType = &val
	}
	if refID.Valid {
		val := refID.String
		mov.ReferenceID = &val
	}
	if reason.Valid {
		val := reason.String
		mov.Reason = &val
	}

	// 2. Upsert into product_stocks
	upsertStock := `
		INSERT INTO product_stocks (tenant_id, product_id, location_id, quantity, updated_at)
		VALUES ($1, $2, $3, $4, now())
		ON CONFLICT (product_id, location_id)
		DO UPDATE SET quantity = product_stocks.quantity + EXCLUDED.quantity, updated_at = now()
		RETURNING quantity
	`
	var updatedQty float64
	err = tx.QueryRowContext(ctx, upsertStock, tenantID, req.ProductID, req.LocationID, req.QuantityDelta).Scan(&updatedQty)
	if err != nil {
		if strings.Contains(err.Error(), "check constraint") || strings.Contains(err.Error(), "quantity >= 0") {
			return StockMovement{}, ErrInsufficientStock
		}
		return StockMovement{}, fmt.Errorf("update product stocks: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return StockMovement{}, fmt.Errorf("commit tx: %w", err)
	}
	return mov, nil
}

func (p *PostgresRepository) ListMovements(ctx context.Context, filter MovementFilter) ([]StockMovementItem, error) {
	tenantID := tenantcontext.FromContext(ctx)
	query := `
		SELECT sm.id, sm.tenant_id, sm.product_id, COALESCE(p.name, ''), COALESCE(p.sku, ''),
		       sm.location_id, COALESCE(l.name, ''), sm.quantity_delta, sm.movement_type,
		       sm.reference_type, sm.reference_id, sm.reason, sm.created_at
		FROM stock_movements sm
		LEFT JOIN products p ON p.id = sm.product_id
		LEFT JOIN inventory_locations l ON l.id = sm.location_id
		WHERE sm.tenant_id = $1
	`
	args := []interface{}{tenantID}
	argIdx := 2

	if filter.ProductID != nil && *filter.ProductID != "" {
		query += fmt.Sprintf(" AND sm.product_id = $%d", argIdx)
		args = append(args, *filter.ProductID)
		argIdx++
	}
	if filter.LocationID != nil && *filter.LocationID != "" {
		query += fmt.Sprintf(" AND sm.location_id = $%d", argIdx)
		args = append(args, *filter.LocationID)
		argIdx++
	}
	if filter.MovementType != nil && *filter.MovementType != "" {
		query += fmt.Sprintf(" AND sm.movement_type = $%d", argIdx)
		args = append(args, *filter.MovementType)
		argIdx++
	}

	query += " ORDER BY sm.created_at DESC"

	rows, err := p.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query movements: %w", err)
	}
	defer rows.Close()

	var items []StockMovementItem
	for rows.Next() {
		var it StockMovementItem
		var refType, reason sql.NullString
		var refID sql.NullString
		if err := rows.Scan(
			&it.ID,
			&it.TenantID,
			&it.ProductID,
			&it.ProductName,
			&it.SKU,
			&it.LocationID,
			&it.LocationName,
			&it.QuantityDelta,
			&it.MovementType,
			&refType,
			&refID,
			&reason,
			&it.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan movement: %w", err)
		}
		if refType.Valid {
			val := refType.String
			it.ReferenceType = &val
		}
		if refID.Valid {
			val := refID.String
			it.ReferenceID = &val
		}
		if reason.Valid {
			val := reason.String
			it.Reason = &val
		}
		items = append(items, it)
	}
	if items == nil {
		items = make([]StockMovementItem, 0)
	}
	return items, rows.Err()
}

// Handler handles HTTP requests for inventory operations.
type Handler struct {
	repo Repository
}

func NewHandler(repo Repository) *Handler {
	return &Handler{repo: repo}
}

// ListStocks handles GET /api/v1/inventory/stocks
func (h *Handler) ListStocks(w http.ResponseWriter, r *http.Request) {
	var locID *string
	if val := r.URL.Query().Get("location_id"); val != "" {
		locID = &val
	}

	summaries, err := h.repo.GetStockBalances(r.Context(), locID)
	if err != nil {
		envelope.WriteError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Gagal memuat saldo stok.", nil)
		return
	}
	envelope.Write(w, r, http.StatusOK, summaries)
}

// ListLocations handles GET /api/v1/inventory/locations
func (h *Handler) ListLocations(w http.ResponseWriter, r *http.Request) {
	locations, err := h.repo.ListLocations(r.Context())
	if err != nil {
		envelope.WriteError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Gagal memuat lokasi inventori.", nil)
		return
	}
	envelope.Write(w, r, http.StatusOK, locations)
}

// RecordMovement handles POST /api/v1/inventory/movements
func (h *Handler) RecordMovement(w http.ResponseWriter, r *http.Request) {
	var req RecordMovementRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		envelope.WriteError(w, r, http.StatusBadRequest, "INVALID_REQUEST", "Format payload harus JSON valid.", nil)
		return
	}

	req.ProductID = strings.TrimSpace(req.ProductID)
	req.LocationID = strings.TrimSpace(req.LocationID)
	req.MovementType = strings.TrimSpace(req.MovementType)

	details := make(map[string]string)
	if req.ProductID == "" {
		details["product_id"] = "ID produk wajib diisi."
	}
	if req.LocationID == "" {
		details["location_id"] = "ID lokasi inventori wajib diisi."
	}
	if req.QuantityDelta == 0 {
		details["quantity_delta"] = "Perubahan jumlah stok (delta) tidak boleh nol."
	}
	if !validMovementTypes[req.MovementType] {
		details["movement_type"] = "Tipe pergerakan tidak valid. Gunakan: opening, purchase_receipt, sale, adjustment, return."
	}

	if len(details) > 0 {
		envelope.WriteError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "Data pergerakan stok tidak valid.", details)
		return
	}

	mov, err := h.repo.RecordMovement(r.Context(), req)
	if err != nil {
		if errors.Is(err, ErrInsufficientStock) {
			envelope.WriteError(w, r, http.StatusBadRequest, "INSUFFICIENT_STOCK", "Stok tidak mencukupi untuk pengurangan ini.", nil)
			return
		}
		if errors.Is(err, ErrInvalidDelta) {
			envelope.WriteError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "Perubahan stok tidak boleh nol.", nil)
			return
		}
		if errors.Is(err, ErrInvalidType) {
			envelope.WriteError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "Tipe pergerakan stok tidak valid.", nil)
			return
		}
		envelope.WriteError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Gagal mencatat pergerakan stok.", nil)
		return
	}

	envelope.Write(w, r, http.StatusCreated, mov)
}

// ListMovements handles GET /api/v1/inventory/movements
func (h *Handler) ListMovements(w http.ResponseWriter, r *http.Request) {
	var filter MovementFilter
	if val := r.URL.Query().Get("product_id"); val != "" {
		filter.ProductID = &val
	}
	if val := r.URL.Query().Get("location_id"); val != "" {
		filter.LocationID = &val
	}
	if val := r.URL.Query().Get("movement_type"); val != "" {
		filter.MovementType = &val
	}

	movements, err := h.repo.ListMovements(r.Context(), filter)
	if err != nil {
		envelope.WriteError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Gagal memuat buku mutasi pergerakan stok.", nil)
		return
	}
	envelope.Write(w, r, http.StatusOK, movements)
}

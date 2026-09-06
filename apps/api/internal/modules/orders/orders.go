package orders

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
	"github.com/muhri/ai-operational-pos/apps/api/internal/modules/inventory"
	"github.com/muhri/ai-operational-pos/apps/api/internal/platform/envelope"
	"github.com/muhri/ai-operational-pos/apps/api/internal/platform/tenantcontext"
)

type Order struct {
	ID               string    `json:"id"`
	TenantID         string    `json:"tenant_id"`
	OrderNumber      string    `json:"order_number"`
	LocationID       string    `json:"location_id"`
	Status           string    `json:"status"`
	PaymentMethod    string    `json:"payment_method"`
	SubtotalIDR      int64     `json:"subtotal_idr"`
	TaxIDR           int64     `json:"tax_idr"`
	DiscountIDR      int64     `json:"discount_idr"`
	TotalIDR         int64     `json:"total_idr"`
	PaidAmountIDR    int64     `json:"paid_amount_idr"`
	ChangeAmountIDR  int64     `json:"change_amount_idr"`
	CashAmountIDR    int64     `json:"cash_amount_idr"`
	NonCashAmountIDR int64     `json:"non_cash_amount_idr"`
	Notes            string    `json:"notes"`
	CreatedAt        time.Time `json:"created_at"`
}

type OrderItem struct {
	ID           string  `json:"id"`
	OrderID      string  `json:"order_id"`
	ProductID    string  `json:"product_id"`
	ProductName  string  `json:"product_name"`
	SKU          string  `json:"sku"`
	UnitPriceIDR int64   `json:"unit_price_idr"`
	Quantity     float64 `json:"quantity"`
	SubtotalIDR  int64   `json:"subtotal_idr"`
	ItemKind     string  `json:"item_kind"`
	ServiceID    *string `json:"service_id,omitempty"`
}

type OrderDetail struct {
	Order
	Items []OrderItem `json:"items"`
}

type CreateOrderItemRequest struct {
	ProductID    string  `json:"product_id"`
	ProductName  string  `json:"product_name"`
	SKU          string  `json:"sku"`
	UnitPriceIDR int64   `json:"unit_price_idr"`
	Quantity     float64 `json:"quantity"`
	ItemKind     string  `json:"item_kind,omitempty"`
	ServiceID    *string `json:"service_id,omitempty"`
}

type CreateOrderRequest struct {
	LocationID       string                   `json:"location_id"`
	PaymentMethod    string                   `json:"payment_method"`
	Items            []CreateOrderItemRequest `json:"items"`
	TaxIDR           *int64                   `json:"tax_idr,omitempty"`
	DiscountIDR      *int64                   `json:"discount_idr,omitempty"`
	PaidAmountIDR    int64                    `json:"paid_amount_idr"`
	CashAmountIDR    *int64                   `json:"cash_amount_idr,omitempty"`
	NonCashAmountIDR *int64                   `json:"non_cash_amount_idr,omitempty"`
	Notes            string                   `json:"notes"`
}

var (
	ErrOrderNotFound        = errors.New("order not found")
	ErrEmptyItems           = errors.New("order must contain at least one item")
	ErrInvalidLocation      = errors.New("location_id is required")
	ErrInvalidPaymentMethod = errors.New("invalid payment method, supported: cash, qris, debit_card, credit_card, split")
	ErrInsufficientPayment  = errors.New("paid amount must be greater than or equal to total amount")
	ErrInvalidSplitAmount   = errors.New("split payment requires valid cash_amount_idr and non_cash_amount_idr")
	ErrInsufficientStock    = errors.New("insufficient stock for order item")
	ErrInvalidItemQuantity  = errors.New("item quantity must be greater than zero")
	ErrInvalidItemPrice     = errors.New("item unit price cannot be negative")
	ErrInvalidItem          = errors.New("order item is invalid: barang needs product_id, jasa needs a name")
)

const (
	ItemKindBarang = "barang"
	ItemKindJasa   = "jasa"
)

// normalizeItemKind defaults empty kinds to barang and reports validity.
func normalizeItemKind(kind string) (string, bool) {
	k := strings.TrimSpace(kind)
	if k == "" {
		return ItemKindBarang, true
	}
	if k == ItemKindBarang || k == ItemKindJasa {
		return k, true
	}
	return k, false
}

var validPaymentMethods = map[string]bool{
	"cash":        true,
	"qris":        true,
	"debit_card":  true,
	"credit_card": true,
	"split":       true,
}

// SaleRecorder is an optional hook to record sales into active cashier shifts.
type SaleRecorder interface {
	RecordSale(ctx context.Context, tenantID string, paymentMethod string, totalIDR int64, cashAmountIDR int64, nonCashAmountIDR int64) error
}

type Repository interface {
	CreateOrder(ctx context.Context, req CreateOrderRequest) (OrderDetail, error)
	ListOrders(ctx context.Context, locationID *string) ([]Order, error)
	GetOrderByID(ctx context.Context, id string) (OrderDetail, error)
}

// MemoryRepository provides thread-safe in-memory order and checkout management.
type MemoryRepository struct {
	mu            sync.RWMutex
	orders        []Order
	orderItems    map[string][]OrderItem // keyed by orderID
	inventoryRepo inventory.Repository
	saleRecorder  SaleRecorder
	counter       int
}

func (m *MemoryRepository) SetSaleRecorder(sr SaleRecorder) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.saleRecorder = sr
}

func NewMemoryRepository(invRepo inventory.Repository) *MemoryRepository {
	if invRepo == nil {
		invRepo = inventory.NewMemoryRepository()
	}
	return &MemoryRepository{
		orders:        make([]Order, 0),
		orderItems:    make(map[string][]OrderItem),
		inventoryRepo: invRepo,
	}
}

func (m *MemoryRepository) CreateOrder(ctx context.Context, req CreateOrderRequest) (OrderDetail, error) {
	if err := validateCreateRequest(&req); err != nil {
		return OrderDetail{}, err
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	tenantID := tenantcontext.FromContext(ctx)

	// Calculate subtotal
	var subtotal int64
	for _, item := range req.Items {
		itemSubtotal := int64(float64(item.UnitPriceIDR) * item.Quantity)
		subtotal += itemSubtotal
	}

	var tax int64
	if req.TaxIDR != nil && *req.TaxIDR > 0 {
		tax = *req.TaxIDR
	}

	var discount int64
	if req.DiscountIDR != nil && *req.DiscountIDR > 0 {
		discount = *req.DiscountIDR
	}

	total := subtotal + tax - discount
	if total < 0 {
		total = 0
	}

	var cashRecorded int64
	var nonCashRecorded int64
	if req.PaymentMethod == "split" {
		cashTender := int64(0)
		if req.CashAmountIDR != nil {
			cashTender = *req.CashAmountIDR
		}
		nonCashTender := int64(0)
		if req.NonCashAmountIDR != nil {
			nonCashTender = *req.NonCashAmountIDR
		}
		if cashTender+nonCashTender < total {
			return OrderDetail{}, ErrInsufficientPayment
		}
		if nonCashTender >= total {
			nonCashRecorded = total
			cashRecorded = 0
		} else {
			nonCashRecorded = nonCashTender
			cashRecorded = total - nonCashTender
		}
		if req.PaidAmountIDR <= 0 {
			req.PaidAmountIDR = cashTender + nonCashTender
		}
	} else if req.PaymentMethod == "cash" {
		if req.PaidAmountIDR < total {
			return OrderDetail{}, ErrInsufficientPayment
		}
		cashRecorded = total
		nonCashRecorded = 0
	} else {
		if req.PaidAmountIDR <= 0 {
			req.PaidAmountIDR = total
		}
		cashRecorded = 0
		nonCashRecorded = total
	}

	m.counter++
	now := time.Now().UTC()
	orderID := fmt.Sprintf("ord-%06d", m.counter)
	orderNum := fmt.Sprintf("ORD-%s-%04d", now.Format("20060102"), m.counter)
	refType := "order"
	reason := fmt.Sprintf("Sale via POS order %s", orderNum)

	// Verify and record inventory deduction for stock items only.
	// Jasa lines carry no inventory and skip deduction entirely.
	for _, it := range req.Items {
		if it.ItemKind == ItemKindJasa {
			continue
		}
		movReq := inventory.RecordMovementRequest{
			ProductID:     it.ProductID,
			LocationID:    req.LocationID,
			QuantityDelta: -it.Quantity,
			MovementType:  "sale",
			ReferenceType: &refType,
			Reason:        &reason,
		}
		if _, err := m.inventoryRepo.RecordMovement(ctx, movReq); err != nil {
			if errors.Is(err, inventory.ErrInsufficientStock) {
				return OrderDetail{}, fmt.Errorf("%w: %s (%s)", ErrInsufficientStock, it.ProductName, it.SKU)
			}
			return OrderDetail{}, err
		}
	}

	change := req.PaidAmountIDR - total
	order := Order{
		ID:               orderID,
		TenantID:         tenantID,
		OrderNumber:      orderNum,
		LocationID:       req.LocationID,
		Status:           "completed",
		PaymentMethod:    req.PaymentMethod,
		SubtotalIDR:      subtotal,
		TaxIDR:           tax,
		DiscountIDR:      discount,
		TotalIDR:         total,
		PaidAmountIDR:    req.PaidAmountIDR,
		ChangeAmountIDR:  change,
		CashAmountIDR:    cashRecorded,
		NonCashAmountIDR: nonCashRecorded,
		Notes:            req.Notes,
		CreatedAt:        now,
	}

	items := make([]OrderItem, 0, len(req.Items))
	for idx, it := range req.Items {
		itemSubtotal := int64(float64(it.UnitPriceIDR) * it.Quantity)
		orderItem := OrderItem{
			ID:           fmt.Sprintf("item-%s-%d", orderID, idx+1),
			OrderID:      orderID,
			ProductID:    it.ProductID,
			ProductName:  it.ProductName,
			SKU:          it.SKU,
			UnitPriceIDR: it.UnitPriceIDR,
			Quantity:     it.Quantity,
			SubtotalIDR:  itemSubtotal,
			ItemKind:     it.ItemKind,
			ServiceID:    it.ServiceID,
		}
		items = append(items, orderItem)
	}

	m.orders = append([]Order{order}, m.orders...)
	m.orderItems[orderID] = items

	if m.saleRecorder != nil {
		_ = m.saleRecorder.RecordSale(ctx, tenantID, req.PaymentMethod, total, cashRecorded, nonCashRecorded)
	}

	return OrderDetail{
		Order: order,
		Items: items,
	}, nil
}

func (m *MemoryRepository) ListOrders(ctx context.Context, locationID *string) ([]Order, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	tenantID := tenantcontext.FromContext(ctx)
	result := make([]Order, 0, len(m.orders))
	for _, o := range m.orders {
		if o.TenantID != tenantID {
			continue
		}
		if locationID != nil && *locationID != "" && o.LocationID != *locationID {
			continue
		}
		result = append(result, o)
	}
	return result, nil
}

func (m *MemoryRepository) GetOrderByID(ctx context.Context, id string) (OrderDetail, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	tenantID := tenantcontext.FromContext(ctx)
	for _, o := range m.orders {
		if o.TenantID == tenantID && (o.ID == id || o.OrderNumber == id) {
			items := m.orderItems[o.ID]
			return OrderDetail{
				Order: o,
				Items: items,
			}, nil
		}
	}
	return OrderDetail{}, ErrOrderNotFound
}

// PostgresRepository persists orders and executes atomic stock deduction in PostgreSQL.
type PostgresRepository struct {
	db           *sql.DB
	saleRecorder SaleRecorder
}

func NewPostgresRepository(db *sql.DB) *PostgresRepository {
	return &PostgresRepository{db: db}
}

func (p *PostgresRepository) SetSaleRecorder(sr SaleRecorder) {
	p.saleRecorder = sr
}

func (p *PostgresRepository) CreateOrder(ctx context.Context, req CreateOrderRequest) (OrderDetail, error) {
	if err := validateCreateRequest(&req); err != nil {
		return OrderDetail{}, err
	}

	tenantID := tenantcontext.FromContext(ctx)

	// Calculate totals
	var subtotal int64
	for _, it := range req.Items {
		subtotal += int64(float64(it.UnitPriceIDR) * it.Quantity)
	}

	var tax int64
	if req.TaxIDR != nil && *req.TaxIDR > 0 {
		tax = *req.TaxIDR
	}

	var discount int64
	if req.DiscountIDR != nil && *req.DiscountIDR > 0 {
		discount = *req.DiscountIDR
	}

	total := subtotal + tax - discount
	if total < 0 {
		total = 0
	}

	var cashRecorded int64
	var nonCashRecorded int64
	if req.PaymentMethod == "split" {
		cashTender := int64(0)
		if req.CashAmountIDR != nil {
			cashTender = *req.CashAmountIDR
		}
		nonCashTender := int64(0)
		if req.NonCashAmountIDR != nil {
			nonCashTender = *req.NonCashAmountIDR
		}
		if cashTender+nonCashTender < total {
			return OrderDetail{}, ErrInsufficientPayment
		}
		if nonCashTender >= total {
			nonCashRecorded = total
			cashRecorded = 0
		} else {
			nonCashRecorded = nonCashTender
			cashRecorded = total - nonCashTender
		}
		if req.PaidAmountIDR <= 0 {
			req.PaidAmountIDR = cashTender + nonCashTender
		}
	} else if req.PaymentMethod == "cash" {
		if req.PaidAmountIDR < total {
			return OrderDetail{}, ErrInsufficientPayment
		}
		cashRecorded = total
		nonCashRecorded = 0
	} else {
		if req.PaidAmountIDR <= 0 {
			req.PaidAmountIDR = total
		}
		cashRecorded = 0
		nonCashRecorded = total
	}

	change := req.PaidAmountIDR - total

	tx, err := p.db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelReadCommitted})
	if err != nil {
		return OrderDetail{}, fmt.Errorf("begin tx failed: %w", err)
	}
	defer tx.Rollback()

	// 1. Lock and verify stock for stock items only (jasa skips deduction)
	for _, it := range req.Items {
		if it.ItemKind == ItemKindJasa {
			continue
		}
		var currentStock float64
		err := tx.QueryRowContext(ctx,
			`SELECT quantity FROM product_stocks WHERE tenant_id = $1 AND product_id = $2 AND location_id = $3 FOR UPDATE`,
			tenantID, it.ProductID, req.LocationID,
		).Scan(&currentStock)

		if errors.Is(err, sql.ErrNoRows) || currentStock < it.Quantity {
			return OrderDetail{}, fmt.Errorf("%w: %s (%s)", ErrInsufficientStock, it.ProductName, it.SKU)
		} else if err != nil {
			return OrderDetail{}, fmt.Errorf("lock stock query failed: %w", err)
		}
	}

	// 2. Insert order
	now := time.Now().UTC()
	orderNum := fmt.Sprintf("ORD-%s-%d", now.Format("20060102"), time.Now().UnixNano()%100000)

	var order Order
	err = tx.QueryRowContext(ctx,
		`INSERT INTO orders (tenant_id, order_number, location_id, status, payment_method, subtotal_idr, tax_idr, discount_idr, total_idr, paid_amount_idr, change_amount_idr, cash_amount_idr, non_cash_amount_idr, notes, created_at)
		VALUES ($1, $2, $3, 'completed', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		RETURNING id, tenant_id, order_number, location_id, status, payment_method, subtotal_idr, tax_idr, discount_idr, total_idr, paid_amount_idr, change_amount_idr, cash_amount_idr, non_cash_amount_idr, notes, created_at`,
		tenantID, orderNum, req.LocationID, req.PaymentMethod, subtotal, tax, discount, total, req.PaidAmountIDR, change, cashRecorded, nonCashRecorded, req.Notes, now,
	).Scan(
		&order.ID, &order.TenantID, &order.OrderNumber, &order.LocationID, &order.Status, &order.PaymentMethod,
		&order.SubtotalIDR, &order.TaxIDR, &order.DiscountIDR, &order.TotalIDR,
		&order.PaidAmountIDR, &order.ChangeAmountIDR, &order.CashAmountIDR, &order.NonCashAmountIDR, &order.Notes, &order.CreatedAt,
	)
	if err != nil {
		return OrderDetail{}, fmt.Errorf("insert order failed: %w", err)
	}

	// 3. Insert items, deduct stock, and append stock movement
	items := make([]OrderItem, 0, len(req.Items))
	refType := "order"
	reason := fmt.Sprintf("Sale via POS order %s", order.OrderNumber)

	for _, it := range req.Items {
		itemSubtotal := int64(float64(it.UnitPriceIDR) * it.Quantity)
		var item OrderItem
		var productID, serviceID any
		if it.ProductID != "" {
			productID = it.ProductID
		}
		if it.ServiceID != nil && *it.ServiceID != "" {
			serviceID = *it.ServiceID
		}
		var gotProductID, gotServiceID sql.NullString
		err := tx.QueryRowContext(ctx,
			`INSERT INTO order_items (order_id, product_id, product_name, sku, unit_price_idr, quantity, subtotal_idr, item_kind, service_id)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
			RETURNING id, order_id, product_id, product_name, sku, unit_price_idr, quantity, subtotal_idr, item_kind, service_id`,
			order.ID, productID, it.ProductName, it.SKU, it.UnitPriceIDR, it.Quantity, itemSubtotal, it.ItemKind, serviceID,
		).Scan(
			&item.ID, &item.OrderID, &gotProductID, &item.ProductName,
			&item.SKU, &item.UnitPriceIDR, &item.Quantity, &item.SubtotalIDR, &item.ItemKind, &gotServiceID,
		)
		if err != nil {
			return OrderDetail{}, fmt.Errorf("insert order_item failed: %w", err)
		}
		if gotProductID.Valid {
			item.ProductID = gotProductID.String
		}
		if gotServiceID.Valid {
			svc := gotServiceID.String
			item.ServiceID = &svc
		}
		items = append(items, item)

		if it.ItemKind == ItemKindJasa {
			continue
		}

		// Deduct stock balance
		_, err = tx.ExecContext(ctx,
			`UPDATE product_stocks SET quantity = quantity - $1, updated_at = now() WHERE tenant_id = $2 AND product_id = $3 AND location_id = $4`,
			it.Quantity, tenantID, it.ProductID, req.LocationID,
		)
		if err != nil {
			return OrderDetail{}, fmt.Errorf("update product_stocks failed: %w", err)
		}

		// Record immutable stock movement
		_, err = tx.ExecContext(ctx,
			`INSERT INTO stock_movements (tenant_id, product_id, location_id, quantity_delta, movement_type, reference_type, reference_id, reason, created_at)
			VALUES ($1, $2, $3, $4, 'sale', $5, $6, $7, now())`,
			tenantID, it.ProductID, req.LocationID, -it.Quantity, refType, order.ID, reason,
		)
		if err != nil {
			return OrderDetail{}, fmt.Errorf("insert stock_movement failed: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return OrderDetail{}, fmt.Errorf("tx commit failed: %w", err)
	}

	if p.saleRecorder != nil {
		_ = p.saleRecorder.RecordSale(ctx, tenantID, req.PaymentMethod, total, cashRecorded, nonCashRecorded)
	}

	return OrderDetail{
		Order: order,
		Items: items,
	}, nil
}

func (p *PostgresRepository) ListOrders(ctx context.Context, locationID *string) ([]Order, error) {
	tenantID := tenantcontext.FromContext(ctx)
	query := `SELECT id, tenant_id, order_number, location_id, status, payment_method, subtotal_idr, tax_idr, discount_idr, total_idr, paid_amount_idr, change_amount_idr, cash_amount_idr, non_cash_amount_idr, notes, created_at
		FROM orders WHERE tenant_id = $1`
	args := []any{tenantID}
	if locationID != nil && *locationID != "" {
		query += ` AND location_id = $2`
		args = append(args, *locationID)
	}
	query += ` ORDER BY created_at DESC LIMIT 100`

	rows, err := p.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query orders failed: %w", err)
	}
	defer rows.Close()

	results := make([]Order, 0)
	for rows.Next() {
		var o Order
		if err := rows.Scan(
			&o.ID, &o.TenantID, &o.OrderNumber, &o.LocationID, &o.Status, &o.PaymentMethod,
			&o.SubtotalIDR, &o.TaxIDR, &o.DiscountIDR, &o.TotalIDR,
			&o.PaidAmountIDR, &o.ChangeAmountIDR, &o.CashAmountIDR, &o.NonCashAmountIDR, &o.Notes, &o.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan order failed: %w", err)
		}
		results = append(results, o)
	}
	return results, rows.Err()
}

func (p *PostgresRepository) GetOrderByID(ctx context.Context, id string) (OrderDetail, error) {
	tenantID := tenantcontext.FromContext(ctx)
	var o Order
	err := p.db.QueryRowContext(ctx,
		`SELECT id, tenant_id, order_number, location_id, status, payment_method, subtotal_idr, tax_idr, discount_idr, total_idr, paid_amount_idr, change_amount_idr, cash_amount_idr, non_cash_amount_idr, notes, created_at
		FROM orders WHERE tenant_id = $1 AND (id::text = $2 OR order_number = $2)`,
		tenantID, id,
	).Scan(
		&o.ID, &o.TenantID, &o.OrderNumber, &o.LocationID, &o.Status, &o.PaymentMethod,
		&o.SubtotalIDR, &o.TaxIDR, &o.DiscountIDR, &o.TotalIDR,
		&o.PaidAmountIDR, &o.ChangeAmountIDR, &o.CashAmountIDR, &o.NonCashAmountIDR, &o.Notes, &o.CreatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return OrderDetail{}, ErrOrderNotFound
	} else if err != nil {
		return OrderDetail{}, fmt.Errorf("get order failed: %w", err)
	}

	rows, err := p.db.QueryContext(ctx,
		`SELECT id, order_id, product_id, product_name, sku, unit_price_idr, quantity, subtotal_idr, item_kind, service_id
		FROM order_items WHERE order_id = $1 ORDER BY id`,
		o.ID,
	)
	if err != nil {
		return OrderDetail{}, fmt.Errorf("query order items failed: %w", err)
	}
	defer rows.Close()

	items := make([]OrderItem, 0)
	for rows.Next() {
		var it OrderItem
		var gotProductID, gotServiceID sql.NullString
		if err := rows.Scan(
			&it.ID, &it.OrderID, &gotProductID, &it.ProductName, &it.SKU,
			&it.UnitPriceIDR, &it.Quantity, &it.SubtotalIDR, &it.ItemKind, &gotServiceID,
		); err != nil {
			return OrderDetail{}, fmt.Errorf("scan order item failed: %w", err)
		}
		if gotProductID.Valid {
			it.ProductID = gotProductID.String
		}
		if gotServiceID.Valid {
			svc := gotServiceID.String
			it.ServiceID = &svc
		}
		items = append(items, it)
	}

	return OrderDetail{
		Order: o,
		Items: items,
	}, rows.Err()
}

func validateCreateRequest(req *CreateOrderRequest) error {
	if strings.TrimSpace(req.LocationID) == "" {
		return ErrInvalidLocation
	}
	if !validPaymentMethods[req.PaymentMethod] {
		return ErrInvalidPaymentMethod
	}
	if len(req.Items) == 0 {
		return ErrEmptyItems
	}
	for i := range req.Items {
		it := &req.Items[i]
		kind, ok := normalizeItemKind(it.ItemKind)
		if !ok {
			return ErrInvalidItem
		}
		it.ItemKind = kind
		if kind == ItemKindJasa {
			if strings.TrimSpace(it.ProductName) == "" {
				return ErrInvalidItem
			}
			if strings.TrimSpace(it.SKU) == "" {
				it.SKU = "JASA"
			}
		} else if strings.TrimSpace(it.ProductID) == "" || strings.TrimSpace(it.ProductName) == "" {
			return ErrInvalidItem
		}
		if it.Quantity <= 0 {
			return ErrInvalidItemQuantity
		}
		if it.UnitPriceIDR < 0 {
			return ErrInvalidItemPrice
		}
	}
	if req.PaymentMethod == "split" {
		if req.CashAmountIDR == nil || req.NonCashAmountIDR == nil || *req.CashAmountIDR < 0 || *req.NonCashAmountIDR < 0 {
			return ErrInvalidSplitAmount
		}
	}
	return nil
}

// Handler handles HTTP requests for orders and checkout.
type Handler struct {
	repo Repository
}

func NewHandler(repo Repository) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) CreateOrder(w http.ResponseWriter, r *http.Request) {
	var req CreateOrderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		envelope.WriteError(w, r, http.StatusBadRequest, "MALFORMED_REQUEST", "Request body is not valid JSON.", nil)
		return
	}

	order, err := h.repo.CreateOrder(r.Context(), req)
	if err != nil {
		if errors.Is(err, ErrInvalidLocation) || errors.Is(err, ErrInvalidPaymentMethod) ||
			errors.Is(err, ErrEmptyItems) || errors.Is(err, ErrInvalidItemQuantity) ||
			errors.Is(err, ErrInvalidItemPrice) || errors.Is(err, ErrInsufficientPayment) ||
			errors.Is(err, ErrInvalidSplitAmount) || errors.Is(err, ErrInvalidItem) {
			envelope.WriteError(w, r, http.StatusUnprocessableEntity, "VALIDATION_FAILED", err.Error(), nil)
			return
		}
		if errors.Is(err, ErrInsufficientStock) {
			envelope.WriteError(w, r, http.StatusConflict, "INSUFFICIENT_STOCK", err.Error(), nil)
			return
		}
		envelope.WriteError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to process order.", nil)
		return
	}

	envelope.Write(w, r, http.StatusCreated, order)
}

func (h *Handler) ListOrders(w http.ResponseWriter, r *http.Request) {
	var locationID *string
	if loc := r.URL.Query().Get("location_id"); loc != "" {
		locationID = &loc
	}

	orders, err := h.repo.ListOrders(r.Context(), locationID)
	if err != nil {
		envelope.WriteError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to retrieve orders.", nil)
		return
	}

	envelope.Write(w, r, http.StatusOK, orders)
}

func (h *Handler) GetOrderByID(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if strings.TrimSpace(id) == "" {
		envelope.WriteError(w, r, http.StatusBadRequest, "INVALID_ID", "Order ID parameter is required.", nil)
		return
	}

	order, err := h.repo.GetOrderByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, ErrOrderNotFound) {
			envelope.WriteError(w, r, http.StatusNotFound, "NOT_FOUND", "Order was not found.", nil)
			return
		}
		envelope.WriteError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to retrieve order.", nil)
		return
	}

	envelope.Write(w, r, http.StatusOK, order)
}

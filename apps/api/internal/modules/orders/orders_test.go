package orders

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/muhri/ai-operational-pos/apps/api/internal/modules/inventory"
	"github.com/muhri/ai-operational-pos/apps/api/internal/platform/envelope"
	"github.com/muhri/ai-operational-pos/apps/api/internal/platform/tenantcontext"
)

func setupTestModule() (*MemoryRepository, *inventory.MemoryRepository, *Handler) {
	invRepo := inventory.NewMemoryRepository()
	// Pre-seed stock: 10 units of prod-1 at loc-main
	_, _ = invRepo.RecordMovement(context.Background(), inventory.RecordMovementRequest{
		ProductID:     "prod-1",
		LocationID:    "loc-main",
		QuantityDelta: 10,
		MovementType:  "opening",
	})

	orderRepo := NewMemoryRepository(invRepo)
	handler := NewHandler(orderRepo)
	return orderRepo, invRepo, handler
}

func TestCreateOrderSuccess(t *testing.T) {
	_, invRepo, handler := setupTestModule()

	payload := CreateOrderRequest{
		LocationID:    "loc-main",
		PaymentMethod: "cash",
		Items: []CreateOrderItemRequest{
			{
				ProductID:    "prod-1",
				ProductName:  "Kopi Susu Gula Aren",
				SKU:          "KOP-001",
				UnitPriceIDR: 18000,
				Quantity:     2,
			},
		},
		PaidAmountIDR: 50000,
		Notes:         "Customer requested less sugar",
	}

	body, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal payload failed: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/api/v1/orders", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	handler.CreateOrder(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected status 201, got %d. Body: %s", rec.Code, rec.Body.String())
	}

	var resp envelope.Success[OrderDetail]
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal response failed: %v", err)
	}

	order := resp.Data
	if order.SubtotalIDR != 36000 {
		t.Errorf("expected subtotal 36000, got %d", order.SubtotalIDR)
	}
	if order.TotalIDR != 36000 {
		t.Errorf("expected total 36000, got %d", order.TotalIDR)
	}
	if order.ChangeAmountIDR != 14000 {
		t.Errorf("expected change 14000, got %d", order.ChangeAmountIDR)
	}
	if len(order.Items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(order.Items))
	}

	// Verify stock was reduced from 10 to 8
	balances, err := invRepo.GetStockBalances(context.Background(), nil)
	if err != nil {
		t.Fatalf("get stock balances failed: %v", err)
	}
	var currentQty float64
	for _, b := range balances {
		if b.ProductID == "prod-1" && b.LocationID == "loc-main" {
			currentQty = b.Quantity
			break
		}
	}
	if currentQty != 8 {
		t.Errorf("expected inventory quantity 8 after sale, got %f", currentQty)
	}
}

func TestCreateOrderInsufficientStock(t *testing.T) {
	_, _, handler := setupTestModule()

	payload := CreateOrderRequest{
		LocationID:    "loc-main",
		PaymentMethod: "cash",
		Items: []CreateOrderItemRequest{
			{
				ProductID:    "prod-1",
				ProductName:  "Kopi Susu Gula Aren",
				SKU:          "KOP-001",
				UnitPriceIDR: 18000,
				Quantity:     50, // Available is only 10
			},
		},
		PaidAmountIDR: 1000000,
	}

	body, _ := json.Marshal(payload)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/orders", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	handler.CreateOrder(rec, req)

	if rec.Code != http.StatusConflict {
		t.Fatalf("expected status 409 conflict, got %d. Body: %s", rec.Code, rec.Body.String())
	}
}

func TestCreateOrderInsufficientPayment(t *testing.T) {
	_, _, handler := setupTestModule()

	payload := CreateOrderRequest{
		LocationID:    "loc-main",
		PaymentMethod: "cash",
		Items: []CreateOrderItemRequest{
			{
				ProductID:    "prod-1",
				ProductName:  "Kopi Susu Gula Aren",
				SKU:          "KOP-001",
				UnitPriceIDR: 18000,
				Quantity:     2, // total: 36000
			},
		},
		PaidAmountIDR: 20000, // Insufficient!
	}

	body, _ := json.Marshal(payload)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/orders", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	handler.CreateOrder(rec, req)

	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected status 422, got %d. Body: %s", rec.Code, rec.Body.String())
	}
}

func TestCreateOrderValidationErrors(t *testing.T) {
	tests := []struct {
		name    string
		payload CreateOrderRequest
	}{
		{
			name: "missing location",
			payload: CreateOrderRequest{
				PaymentMethod: "cash",
				Items: []CreateOrderItemRequest{
					{ProductID: "prod-1", ProductName: "Kopi", SKU: "KOP", UnitPriceIDR: 1000, Quantity: 1},
				},
				PaidAmountIDR: 1000,
			},
		},
		{
			name: "invalid payment method",
			payload: CreateOrderRequest{
				LocationID:    "loc-main",
				PaymentMethod: "crypto",
				Items: []CreateOrderItemRequest{
					{ProductID: "prod-1", ProductName: "Kopi", SKU: "KOP", UnitPriceIDR: 1000, Quantity: 1},
				},
				PaidAmountIDR: 1000,
			},
		},
		{
			name: "empty items",
			payload: CreateOrderRequest{
				LocationID:    "loc-main",
				PaymentMethod: "cash",
				Items:         []CreateOrderItemRequest{},
				PaidAmountIDR: 1000,
			},
		},
		{
			name: "zero item quantity",
			payload: CreateOrderRequest{
				LocationID:    "loc-main",
				PaymentMethod: "cash",
				Items: []CreateOrderItemRequest{
					{ProductID: "prod-1", ProductName: "Kopi", SKU: "KOP", UnitPriceIDR: 1000, Quantity: 0},
				},
				PaidAmountIDR: 1000,
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, _, handler := setupTestModule()
			body, _ := json.Marshal(tt.payload)
			req := httptest.NewRequest(http.MethodPost, "/api/v1/orders", bytes.NewReader(body))
			rec := httptest.NewRecorder()

			handler.CreateOrder(rec, req)

			if rec.Code != http.StatusUnprocessableEntity {
				t.Fatalf("expected status 422 for %s, got %d", tt.name, rec.Code)
			}
		})
	}
}

func TestListAndGetOrderByID(t *testing.T) {
	orderRepo, _, handler := setupTestModule()

	created, err := orderRepo.CreateOrder(context.Background(), CreateOrderRequest{
		LocationID:    "loc-main",
		PaymentMethod: "qris",
		Items: []CreateOrderItemRequest{
			{ProductID: "prod-1", ProductName: "Kopi", SKU: "KOP", UnitPriceIDR: 15000, Quantity: 1},
		},
		PaidAmountIDR: 15000,
	})
	if err != nil {
		t.Fatalf("failed to create order: %v", err)
	}

	// Test ListOrders
	listReq := httptest.NewRequest(http.MethodGet, "/api/v1/orders", nil)
	listRec := httptest.NewRecorder()
	handler.ListOrders(listRec, listReq)

	if listRec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", listRec.Code)
	}

	var listResp envelope.Success[[]Order]
	if err := json.Unmarshal(listRec.Body.Bytes(), &listResp); err != nil {
		t.Fatalf("unmarshal list failed: %v", err)
	}
	if len(listResp.Data) != 1 {
		t.Fatalf("expected 1 order, got %d", len(listResp.Data))
	}

	// Test GetOrderByID
	r := chi.NewRouter()
	r.Get("/api/v1/orders/{id}", handler.GetOrderByID)

	getReq := httptest.NewRequest(http.MethodGet, "/api/v1/orders/"+created.ID, nil)
	getRec := httptest.NewRecorder()
	r.ServeHTTP(getRec, getReq)

	if getRec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", getRec.Code)
	}

	var getResp envelope.Success[OrderDetail]
	if err := json.Unmarshal(getRec.Body.Bytes(), &getResp); err != nil {
		t.Fatalf("unmarshal get failed: %v", err)
	}
	if getResp.Data.ID != created.ID {
		t.Errorf("expected ID %s, got %s", created.ID, getResp.Data.ID)
	}
	if len(getResp.Data.Items) != 1 {
		t.Errorf("expected 1 item, got %d", len(getResp.Data.Items))
	}
}

func TestMultiTenantOrderIsolation(t *testing.T) {
	invRepo := inventory.NewMemoryRepository()
	orderRepo := NewMemoryRepository(invRepo)
	handler := NewHandler(orderRepo)

	tenantA := "tenant-alpha"
	tenantB := "tenant-beta"

	// Seed stock for both tenants
	ctxA := tenantcontext.WithTenantID(context.Background(), tenantA)
	ctxB := tenantcontext.WithTenantID(context.Background(), tenantB)
	_, _ = invRepo.RecordMovement(ctxA, inventory.RecordMovementRequest{
		ProductID:     "item-1",
		LocationID:    "loc-main",
		QuantityDelta: 10,
		MovementType:  "opening",
	})
	_, _ = invRepo.RecordMovement(ctxB, inventory.RecordMovementRequest{
		ProductID:     "item-1",
		LocationID:    "loc-main",
		QuantityDelta: 10,
		MovementType:  "opening",
	})

	// 1. Create order in Tenant A
	reqOrderA := CreateOrderRequest{
		LocationID:    "loc-main",
		PaymentMethod: "cash",
		PaidAmountIDR: 20000,
		Items: []CreateOrderItemRequest{
			{ProductID: "item-1", ProductName: "Coffee A", SKU: "COF-A", UnitPriceIDR: 15000, Quantity: 1},
		},
	}
	bodyA, _ := json.Marshal(reqOrderA)
	httpReqA := httptest.NewRequest(http.MethodPost, "/api/v1/orders", bytes.NewReader(bodyA)).WithContext(ctxA)
	recA := httptest.NewRecorder()
	handler.CreateOrder(recA, httpReqA)
	if recA.Code != http.StatusCreated {
		t.Fatalf("expected 201 for Tenant A order, got %d: %s", recA.Code, recA.Body.String())
	}

	var respA envelope.Success[OrderDetail]
	_ = json.Unmarshal(recA.Body.Bytes(), &respA)
	orderIDA := respA.Data.ID

	// 2. Create order in Tenant B
	reqOrderB := CreateOrderRequest{
		LocationID:    "loc-main",
		PaymentMethod: "cash",
		PaidAmountIDR: 30000,
		Items: []CreateOrderItemRequest{
			{ProductID: "item-1", ProductName: "Coffee B", SKU: "COF-B", UnitPriceIDR: 25000, Quantity: 1},
		},
	}
	bodyB, _ := json.Marshal(reqOrderB)
	httpReqB := httptest.NewRequest(http.MethodPost, "/api/v1/orders", bytes.NewReader(bodyB)).WithContext(ctxB)
	recB := httptest.NewRecorder()
	handler.CreateOrder(recB, httpReqB)
	if recB.Code != http.StatusCreated {
		t.Fatalf("expected 201 for Tenant B order, got %d: %s", recB.Code, recB.Body.String())
	}

	// 3. Tenant A lists orders -> only 1 order belonging to Tenant A
	listReqA := httptest.NewRequest(http.MethodGet, "/api/v1/orders", nil).WithContext(ctxA)
	listRecA := httptest.NewRecorder()
	handler.ListOrders(listRecA, listReqA)
	var listRespA envelope.Success[[]Order]
	_ = json.Unmarshal(listRecA.Body.Bytes(), &listRespA)
	if len(listRespA.Data) != 1 || listRespA.Data[0].ID != orderIDA {
		t.Fatalf("expected 1 order for Tenant A, got %+v", listRespA.Data)
	}

	// 4. Tenant B lists orders -> only 1 order belonging to Tenant B
	listReqB := httptest.NewRequest(http.MethodGet, "/api/v1/orders", nil).WithContext(ctxB)
	listRecB := httptest.NewRecorder()
	handler.ListOrders(listRecB, listReqB)
	var listRespB envelope.Success[[]Order]
	_ = json.Unmarshal(listRecB.Body.Bytes(), &listRespB)
	if len(listRespB.Data) != 1 || listRespB.Data[0].ID == orderIDA {
		t.Fatalf("expected 1 distinct order for Tenant B, got %+v", listRespB.Data)
	}

	// 5. Tenant B attempts to access Tenant A's order -> 404 NOT FOUND
	r := chi.NewRouter()
	r.Get("/api/v1/orders/{id}", handler.GetOrderByID)
	getReqB := httptest.NewRequest(http.MethodGet, "/api/v1/orders/"+orderIDA, nil).WithContext(ctxB)
	getRecB := httptest.NewRecorder()
	r.ServeHTTP(getRecB, getReqB)
	if getRecB.Code != http.StatusNotFound {
		t.Fatalf("expected 404 when Tenant B queries Tenant A order, got %d", getRecB.Code)
	}
}

type mockSaleRecorder struct {
	recordedTenant  string
	recordedMethod  string
	recordedAmount  int64
	recordedCash    int64
	recordedNonCash int64
	called          bool
}

func (m *mockSaleRecorder) RecordSale(_ context.Context, tenantID string, paymentMethod string, totalIDR int64, cashAmountIDR int64, nonCashAmountIDR int64) error {
	m.recordedTenant = tenantID
	m.recordedMethod = paymentMethod
	m.recordedAmount = totalIDR
	m.recordedCash = cashAmountIDR
	m.recordedNonCash = nonCashAmountIDR
	m.called = true
	return nil
}

func TestCreateOrderWithSaleRecorder(t *testing.T) {
	orderRepo, invRepo, _ := setupTestModule()
	mockSR := &mockSaleRecorder{}
	orderRepo.SetSaleRecorder(mockSR)

	ctx := tenantcontext.WithTenantID(context.Background(), "tenant-pos-1")
	_, _ = invRepo.RecordMovement(ctx, inventory.RecordMovementRequest{
		ProductID:     "prod-1",
		LocationID:    "loc-main",
		QuantityDelta: 10,
		MovementType:  "opening",
	})
	_, err := orderRepo.CreateOrder(ctx, CreateOrderRequest{
		LocationID:    "loc-main",
		PaymentMethod: "cash",
		Items: []CreateOrderItemRequest{
			{
				ProductID:    "prod-1",
				ProductName:  "Kopi",
				SKU:          "KOP-001",
				UnitPriceIDR: 20000,
				Quantity:     1,
			},
		},
		PaidAmountIDR: 20000,
	})
	if err != nil {
		t.Fatalf("create order failed: %v", err)
	}

	if !mockSR.called {
		t.Fatalf("expected sale recorder to be called")
	}
	if mockSR.recordedTenant != "tenant-pos-1" {
		t.Errorf("expected tenant tenant-pos-1, got %s", mockSR.recordedTenant)
	}
	if mockSR.recordedMethod != "cash" {
		t.Errorf("expected cash method, got %s", mockSR.recordedMethod)
	}
	if mockSR.recordedAmount != 20000 {
		t.Errorf("expected amount 20000, got %d", mockSR.recordedAmount)
	}
	if mockSR.recordedCash != 20000 || mockSR.recordedNonCash != 0 {
		t.Errorf("expected cash 20000 and nonCash 0, got %d and %d", mockSR.recordedCash, mockSR.recordedNonCash)
	}
}

func TestCreateOrderWithSplitPayment(t *testing.T) {
	orderRepo, invRepo, _ := setupTestModule()
	mockSR := &mockSaleRecorder{}
	orderRepo.SetSaleRecorder(mockSR)

	ctx := tenantcontext.WithTenantID(context.Background(), "tenant-pos-1")
	_, _ = invRepo.RecordMovement(ctx, inventory.RecordMovementRequest{
		ProductID:     "prod-1",
		LocationID:    "loc-main",
		QuantityDelta: 10,
		MovementType:  "opening",
	})

	cashTender := int64(30000)
	nonCashTender := int64(20000)
	order, err := orderRepo.CreateOrder(ctx, CreateOrderRequest{
		LocationID:    "loc-main",
		PaymentMethod: "split",
		Items: []CreateOrderItemRequest{
			{
				ProductID:    "prod-1",
				ProductName:  "Kopi",
				SKU:          "KOP-001",
				UnitPriceIDR: 20000,
				Quantity:     2, // Subtotal 40000
			},
		},
		CashAmountIDR:    &cashTender,
		NonCashAmountIDR: &nonCashTender,
		PaidAmountIDR:    50000, // 30k cash + 20k qris = 50k paid, total is 40k -> change 10k
	})
	if err != nil {
		t.Fatalf("create split order failed: %v", err)
	}

	if order.PaymentMethod != "split" {
		t.Errorf("expected payment method split, got %s", order.PaymentMethod)
	}
	if order.TotalIDR != 40000 {
		t.Errorf("expected total 40000, got %d", order.TotalIDR)
	}
	if order.ChangeAmountIDR != 10000 {
		t.Errorf("expected change 10000, got %d", order.ChangeAmountIDR)
	}
	// Non-cash is 20k, so net cash is 40k - 20k = 20k
	if order.CashAmountIDR != 20000 {
		t.Errorf("expected cash_amount_idr 20000, got %d", order.CashAmountIDR)
	}
	if order.NonCashAmountIDR != 20000 {
		t.Errorf("expected non_cash_amount_idr 20000, got %d", order.NonCashAmountIDR)
	}

	if !mockSR.called {
		t.Fatalf("expected sale recorder to be called")
	}
	if mockSR.recordedCash != 20000 || mockSR.recordedNonCash != 20000 {
		t.Errorf("expected recorder cash 20000 and nonCash 20000, got cash=%d nonCash=%d", mockSR.recordedCash, mockSR.recordedNonCash)
	}
}

func TestCreateOrderWithDiscountAndTax(t *testing.T) {
	orderRepo, invRepo, _ := setupTestModule()

	ctx := tenantcontext.WithTenantID(context.Background(), "tenant-pos-1")
	_, _ = invRepo.RecordMovement(ctx, inventory.RecordMovementRequest{
		ProductID:     "prod-1",
		LocationID:    "loc-main",
		QuantityDelta: 10,
		MovementType:  "opening",
	})

	tax := int64(4400)      // 11% PPN of 40,000
	discount := int64(5000) // Rp 5,000 discount
	// Total = 40,000 + 4,400 - 5,000 = 39,400
	order, err := orderRepo.CreateOrder(ctx, CreateOrderRequest{
		LocationID:    "loc-main",
		PaymentMethod: "cash",
		Items: []CreateOrderItemRequest{
			{
				ProductID:    "prod-1",
				ProductName:  "Kopi",
				SKU:          "KOP-001",
				UnitPriceIDR: 20000,
				Quantity:     2,
			},
		},
		TaxIDR:        &tax,
		DiscountIDR:   &discount,
		PaidAmountIDR: 40000,
	})
	if err != nil {
		t.Fatalf("create order with tax and discount failed: %v", err)
	}

	if order.SubtotalIDR != 40000 {
		t.Errorf("expected subtotal 40000, got %d", order.SubtotalIDR)
	}
	if order.TaxIDR != 4400 {
		t.Errorf("expected tax 4400, got %d", order.TaxIDR)
	}
	if order.DiscountIDR != 5000 {
		t.Errorf("expected discount 5000, got %d", order.DiscountIDR)
	}
	if order.TotalIDR != 39400 {
		t.Errorf("expected total 39400, got %d", order.TotalIDR)
	}
	if order.ChangeAmountIDR != 600 {
		t.Errorf("expected change 600, got %d", order.ChangeAmountIDR)
	}
}

type mockPromoRedeemer struct {
	calledPromoID string
	calledOrderID string
	calledDisc    int64
}

func (m *mockPromoRedeemer) RecordRedemption(ctx context.Context, promoID string, orderID string, discountApplied int64) error {
	m.calledPromoID = promoID
	m.calledOrderID = orderID
	m.calledDisc = discountApplied
	return nil
}

func TestCreateOrderWithPromo(t *testing.T) {
	invRepo := inventory.NewMemoryRepository()
	orderRepo := NewMemoryRepository(invRepo)
	redeemer := &mockPromoRedeemer{}
	orderRepo.SetPromoRedeemer(redeemer)

	ctx := tenantcontext.WithTenantID(context.Background(), "tenant-promo-1")
	_, _ = invRepo.RecordMovement(ctx, inventory.RecordMovementRequest{
		ProductID:     "prod-1",
		LocationID:    "loc-main",
		QuantityDelta: 10,
		MovementType:  "opening",
	})

	promoID := "promo-voucher-123"
	promoCode := "PAWHEMAT10"
	discount := int64(10000)

	order, err := orderRepo.CreateOrder(ctx, CreateOrderRequest{
		LocationID:    "loc-main",
		PaymentMethod: "cash",
		Items: []CreateOrderItemRequest{
			{
				ProductID:    "prod-1",
				ProductName:  "Pakan Kucing",
				SKU:          "CAT-01",
				UnitPriceIDR: 50000,
				Quantity:     2,
			},
		},
		DiscountIDR:   &discount,
		PaidAmountIDR: 90000,
		PromoID:       &promoID,
		PromoCode:     &promoCode,
	})
	if err != nil {
		t.Fatalf("failed to create order with promo: %v", err)
	}

	if order.PromoID == nil || *order.PromoID != promoID {
		t.Errorf("expected PromoID %s, got %v", promoID, order.PromoID)
	}
	if order.PromoCode != promoCode {
		t.Errorf("expected PromoCode %s, got %s", promoCode, order.PromoCode)
	}
	if redeemer.calledPromoID != promoID || redeemer.calledDisc != discount {
		t.Errorf("expected promo redemption recorded, got %+v", redeemer)
	}
}

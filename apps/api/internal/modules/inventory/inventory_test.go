package inventory

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/muhri/ai-operational-pos/apps/api/internal/platform/tenantcontext"
)

type EnvelopeResponse struct {
	Data      json.RawMessage `json:"data"`
	Error     *EnvelopeError  `json:"error"`
	RequestID string          `json:"request_id"`
}

type EnvelopeError struct {
	Code    string            `json:"code"`
	Message string            `json:"message"`
	Details map[string]string `json:"details"`
}

func TestListLocations(t *testing.T) {
	repo := NewMemoryRepository()
	handler := NewHandler(repo)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/inventory/locations", nil)
	rec := httptest.NewRecorder()
	handler.ListLocations(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", rec.Code)
	}

	var res EnvelopeResponse
	if err := json.NewDecoder(rec.Body).Decode(&res); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	var locations []InventoryLocation
	if err := json.Unmarshal(res.Data, &locations); err != nil {
		t.Fatalf("unmarshal locations: %v", err)
	}

	if len(locations) == 0 || locations[0].Code != "MAIN" {
		t.Fatalf("expected at least default location MAIN, got %+v", locations)
	}
}

func TestRecordMovementSuccess(t *testing.T) {
	repo := NewMemoryRepository()
	handler := NewHandler(repo)

	reason := "Initial inventory load"
	reqPayload := RecordMovementRequest{
		ProductID:     "prod-1",
		LocationID:    "loc-main",
		QuantityDelta: 15,
		MovementType:  "opening",
		Reason:        &reason,
	}

	body, _ := json.Marshal(reqPayload)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/inventory/movements", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	handler.RecordMovement(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created, got %d: %s", rec.Code, rec.Body.String())
	}

	var res EnvelopeResponse
	_ = json.NewDecoder(rec.Body).Decode(&res)
	var mov StockMovement
	_ = json.Unmarshal(res.Data, &mov)

	if mov.ProductID != "prod-1" || mov.QuantityDelta != 15 {
		t.Fatalf("unexpected movement: %+v", mov)
	}

	// Verify balance is updated to 15
	balRec := httptest.NewRecorder()
	balReq := httptest.NewRequest(http.MethodGet, "/api/v1/inventory/stocks", nil)
	handler.ListStocks(balRec, balReq)

	var balRes EnvelopeResponse
	_ = json.NewDecoder(balRec.Body).Decode(&balRes)
	var summaries []ProductStockSummary
	_ = json.Unmarshal(balRes.Data, &summaries)

	if len(summaries) != 1 || summaries[0].Quantity != 15 {
		t.Fatalf("expected 1 stock summary with qty 15, got %+v", summaries)
	}
}

func TestRecordMovementInsufficientStock(t *testing.T) {
	repo := NewMemoryRepository()
	handler := NewHandler(repo)

	// Try to deduct stock when balance is 0
	reqPayload := RecordMovementRequest{
		ProductID:     "prod-1",
		LocationID:    "loc-main",
		QuantityDelta: -5,
		MovementType:  "sale",
	}

	body, _ := json.Marshal(reqPayload)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/inventory/movements", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	handler.RecordMovement(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request, got %d: %s", rec.Code, rec.Body.String())
	}

	var res EnvelopeResponse
	_ = json.NewDecoder(rec.Body).Decode(&res)
	if res.Error == nil || res.Error.Code != "INSUFFICIENT_STOCK" {
		t.Fatalf("expected INSUFFICIENT_STOCK error code, got %+v", res.Error)
	}
}

func TestRecordMovementValidationErrors(t *testing.T) {
	repo := NewMemoryRepository()
	handler := NewHandler(repo)

	tests := []struct {
		name        string
		payload     RecordMovementRequest
		expectedKey string
	}{
		{
			name: "missing product_id",
			payload: RecordMovementRequest{
				ProductID:     "",
				LocationID:    "loc-main",
				QuantityDelta: 10,
				MovementType:  "purchase_receipt",
			},
			expectedKey: "product_id",
		},
		{
			name: "missing location_id",
			payload: RecordMovementRequest{
				ProductID:     "prod-1",
				LocationID:    "",
				QuantityDelta: 10,
				MovementType:  "purchase_receipt",
			},
			expectedKey: "location_id",
		},
		{
			name: "zero delta",
			payload: RecordMovementRequest{
				ProductID:     "prod-1",
				LocationID:    "loc-main",
				QuantityDelta: 0,
				MovementType:  "purchase_receipt",
			},
			expectedKey: "quantity_delta",
		},
		{
			name: "invalid movement type",
			payload: RecordMovementRequest{
				ProductID:     "prod-1",
				LocationID:    "loc-main",
				QuantityDelta: 10,
				MovementType:  "teleportation",
			},
			expectedKey: "movement_type",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			body, _ := json.Marshal(tc.payload)
			req := httptest.NewRequest(http.MethodPost, "/api/v1/inventory/movements", bytes.NewReader(body))
			rec := httptest.NewRecorder()

			handler.RecordMovement(rec, req)

			if rec.Code != http.StatusBadRequest {
				t.Fatalf("expected 400 Bad Request, got %d", rec.Code)
			}

			var res EnvelopeResponse
			_ = json.NewDecoder(rec.Body).Decode(&res)
			if res.Error == nil || res.Error.Code != "VALIDATION_ERROR" {
				t.Fatalf("expected VALIDATION_ERROR, got %+v", res.Error)
			}
			if _, exists := res.Error.Details[tc.expectedKey]; !exists {
				t.Fatalf("expected detail for %s, got: %+v", tc.expectedKey, res.Error.Details)
			}
		})
	}
}

func TestMultiTenantInventoryIsolation(t *testing.T) {
	repo := NewMemoryRepository()
	handler := NewHandler(repo)

	tenantA := "tenant-alpha"
	tenantB := "tenant-beta"

	// Add stock for tenant A
	reqA := RecordMovementRequest{
		ProductID:     "item-1",
		LocationID:    "loc-main",
		QuantityDelta: 20,
		MovementType:  "opening",
	}
	bodyA, _ := json.Marshal(reqA)
	httpReqA := httptest.NewRequest(http.MethodPost, "/api/v1/inventory/movements", bytes.NewReader(bodyA))
	httpReqA = httpReqA.WithContext(tenantcontext.WithTenantID(httpReqA.Context(), tenantA))
	recA := httptest.NewRecorder()
	handler.RecordMovement(recA, httpReqA)

	if recA.Code != http.StatusCreated {
		t.Fatalf("expected 201 for tenant A, got %d", recA.Code)
	}

	// Add stock for tenant B with same product ID
	reqB := RecordMovementRequest{
		ProductID:     "item-1",
		LocationID:    "loc-main",
		QuantityDelta: 5,
		MovementType:  "opening",
	}
	bodyB, _ := json.Marshal(reqB)
	httpReqB := httptest.NewRequest(http.MethodPost, "/api/v1/inventory/movements", bytes.NewReader(bodyB))
	httpReqB = httpReqB.WithContext(tenantcontext.WithTenantID(httpReqB.Context(), tenantB))
	recB := httptest.NewRecorder()
	handler.RecordMovement(recB, httpReqB)

	if recB.Code != http.StatusCreated {
		t.Fatalf("expected 201 for tenant B, got %d", recB.Code)
	}

	// Verify Tenant A sees quantity 20
	getReqA := httptest.NewRequest(http.MethodGet, "/api/v1/inventory/stocks", nil)
	getReqA = getReqA.WithContext(tenantcontext.WithTenantID(getReqA.Context(), tenantA))
	getRecA := httptest.NewRecorder()
	handler.ListStocks(getRecA, getReqA)

	var resA EnvelopeResponse
	_ = json.NewDecoder(getRecA.Body).Decode(&resA)
	var stocksA []ProductStockSummary
	_ = json.Unmarshal(resA.Data, &stocksA)

	if len(stocksA) != 1 || stocksA[0].Quantity != 20 {
		t.Fatalf("expected Tenant A stock 20, got %+v", stocksA)
	}

	// Verify Tenant B sees quantity 5
	getReqB := httptest.NewRequest(http.MethodGet, "/api/v1/inventory/stocks", nil)
	getReqB = getReqB.WithContext(tenantcontext.WithTenantID(getReqB.Context(), tenantB))
	getRecB := httptest.NewRecorder()
	handler.ListStocks(getRecB, getReqB)

	var resB EnvelopeResponse
	_ = json.NewDecoder(getRecB.Body).Decode(&resB)
	var stocksB []ProductStockSummary
	_ = json.Unmarshal(resB.Data, &stocksB)

	if len(stocksB) != 1 || stocksB[0].Quantity != 5 {
		t.Fatalf("expected Tenant B stock 5, got %+v", stocksB)
	}
}

func TestListMovements(t *testing.T) {
	repo := NewMemoryRepository()
	handler := NewHandler(repo)

	tenantA := "tenant-alpha"
	tenantB := "tenant-beta"

	// Record movements for tenant A
	reason1 := "Inbound purchase PO-001"
	_, err := repo.RecordMovement(tenantcontext.WithTenantID(context.Background(), tenantA), RecordMovementRequest{
		ProductID:     "p-1",
		LocationID:    "loc-main",
		QuantityDelta: 50,
		MovementType:  "purchase_receipt",
		Reason:        &reason1,
	})
	if err != nil {
		t.Fatalf("unexpected record error: %v", err)
	}

	reason2 := "Outbound sale"
	_, err = repo.RecordMovement(tenantcontext.WithTenantID(context.Background(), tenantA), RecordMovementRequest{
		ProductID:     "p-1",
		LocationID:    "loc-main",
		QuantityDelta: -5,
		MovementType:  "sale",
		Reason:        &reason2,
	})
	if err != nil {
		t.Fatalf("unexpected record error: %v", err)
	}

	// Record movement for tenant B
	reason3 := "Opening stock"
	_, err = repo.RecordMovement(tenantcontext.WithTenantID(context.Background(), tenantB), RecordMovementRequest{
		ProductID:     "p-2",
		LocationID:    "loc-main",
		QuantityDelta: 10,
		MovementType:  "opening",
		Reason:        &reason3,
	})
	if err != nil {
		t.Fatalf("unexpected record error: %v", err)
	}

	// 1. List all movements for Tenant A
	reqA := httptest.NewRequest(http.MethodGet, "/api/v1/inventory/movements", nil)
	reqA = reqA.WithContext(tenantcontext.WithTenantID(reqA.Context(), tenantA))
	recA := httptest.NewRecorder()
	handler.ListMovements(recA, reqA)

	if recA.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", recA.Code, recA.Body.String())
	}

	var resA EnvelopeResponse
	_ = json.NewDecoder(recA.Body).Decode(&resA)
	var listA []StockMovementItem
	_ = json.Unmarshal(resA.Data, &listA)

	if len(listA) != 2 {
		t.Fatalf("expected 2 movements for tenant A, got %d", len(listA))
	}
	// Newest first -> sale should be first, purchase_receipt second
	if listA[0].MovementType != "sale" || listA[1].MovementType != "purchase_receipt" {
		t.Fatalf("expected newest movement first, got %+v", listA)
	}

	// 2. Filter by movement_type=purchase_receipt for Tenant A
	reqFiltered := httptest.NewRequest(http.MethodGet, "/api/v1/inventory/movements?movement_type=purchase_receipt", nil)
	reqFiltered = reqFiltered.WithContext(tenantcontext.WithTenantID(reqFiltered.Context(), tenantA))
	recFiltered := httptest.NewRecorder()
	handler.ListMovements(recFiltered, reqFiltered)

	var resFiltered EnvelopeResponse
	_ = json.NewDecoder(recFiltered.Body).Decode(&resFiltered)
	var listFiltered []StockMovementItem
	_ = json.Unmarshal(resFiltered.Data, &listFiltered)

	if len(listFiltered) != 1 || listFiltered[0].MovementType != "purchase_receipt" {
		t.Fatalf("expected 1 filtered movement, got %+v", listFiltered)
	}

	// 3. Verify Tenant B only sees 1 movement
	reqB := httptest.NewRequest(http.MethodGet, "/api/v1/inventory/movements", nil)
	reqB = reqB.WithContext(tenantcontext.WithTenantID(reqB.Context(), tenantB))
	recB := httptest.NewRecorder()
	handler.ListMovements(recB, reqB)

	var resB EnvelopeResponse
	_ = json.NewDecoder(recB.Body).Decode(&resB)
	var listB []StockMovementItem
	_ = json.Unmarshal(resB.Data, &listB)

	if len(listB) != 1 || listB[0].ProductID != "p-2" {
		t.Fatalf("expected 1 movement for tenant B, got %+v", listB)
	}
}

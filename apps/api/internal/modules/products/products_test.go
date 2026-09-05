package products

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
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

func TestHandlerListEmpty(t *testing.T) {
	repo := NewMemoryRepository()
	handler := NewHandler(repo)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/products", nil)
	rec := httptest.NewRecorder()

	handler.List(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", rec.Code)
	}

	var res EnvelopeResponse
	if err := json.NewDecoder(rec.Body).Decode(&res); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	var prods []Product
	if err := json.Unmarshal(res.Data, &prods); err != nil {
		t.Fatalf("failed to unmarshal data: %v", err)
	}

	if len(prods) != 0 {
		t.Fatalf("expected 0 products, got %d", len(prods))
	}
}

func TestHandlerCreateSuccess(t *testing.T) {
	repo := NewMemoryRepository()
	handler := NewHandler(repo)

	payload := CreateProductRequest{
		SKU:              "BRG-001",
		Name:             "Kopi Susu Gula Aren",
		PurchasePriceIDR: 8000,
		SellingPriceIDR:  18000,
		BaseUnit:         "cup",
		MinimumStock:     5,
	}
	body, _ := json.Marshal(payload)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/products", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	handler.Create(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created, got %d: %s", rec.Code, rec.Body.String())
	}

	var res EnvelopeResponse
	if err := json.NewDecoder(rec.Body).Decode(&res); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	var created Product
	if err := json.Unmarshal(res.Data, &created); err != nil {
		t.Fatalf("failed to unmarshal data: %v", err)
	}

	if created.SKU != "BRG-001" || created.Name != "Kopi Susu Gula Aren" {
		t.Fatalf("unexpected created product: %+v", created)
	}

	// Verify it shows up in List
	listRec := httptest.NewRecorder()
	listReq := httptest.NewRequest(http.MethodGet, "/api/v1/products", nil)
	handler.List(listRec, listReq)

	var listRes EnvelopeResponse
	_ = json.NewDecoder(listRec.Body).Decode(&listRes)
	var list []Product
	_ = json.Unmarshal(listRes.Data, &list)
	if len(list) != 1 {
		t.Fatalf("expected 1 product in list, got %d", len(list))
	}
}

func TestHandlerCreateValidationErrors(t *testing.T) {
	repo := NewMemoryRepository()
	handler := NewHandler(repo)

	tests := []struct {
		name        string
		payload     CreateProductRequest
		expectedKey string
	}{
		{
			name: "missing sku",
			payload: CreateProductRequest{
				SKU:              "",
				Name:             "Produk Test",
				PurchasePriceIDR: 1000,
				SellingPriceIDR:  2000,
				BaseUnit:         "pcs",
			},
			expectedKey: "sku",
		},
		{
			name: "missing name",
			payload: CreateProductRequest{
				SKU:              "SKU-1",
				Name:             "",
				PurchasePriceIDR: 1000,
				SellingPriceIDR:  2000,
				BaseUnit:         "pcs",
			},
			expectedKey: "name",
		},
		{
			name: "missing base unit",
			payload: CreateProductRequest{
				SKU:              "SKU-1",
				Name:             "Produk Test",
				PurchasePriceIDR: 1000,
				SellingPriceIDR:  2000,
				BaseUnit:         "",
			},
			expectedKey: "base_unit",
		},
		{
			name: "negative purchase price",
			payload: CreateProductRequest{
				SKU:              "SKU-1",
				Name:             "Produk Test",
				PurchasePriceIDR: -500,
				SellingPriceIDR:  2000,
				BaseUnit:         "pcs",
			},
			expectedKey: "purchase_price_idr",
		},
		{
			name: "negative selling price",
			payload: CreateProductRequest{
				SKU:              "SKU-1",
				Name:             "Produk Test",
				PurchasePriceIDR: 1000,
				SellingPriceIDR:  -2000,
				BaseUnit:         "pcs",
			},
			expectedKey: "selling_price_idr",
		},
		{
			name: "negative minimum stock",
			payload: CreateProductRequest{
				SKU:              "SKU-1",
				Name:             "Produk Test",
				PurchasePriceIDR: 1000,
				SellingPriceIDR:  2000,
				BaseUnit:         "pcs",
				MinimumStock:     -1,
			},
			expectedKey: "minimum_stock",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			body, _ := json.Marshal(tc.payload)
			req := httptest.NewRequest(http.MethodPost, "/api/v1/products", bytes.NewReader(body))
			rec := httptest.NewRecorder()

			handler.Create(rec, req)

			if rec.Code != http.StatusBadRequest {
				t.Fatalf("expected 400 Bad Request, got %d", rec.Code)
			}

			var res EnvelopeResponse
			if err := json.NewDecoder(rec.Body).Decode(&res); err != nil {
				t.Fatalf("failed to decode response: %v", err)
			}

			if res.Error == nil || res.Error.Code != "VALIDATION_ERROR" {
				t.Fatalf("expected VALIDATION_ERROR code, got %+v", res.Error)
			}

			if _, exists := res.Error.Details[tc.expectedKey]; !exists {
				t.Fatalf("expected validation detail for key '%s', got details: %+v", tc.expectedKey, res.Error.Details)
			}
		})
	}
}

func TestHandlerCreateDuplicateSKU(t *testing.T) {
	repo := NewMemoryRepository()
	handler := NewHandler(repo)

	payload := CreateProductRequest{
		SKU:              "SKU-DUP",
		Name:             "Item Pertama",
		PurchasePriceIDR: 5000,
		SellingPriceIDR:  10000,
		BaseUnit:         "pcs",
	}

	// First insert succeeds
	body1, _ := json.Marshal(payload)
	rec1 := httptest.NewRecorder()
	handler.Create(rec1, httptest.NewRequest(http.MethodPost, "/api/v1/products", bytes.NewReader(body1)))
	if rec1.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created, got %d", rec1.Code)
	}

	// Second insert with same SKU fails with 409
	payload2 := payload
	payload2.Name = "Item Berbeda"
	body2, _ := json.Marshal(payload2)
	rec2 := httptest.NewRecorder()
	handler.Create(rec2, httptest.NewRequest(http.MethodPost, "/api/v1/products", bytes.NewReader(body2)))

	if rec2.Code != http.StatusConflict {
		t.Fatalf("expected 409 Conflict, got %d: %s", rec2.Code, rec2.Body.String())
	}

	var res EnvelopeResponse
	_ = json.NewDecoder(rec2.Body).Decode(&res)
	if res.Error == nil || res.Error.Code != "PRODUCT_SKU_EXISTS" {
		t.Fatalf("expected code PRODUCT_SKU_EXISTS, got %+v", res.Error)
	}
}

func TestHandlerUpdateSuccess(t *testing.T) {
	repo := NewMemoryRepository()
	handler := NewHandler(repo)

	r := chi.NewRouter()
	r.Post("/api/v1/products", handler.Create)
	r.Put("/api/v1/products/{id}", handler.Update)

	// Create a product
	createPayload := CreateProductRequest{
		SKU:              "UPD-001",
		Name:             "Produk Awal",
		PurchasePriceIDR: 5000,
		SellingPriceIDR:  10000,
		BaseUnit:         "pcs",
		MinimumStock:     2,
	}
	createBody, _ := json.Marshal(createPayload)
	createReq := httptest.NewRequest(http.MethodPost, "/api/v1/products", bytes.NewReader(createBody))
	createRec := httptest.NewRecorder()
	r.ServeHTTP(createRec, createReq)

	var createRes EnvelopeResponse
	_ = json.NewDecoder(createRec.Body).Decode(&createRes)
	var created Product
	_ = json.Unmarshal(createRes.Data, &created)

	// Update the product
	updatePayload := UpdateProductRequest{
		SKU:              "UPD-001-MOD",
		Name:             "Produk Diperbarui",
		PurchasePriceIDR: 6000,
		SellingPriceIDR:  12000,
		BaseUnit:         "box",
		MinimumStock:     5,
	}
	updateBody, _ := json.Marshal(updatePayload)
	updateReq := httptest.NewRequest(http.MethodPut, "/api/v1/products/"+created.ID, bytes.NewReader(updateBody))
	updateRec := httptest.NewRecorder()
	r.ServeHTTP(updateRec, updateReq)

	if updateRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on update, got %d: %s", updateRec.Code, updateRec.Body.String())
	}

	var updateRes EnvelopeResponse
	_ = json.NewDecoder(updateRec.Body).Decode(&updateRes)
	var updated Product
	_ = json.Unmarshal(updateRes.Data, &updated)

	if updated.Name != "Produk Diperbarui" || updated.SKU != "UPD-001-MOD" || updated.SellingPriceIDR != 12000 {
		t.Fatalf("unexpected updated product values: %+v", updated)
	}
}

func TestHandlerDeleteSuccess(t *testing.T) {
	repo := NewMemoryRepository()
	handler := NewHandler(repo)

	r := chi.NewRouter()
	r.Post("/api/v1/products", handler.Create)
	r.Get("/api/v1/products", handler.List)
	r.Delete("/api/v1/products/{id}", handler.Delete)

	// Create
	createPayload := CreateProductRequest{
		SKU:              "DEL-001",
		Name:             "Produk Hapus",
		PurchasePriceIDR: 5000,
		SellingPriceIDR:  10000,
		BaseUnit:         "pcs",
	}
	createBody, _ := json.Marshal(createPayload)
	createRec := httptest.NewRecorder()
	r.ServeHTTP(createRec, httptest.NewRequest(http.MethodPost, "/api/v1/products", bytes.NewReader(createBody)))

	var createRes EnvelopeResponse
	_ = json.NewDecoder(createRec.Body).Decode(&createRes)
	var created Product
	_ = json.Unmarshal(createRes.Data, &created)

	// Delete
	delRec := httptest.NewRecorder()
	r.ServeHTTP(delRec, httptest.NewRequest(http.MethodDelete, "/api/v1/products/"+created.ID, nil))

	if delRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK on delete, got %d: %s", delRec.Code, delRec.Body.String())
	}

	// Verify not in list
	listRec := httptest.NewRecorder()
	r.ServeHTTP(listRec, httptest.NewRequest(http.MethodGet, "/api/v1/products", nil))
	var listRes EnvelopeResponse
	_ = json.NewDecoder(listRec.Body).Decode(&listRes)
	var prods []Product
	_ = json.Unmarshal(listRes.Data, &prods)

	if len(prods) != 0 {
		t.Fatalf("expected 0 products after delete, got %d", len(prods))
	}
}

func TestMultiTenantProductIsolation(t *testing.T) {
	repo := NewMemoryRepository()
	handler := NewHandler(repo)

	tenantA := "tenant-a-id"
	tenantB := "tenant-b-id"

	// 1. Create product in Tenant A with SKU "SKU-SHARED"
	reqA := CreateProductRequest{
		SKU:              "SKU-SHARED",
		Name:             "Kopi Toko A",
		PurchasePriceIDR: 5000,
		SellingPriceIDR:  10000,
		BaseUnit:         "cup",
	}
	bodyA, _ := json.Marshal(reqA)
	httpReqA := httptest.NewRequest(http.MethodPost, "/api/v1/products", bytes.NewReader(bodyA))
	httpReqA = httpReqA.WithContext(tenantcontext.WithTenantID(httpReqA.Context(), tenantA))
	recA := httptest.NewRecorder()
	handler.Create(recA, httpReqA)

	if recA.Code != http.StatusCreated {
		t.Fatalf("expected 201 for Tenant A, got %d: %s", recA.Code, recA.Body.String())
	}

	// 2. Create product in Tenant B with the EXACT SAME SKU "SKU-SHARED" -> Must succeed (no conflict across tenants)
	reqB := CreateProductRequest{
		SKU:              "SKU-SHARED",
		Name:             "Kopi Toko B",
		PurchasePriceIDR: 7000,
		SellingPriceIDR:  15000,
		BaseUnit:         "cup",
	}
	bodyB, _ := json.Marshal(reqB)
	httpReqB := httptest.NewRequest(http.MethodPost, "/api/v1/products", bytes.NewReader(bodyB))
	httpReqB = httpReqB.WithContext(tenantcontext.WithTenantID(httpReqB.Context(), tenantB))
	recB := httptest.NewRecorder()
	handler.Create(recB, httpReqB)

	if recB.Code != http.StatusCreated {
		t.Fatalf("expected 201 for Tenant B with same SKU, got %d: %s", recB.Code, recB.Body.String())
	}

	// 3. List products in Tenant A -> Should only return Tenant A's product
	listReqA := httptest.NewRequest(http.MethodGet, "/api/v1/products", nil)
	listReqA = listReqA.WithContext(tenantcontext.WithTenantID(listReqA.Context(), tenantA))
	listRecA := httptest.NewRecorder()
	handler.List(listRecA, listReqA)

	var listResA EnvelopeResponse
	_ = json.NewDecoder(listRecA.Body).Decode(&listResA)
	var prodsA []Product
	_ = json.Unmarshal(listResA.Data, &prodsA)

	if len(prodsA) != 1 || prodsA[0].Name != "Kopi Toko A" || prodsA[0].TenantID != tenantA {
		t.Fatalf("expected only Tenant A product, got: %+v", prodsA)
	}

	// 4. List products in Tenant B -> Should only return Tenant B's product
	listReqB := httptest.NewRequest(http.MethodGet, "/api/v1/products", nil)
	listReqB = listReqB.WithContext(tenantcontext.WithTenantID(listReqB.Context(), tenantB))
	listRecB := httptest.NewRecorder()
	handler.List(listRecB, listReqB)

	var listResB EnvelopeResponse
	_ = json.NewDecoder(listRecB.Body).Decode(&listResB)
	var prodsB []Product
	_ = json.Unmarshal(listResB.Data, &prodsB)

	if len(prodsB) != 1 || prodsB[0].Name != "Kopi Toko B" || prodsB[0].TenantID != tenantB {
		t.Fatalf("expected only Tenant B product, got: %+v", prodsB)
	}
}

package httpserver

import (
	"bytes"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRouterProductsEndpoints(t *testing.T) {
	router := NewRouter(nil, nil, nil)

	// Test GET /api/v1/products empty list
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/products", nil)
	req.Header.Set("Origin", "http://localhost:5173")
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", rec.Code)
	}

	if rec.Header().Get("Access-Control-Allow-Origin") != "http://localhost:5173" {
		t.Fatalf("expected CORS origin header, got %s", rec.Header().Get("Access-Control-Allow-Origin"))
	}

	var listRes struct {
		Data      []map[string]interface{} `json:"data"`
		RequestID string                   `json:"request_id"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&listRes); err != nil {
		t.Fatalf("failed to decode json: %v", err)
	}
	if len(listRes.Data) != 0 {
		t.Fatalf("expected 0 products, got %d", len(listRes.Data))
	}

	// Test POST /api/v1/products
	createPayload := []byte(`{
		"sku": "ROTI-01",
		"name": "Roti Bakar Cokelat",
		"purchase_price_idr": 7000,
		"selling_price_idr": 15000,
		"base_unit": "porsi",
		"minimum_stock": 2
	}`)
	createRec := httptest.NewRecorder()
	createReq := httptest.NewRequest(http.MethodPost, "/api/v1/products", bytes.NewReader(createPayload))
	router.ServeHTTP(createRec, createReq)

	if createRec.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created, got %d: %s", createRec.Code, createRec.Body.String())
	}

	// Test GET /api/v1/products again to see the newly created product
	rec2 := httptest.NewRecorder()
	req2 := httptest.NewRequest(http.MethodGet, "/api/v1/products", nil)
	router.ServeHTTP(rec2, req2)

	var listRes2 struct {
		Data []struct {
			SKU  string `json:"sku"`
			Name string `json:"name"`
		} `json:"data"`
	}
	_ = json.NewDecoder(rec2.Body).Decode(&listRes2)
	if len(listRes2.Data) != 1 || listRes2.Data[0].SKU != "ROTI-01" {
		t.Fatalf("expected 1 product with SKU ROTI-01, got %+v", listRes2.Data)
	}
}

func TestRouterInventoryEndpoints(t *testing.T) {
	router := NewRouter(nil, nil, nil)

	// 1. GET /api/v1/inventory/locations
	locRec := httptest.NewRecorder()
	locReq := httptest.NewRequest(http.MethodGet, "/api/v1/inventory/locations", nil)
	router.ServeHTTP(locRec, locReq)
	if locRec.Code != http.StatusOK {
		t.Fatalf("expected 200 for locations, got %d", locRec.Code)
	}

	// 2. POST /api/v1/inventory/movements
	movBody := []byte(`{
		"product_id": "p-100",
		"location_id": "loc-main",
		"quantity_delta": 25,
		"movement_type": "purchase_receipt"
	}`)
	movRec := httptest.NewRecorder()
	movReq := httptest.NewRequest(http.MethodPost, "/api/v1/inventory/movements", bytes.NewReader(movBody))
	router.ServeHTTP(movRec, movReq)
	if movRec.Code != http.StatusCreated {
		t.Fatalf("expected 201 for movement, got %d: %s", movRec.Code, movRec.Body.String())
	}

	// 3. GET /api/v1/inventory/stocks
	stockRec := httptest.NewRecorder()
	stockReq := httptest.NewRequest(http.MethodGet, "/api/v1/inventory/stocks", nil)
	router.ServeHTTP(stockRec, stockReq)
	if stockRec.Code != http.StatusOK {
		t.Fatalf("expected 200 for stocks, got %d", stockRec.Code)
	}
}

func TestRouterOrdersEndpoints(t *testing.T) {
	router := NewRouter(nil, nil, nil)

	// Pre-seed stock at loc-main
	seedBody := []byte(`{
		"product_id": "prod-abc",
		"location_id": "loc-main",
		"quantity_delta": 10,
		"movement_type": "opening"
	}`)
	seedRec := httptest.NewRecorder()
	seedReq := httptest.NewRequest(http.MethodPost, "/api/v1/inventory/movements", bytes.NewReader(seedBody))
	router.ServeHTTP(seedRec, seedReq)
	if seedRec.Code != http.StatusCreated {
		t.Fatalf("expected 201 for seed movement, got %d", seedRec.Code)
	}

	// 1. GET /api/v1/orders (initially empty)
	listRec := httptest.NewRecorder()
	listReq := httptest.NewRequest(http.MethodGet, "/api/v1/orders", nil)
	router.ServeHTTP(listRec, listReq)
	if listRec.Code != http.StatusOK {
		t.Fatalf("expected 200 for orders list, got %d", listRec.Code)
	}

	// 2. POST /api/v1/orders (checkout)
	orderBody := []byte(`{
		"location_id": "loc-main",
		"payment_method": "cash",
		"paid_amount_idr": 20000,
		"items": [
			{
				"product_id": "prod-abc",
				"product_name": "Teh Manis",
				"sku": "TEH-01",
				"unit_price_idr": 8000,
				"quantity": 2
			}
		]
	}`)
	orderRec := httptest.NewRecorder()
	orderReq := httptest.NewRequest(http.MethodPost, "/api/v1/orders", bytes.NewReader(orderBody))
	router.ServeHTTP(orderRec, orderReq)
	if orderRec.Code != http.StatusCreated {
		t.Fatalf("expected 201 for order creation, got %d: %s", orderRec.Code, orderRec.Body.String())
	}

	var createdRes struct {
		Data struct {
			ID          string `json:"id"`
			TotalIDR    int64  `json:"total_idr"`
			ChangeIDR   int64  `json:"change_amount_idr"`
			OrderNumber string `json:"order_number"`
		} `json:"data"`
	}
	if err := json.NewDecoder(orderRec.Body).Decode(&createdRes); err != nil {
		t.Fatalf("decode order response failed: %v", err)
	}
	if createdRes.Data.TotalIDR != 16000 {
		t.Errorf("expected total 16000, got %d", createdRes.Data.TotalIDR)
	}
	if createdRes.Data.ChangeIDR != 4000 {
		t.Errorf("expected change 4000, got %d", createdRes.Data.ChangeIDR)
	}

	// 3. GET /api/v1/orders/{id}
	getRec := httptest.NewRecorder()
	getReq := httptest.NewRequest(http.MethodGet, "/api/v1/orders/"+createdRes.Data.ID, nil)
	router.ServeHTTP(getRec, getReq)
	if getRec.Code != http.StatusOK {
		t.Fatalf("expected 200 for get order, got %d", getRec.Code)
	}
}

func TestRouterUploadEndpoint(t *testing.T) {
	router := NewRouter(nil, nil, nil)

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", "kopi.webp")
	if err != nil {
		t.Fatalf("create form file failed: %v", err)
	}
	part.Write([]byte("RIFF\x00\x00\x00\x00WEBPVP8 \x00\x00\x00\x00data"))
	writer.Close()

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/uploads", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created for upload, got %d: %s", rec.Code, rec.Body.String())
	}

	var res struct {
		Data struct {
			URL string `json:"url"`
		} `json:"data"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&res); err != nil {
		t.Fatalf("decode upload response failed: %v", err)
	}
	if res.Data.URL == "" {
		t.Errorf("expected non-empty URL in upload response")
	}
}

func TestRouterTenantEndpoints(t *testing.T) {
	router := NewRouter(nil, nil, nil)

	// 1. Check CORS preflight includes X-Tenant-ID
	optionsReq := httptest.NewRequest(http.MethodOptions, "/api/v1/products", nil)
	optionsReq.Header.Set("Origin", "http://localhost:5173")
	optionsRec := httptest.NewRecorder()
	router.ServeHTTP(optionsRec, optionsReq)
	if optionsRec.Code != http.StatusNoContent {
		t.Fatalf("expected 204 for OPTIONS, got %d", optionsRec.Code)
	}
	allowedHeaders := optionsRec.Header().Get("Access-Control-Allow-Headers")
	if allowedHeaders == "" || !bytes.Contains([]byte(allowedHeaders), []byte("X-Tenant-ID")) {
		t.Fatalf("expected Access-Control-Allow-Headers to include X-Tenant-ID, got %s", allowedHeaders)
	}

	// 2. Register new merchant tenant
	regPayload := []byte(`{
		"name": "Kedai Paw Coffee",
		"slug": "paw-coffee"
	}`)
	regReq := httptest.NewRequest(http.MethodPost, "/api/v1/tenants/register", bytes.NewReader(regPayload))
	regRec := httptest.NewRecorder()
	router.ServeHTTP(regRec, regReq)

	if regRec.Code != http.StatusCreated {
		t.Fatalf("expected 201 for tenant register, got %d: %s", regRec.Code, regRec.Body.String())
	}

	var regRes struct {
		Data struct {
			ID   string `json:"id"`
			Name string `json:"name"`
			Slug string `json:"slug"`
		} `json:"data"`
	}
	if err := json.NewDecoder(regRec.Body).Decode(&regRes); err != nil {
		t.Fatalf("decode tenant response failed: %v", err)
	}
	newTenantID := regRes.Data.ID
	if newTenantID == "" || regRes.Data.Slug != "paw-coffee" {
		t.Fatalf("unexpected registered tenant: %+v", regRes.Data)
	}

	// 3. GET /api/v1/tenants - list contains default store + newly registered store
	listReq := httptest.NewRequest(http.MethodGet, "/api/v1/tenants", nil)
	listRec := httptest.NewRecorder()
	router.ServeHTTP(listRec, listReq)
	if listRec.Code != http.StatusOK {
		t.Fatalf("expected 200 for tenant list, got %d", listRec.Code)
	}

	var tenantsList struct {
		Data []struct {
			ID   string `json:"id"`
			Slug string `json:"slug"`
		} `json:"data"`
	}
	_ = json.NewDecoder(listRec.Body).Decode(&tenantsList)
	if len(tenantsList.Data) < 2 {
		t.Fatalf("expected at least 2 tenants, got %d", len(tenantsList.Data))
	}

	// 4. Create product with X-Tenant-ID header
	prodPayload := []byte(`{
		"sku": "PAW-LATTE",
		"name": "Paw Signature Latte",
		"purchase_price_idr": 12000,
		"selling_price_idr": 25000,
		"base_unit": "cup",
		"minimum_stock": 5
	}`)
	createProdReq := httptest.NewRequest(http.MethodPost, "/api/v1/products", bytes.NewReader(prodPayload))
	createProdReq.Header.Set("X-Tenant-ID", newTenantID)
	createProdRec := httptest.NewRecorder()
	router.ServeHTTP(createProdRec, createProdReq)
	if createProdRec.Code != http.StatusCreated {
		t.Fatalf("expected 201 for product creation under new tenant, got %d: %s", createProdRec.Code, createProdRec.Body.String())
	}

	// 5. Query products under new tenant -> 1 product
	getProdReq := httptest.NewRequest(http.MethodGet, "/api/v1/products", nil)
	getProdReq.Header.Set("X-Tenant-ID", newTenantID)
	getProdRec := httptest.NewRecorder()
	router.ServeHTTP(getProdRec, getProdReq)
	var prodRes struct {
		Data []struct {
			SKU string `json:"sku"`
		} `json:"data"`
	}
	_ = json.NewDecoder(getProdRec.Body).Decode(&prodRes)
	if len(prodRes.Data) != 1 || prodRes.Data[0].SKU != "PAW-LATTE" {
		t.Fatalf("expected 1 product for new tenant, got %+v", prodRes.Data)
	}

	// 6. Query products under default tenant -> 0 products (completely isolated!)
	defProdReq := httptest.NewRequest(http.MethodGet, "/api/v1/products", nil)
	defProdRec := httptest.NewRecorder()
	router.ServeHTTP(defProdRec, defProdReq)
	var defRes struct {
		Data []struct {
			SKU string `json:"sku"`
		} `json:"data"`
	}
	_ = json.NewDecoder(defProdRec.Body).Decode(&defRes)
	if len(defRes.Data) != 0 {
		t.Fatalf("expected default tenant to have 0 products, got %d", len(defRes.Data))
	}
}

func TestRouterShiftsLifecycle(t *testing.T) {
	router := NewRouter(nil, nil, nil)

	// 1. Initial check: no open shift
	getCurRec := httptest.NewRecorder()
	getCurReq := httptest.NewRequest(http.MethodGet, "/api/v1/shifts/current", nil)
	router.ServeHTTP(getCurRec, getCurReq)
	if getCurRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for current shift check, got %d", getCurRec.Code)
	}

	// 2. Open shift with starting cash 150.000
	openPayload := []byte(`{
		"cashier_name": "Siti Rahma",
		"starting_cash_idr": 150000,
		"notes": "Modal awal kasir laci 1"
	}`)
	openRec := httptest.NewRecorder()
	openReq := httptest.NewRequest(http.MethodPost, "/api/v1/shifts/open", bytes.NewReader(openPayload))
	router.ServeHTTP(openRec, openReq)
	if openRec.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created for open shift, got %d: %s", openRec.Code, openRec.Body.String())
	}

	var openRes struct {
		Data struct {
			ID              string `json:"id"`
			Status          string `json:"status"`
			CashierName     string `json:"cashier_name"`
			StartingCashIDR int64  `json:"starting_cash_idr"`
		} `json:"data"`
	}
	_ = json.NewDecoder(openRec.Body).Decode(&openRes)
	if openRes.Data.Status != "open" || openRes.Data.StartingCashIDR != 150000 {
		t.Fatalf("unexpected shift data: %+v", openRes.Data)
	}

	// 3. Second open shift should conflict
	openRec2 := httptest.NewRecorder()
	openReq2 := httptest.NewRequest(http.MethodPost, "/api/v1/shifts/open", bytes.NewReader(openPayload))
	router.ServeHTTP(openRec2, openReq2)
	if openRec2.Code != http.StatusConflict {
		t.Fatalf("expected 409 Conflict when opening another shift, got %d", openRec2.Code)
	}

	// 4. Current shift should now return the open shift
	getCurRec2 := httptest.NewRecorder()
	getCurReq2 := httptest.NewRequest(http.MethodGet, "/api/v1/shifts/current", nil)
	router.ServeHTTP(getCurRec2, getCurReq2)
	if getCurRec2.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", getCurRec2.Code)
	}

	// 5. Close shift with physical cash 155.000 (Expected 150.000, Difference +5.000)
	closePayload := []byte(`{
		"actual_cash_idr": 155000,
		"notes": "Kas dihitung bersama supervisor"
	}`)
	closeRec := httptest.NewRecorder()
	closeReq := httptest.NewRequest(http.MethodPost, "/api/v1/shifts/close", bytes.NewReader(closePayload))
	router.ServeHTTP(closeRec, closeReq)
	if closeRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for close shift, got %d: %s", closeRec.Code, closeRec.Body.String())
	}

	var closeRes struct {
		Data struct {
			Status            string `json:"status"`
			ActualCashIDR     int64  `json:"actual_cash_idr"`
			ExpectedCashIDR   int64  `json:"expected_cash_idr"`
			CashDifferenceIDR int64  `json:"cash_difference_idr"`
		} `json:"data"`
	}
	_ = json.NewDecoder(closeRec.Body).Decode(&closeRes)
	if closeRes.Data.Status != "closed" || closeRes.Data.CashDifferenceIDR != 5000 {
		t.Fatalf("unexpected close shift result: %+v", closeRes.Data)
	}

	// 6. List shifts should show 1 closed shift
	listRec := httptest.NewRecorder()
	listReq := httptest.NewRequest(http.MethodGet, "/api/v1/shifts", nil)
	router.ServeHTTP(listRec, listReq)
	if listRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for list shifts, got %d", listRec.Code)
	}
}

func TestRouterAuthEndpoints(t *testing.T) {
	router := NewRouter(nil, nil, nil)

	// Test POST /api/v1/auth/login with demo credentials (memory seed)
	loginRec := httptest.NewRecorder()
	loginReq := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login",
		bytes.NewReader([]byte(`{"email":"kasir@pawpos.id","password":"kasir123"}`)))
	router.ServeHTTP(loginRec, loginReq)

	if loginRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", loginRec.Code, loginRec.Body.String())
	}
	var loginRes struct {
		Data struct {
			Token string `json:"token"`
			User  struct {
				Role string `json:"role"`
			} `json:"user"`
		} `json:"data"`
	}
	if err := json.NewDecoder(loginRec.Body).Decode(&loginRes); err != nil {
		t.Fatalf("failed to decode login json: %v", err)
	}
	if loginRes.Data.Token == "" || loginRes.Data.User.Role != "cashier" {
		t.Fatalf("unexpected login payload = %+v", loginRes.Data)
	}

	// Test POST /api/v1/auth/login with wrong password
	badRec := httptest.NewRecorder()
	badReq := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login",
		bytes.NewReader([]byte(`{"email":"kasir@pawpos.id","password":"salah"}`)))
	router.ServeHTTP(badRec, badReq)
	if badRec.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", badRec.Code)
	}

	// Test POST /api/v1/auth/pin
	pinRec := httptest.NewRecorder()
	pinReq := httptest.NewRequest(http.MethodPost, "/api/v1/auth/pin",
		bytes.NewReader([]byte(`{"role":"owner","pin":"9999"}`)))
	router.ServeHTTP(pinRec, pinReq)
	if pinRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for pin, got %d: %s", pinRec.Code, pinRec.Body.String())
	}

	// Test GET /api/v1/auth/me with token
	meRec := httptest.NewRecorder()
	meReq := httptest.NewRequest(http.MethodGet, "/api/v1/auth/me", nil)
	meReq.Header.Set("Authorization", "Bearer "+loginRes.Data.Token)
	router.ServeHTTP(meRec, meReq)
	if meRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for me, got %d: %s", meRec.Code, meRec.Body.String())
	}

	// Test POST /api/v1/auth/logout revokes the token
	logoutRec := httptest.NewRecorder()
	logoutReq := httptest.NewRequest(http.MethodPost, "/api/v1/auth/logout", nil)
	logoutReq.Header.Set("Authorization", "Bearer "+loginRes.Data.Token)
	router.ServeHTTP(logoutRec, logoutReq)
	if logoutRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for logout, got %d: %s", logoutRec.Code, logoutRec.Body.String())
	}

	meRec2 := httptest.NewRecorder()
	meReq2 := httptest.NewRequest(http.MethodGet, "/api/v1/auth/me", nil)
	meReq2.Header.Set("Authorization", "Bearer "+loginRes.Data.Token)
	router.ServeHTTP(meRec2, meReq2)
	if meRec2.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 after logout, got %d", meRec2.Code)
	}
}

func TestRouterCategoryEndpoints(t *testing.T) {
	router := NewRouter(nil, nil, nil)

	// Empty list initially (no dummy seeds)
	listRec := httptest.NewRecorder()
	listReq := httptest.NewRequest(http.MethodGet, "/api/v1/categories", nil)
	router.ServeHTTP(listRec, listReq)
	if listRec.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", listRec.Code)
	}
	var listRes struct {
		Data []map[string]interface{} `json:"data"`
	}
	if err := json.NewDecoder(listRec.Body).Decode(&listRes); err != nil {
		t.Fatalf("failed to decode json: %v", err)
	}
	if len(listRes.Data) != 0 {
		t.Fatalf("expected 0 categories, got %d", len(listRes.Data))
	}

	// Create a category
	createRec := httptest.NewRecorder()
	createReq := httptest.NewRequest(http.MethodPost, "/api/v1/categories",
		bytes.NewReader([]byte(`{"name":"Pakan Kucing"}`)))
	router.ServeHTTP(createRec, createReq)
	if createRec.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created, got %d: %s", createRec.Code, createRec.Body.String())
	}

	// Duplicate (case-insensitive) -> 409
	dupRec := httptest.NewRecorder()
	dupReq := httptest.NewRequest(http.MethodPost, "/api/v1/categories",
		bytes.NewReader([]byte(`{"name":"pakan kucing"}`)))
	router.ServeHTTP(dupRec, dupReq)
	if dupRec.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d", dupRec.Code)
	}

	// List shows the new category
	listRec2 := httptest.NewRecorder()
	listReq2 := httptest.NewRequest(http.MethodGet, "/api/v1/categories", nil)
	router.ServeHTTP(listRec2, listReq2)
	var listRes2 struct {
		Data []struct {
			Name string `json:"name"`
		} `json:"data"`
	}
	_ = json.NewDecoder(listRec2.Body).Decode(&listRes2)
	if len(listRes2.Data) != 1 || listRes2.Data[0].Name != "Pakan Kucing" {
		t.Fatalf("expected 1 category, got %+v", listRes2.Data)
	}
}

func TestRouterCustomerPetEndpoints(t *testing.T) {
	router := NewRouter(nil, nil, nil)

	// Create a customer
	createRec := httptest.NewRecorder()
	createReq := httptest.NewRequest(http.MethodPost, "/api/v1/customers",
		bytes.NewReader([]byte(`{"name":"Andi Wijaya","phone":"08123456789"}`)))
	router.ServeHTTP(createRec, createReq)
	if createRec.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created, got %d: %s", createRec.Code, createRec.Body.String())
	}
	var createRes struct {
		Data struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		} `json:"data"`
	}
	_ = json.NewDecoder(createRec.Body).Decode(&createRes)
	if createRes.Data.Name != "Andi Wijaya" {
		t.Fatalf("unexpected customer = %+v", createRes.Data)
	}

	// Validation: empty name -> 400
	badRec := httptest.NewRecorder()
	badReq := httptest.NewRequest(http.MethodPost, "/api/v1/customers",
		bytes.NewReader([]byte(`{"name":""}`)))
	router.ServeHTTP(badRec, badReq)
	if badRec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", badRec.Code)
	}

	// Create a pet for the customer
	petRec := httptest.NewRecorder()
	petReq := httptest.NewRequest(http.MethodPost, "/api/v1/pets",
		bytes.NewReader([]byte(`{"customer_id":"`+createRes.Data.ID+`","name":"Mochi","species":"Kucing","weight_kg":4.5}`)))
	router.ServeHTTP(petRec, petReq)
	if petRec.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created for pet, got %d: %s", petRec.Code, petRec.Body.String())
	}

	// Orphan pet -> 422
	orphanRec := httptest.NewRecorder()
	orphanReq := httptest.NewRequest(http.MethodPost, "/api/v1/pets",
		bytes.NewReader([]byte(`{"customer_id":"ghost","name":"X"}`)))
	router.ServeHTTP(orphanRec, orphanReq)
	if orphanRec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected 422, got %d", orphanRec.Code)
	}

	// List pets filtered by customer
	listRec := httptest.NewRecorder()
	listReq := httptest.NewRequest(http.MethodGet, "/api/v1/pets?customer_id="+createRes.Data.ID, nil)
	router.ServeHTTP(listRec, listReq)
	var listRes struct {
		Data []struct {
			Name         string `json:"name"`
			CustomerName string `json:"customer_name"`
		} `json:"data"`
	}
	_ = json.NewDecoder(listRec.Body).Decode(&listRes)
	if len(listRes.Data) != 1 || listRes.Data[0].CustomerName != "Andi Wijaya" {
		t.Fatalf("expected 1 pet with owner, got %+v", listRes.Data)
	}
}

func TestRouterServiceBookingFlow(t *testing.T) {
	router := NewRouter(nil, nil, nil)
	post := func(path, body string) (int, map[string]any) {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader([]byte(body)))
		router.ServeHTTP(rec, req)
		var payload map[string]any
		_ = json.NewDecoder(rec.Body).Decode(&payload)
		return rec.Code, payload
	}

	// Seed customer + pet + service
	code, custRes := post("/api/v1/customers", `{"name":"Budi","phone":"0800"}`)
	if code != http.StatusCreated {
		t.Fatalf("customer status = %d", code)
	}
	custID := custRes["data"].(map[string]any)["id"].(string)
	code, petRes := post("/api/v1/pets", `{"customer_id":"`+custID+`","name":"Kitty"}`)
	if code != http.StatusCreated {
		t.Fatalf("pet status = %d", code)
	}
	petID := petRes["data"].(map[string]any)["id"].(string)
	code, svcRes := post("/api/v1/services", `{"name":"Grooming Komplit","category":"grooming","price_idr":80000,"duration_minutes":60}`)
	if code != http.StatusCreated {
		t.Fatalf("service status = %d (%v)", code, svcRes)
	}
	svcID := svcRes["data"].(map[string]any)["id"].(string)

	// Duplicate service -> 409
	if code, _ := post("/api/v1/services", `{"name":"Grooming Komplit"}`); code != http.StatusConflict {
		t.Fatalf("dup service status = %d", code)
	}

	// Package with ghost service -> 422
	if code, _ := post("/api/v1/packages", `{"name":"Paket X","price_idr":100000,"items":[{"service_id":"ghost","sessions_included":2}]}`); code != http.StatusUnprocessableEntity {
		t.Fatalf("ghost package status = %d", code)
	}
	code, pkgRes := post("/api/v1/packages", `{"name":"Paket Grooming 2x","price_idr":150000,"items":[{"service_id":"`+svcID+`","sessions_included":2}]}`)
	if code != http.StatusCreated {
		t.Fatalf("package status = %d (%v)", code, pkgRes)
	}

	// Booking without service/package -> 422
	if code, _ := post("/api/v1/bookings", `{"customer_id":"`+custID+`","pet_id":"`+petID+`","location_id":"loc-main","scheduled_at":"2026-09-07T10:00:00Z"}`); code != http.StatusUnprocessableEntity {
		t.Fatalf("empty booking status = %d", code)
	}

	// Valid booking
	code, bookRes := post("/api/v1/bookings", `{"customer_id":"`+custID+`","pet_id":"`+petID+`","service_id":"`+svcID+`","location_id":"loc-main","scheduled_at":"2026-09-07T10:00:00Z"}`)
	if code != http.StatusCreated {
		t.Fatalf("booking status = %d (%v)", code, bookRes)
	}
	bookID := bookRes["data"].(map[string]any)["id"].(string)

	// antre -> proses
	if code, _ := post("/api/v1/bookings/"+bookID+"/status", `{"status":"proses"}`); code != http.StatusOK {
		t.Fatalf("proses status = %d", code)
	}

	// Complete with cash -> jasa order, no stock touched
	code, doneRes := post("/api/v1/bookings/"+bookID+"/complete", `{"payment_method":"cash","paid_amount_idr":80000}`)
	if code != http.StatusOK {
		t.Fatalf("complete status = %d (%v)", code, doneRes)
	}
	done := doneRes["data"].(map[string]any)
	booking := done["booking"].(map[string]any)
	order := done["order"].(map[string]any)
	if booking["status"] != "selesai" || booking["order_id"] == nil {
		t.Fatalf("booking not settled = %+v", booking)
	}
	items := order["items"].([]any)
	if len(items) != 1 || items[0].(map[string]any)["item_kind"] != "jasa" {
		t.Fatalf("order items = %+v", items)
	}
	if order["total_idr"].(float64) != 80000 {
		t.Fatalf("order total = %+v", order)
	}

	// Double complete -> 409
	if code, _ := post("/api/v1/bookings/"+bookID+"/complete", `{"payment_method":"cash","paid_amount_idr":80000}`); code != http.StatusConflict {
		t.Fatalf("double complete status = %d", code)
	}

	// Filter bookings by status
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/bookings?status=selesai", nil)
	router.ServeHTTP(rec, req)
	var listRes struct {
		Data []map[string]any `json:"data"`
	}
	_ = json.NewDecoder(rec.Body).Decode(&listRes)
	if len(listRes.Data) != 1 {
		t.Fatalf("expected 1 selesai booking, got %+v", listRes.Data)
	}
}

func TestRouterPromoEndpoints(t *testing.T) {
	router := NewRouter(nil, nil, nil)

	// 1. Create Promo
	createBody := []byte(`{
		"code": "TESTHEMAT10",
		"name": "Diskon Uji 10%",
		"kind": "percent",
		"value": 10,
		"min_spend": 50000,
		"max_discount": 20000,
		"quota": 10
	}`)
	createRec := httptest.NewRecorder()
	createReq := httptest.NewRequest(http.MethodPost, "/api/v1/promos", bytes.NewReader(createBody))
	createReq.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(createRec, createReq)
	if createRec.Code != http.StatusCreated {
		t.Fatalf("expected 201 for promo creation, got %d: %s", createRec.Code, createRec.Body.String())
	}

	var created struct {
		Data map[string]any `json:"data"`
	}
	_ = json.NewDecoder(createRec.Body).Decode(&created)
	promoID := created.Data["id"].(string)

	// 2. Validate Promo
	valBody := []byte(`{
		"code": "testhemat10",
		"subtotal_idr": 100000
	}`)
	valRec := httptest.NewRecorder()
	valReq := httptest.NewRequest(http.MethodPost, "/api/v1/promos/validate", bytes.NewReader(valBody))
	valReq.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(valRec, valReq)
	if valRec.Code != http.StatusOK {
		t.Fatalf("expected 200 for promo validation, got %d: %s", valRec.Code, valRec.Body.String())
	}

	var valRes struct {
		Data map[string]any `json:"data"`
	}
	_ = json.NewDecoder(valRec.Body).Decode(&valRes)
	if valRes.Data["discount_idr"].(float64) != 10000 {
		t.Fatalf("expected 10000 discount, got %v", valRes.Data["discount_idr"])
	}

	// 3. Pre-seed inventory for order
	seedBody := []byte(`{
		"product_id": "p-promo-1",
		"location_id": "loc-main",
		"quantity_delta": 20,
		"movement_type": "opening"
	}`)
	seedRec := httptest.NewRecorder()
	seedReq := httptest.NewRequest(http.MethodPost, "/api/v1/inventory/movements", bytes.NewReader(seedBody))
	router.ServeHTTP(seedRec, seedReq)

	// 4. Create Order with Promo Voucher
	orderBody := []byte(fmt.Sprintf(`{
		"location_id": "loc-main",
		"payment_method": "cash",
		"paid_amount_idr": 90000,
		"discount_idr": 10000,
		"promo_id": "%s",
		"promo_code": "TESTHEMAT10",
		"items": [
			{
				"product_id": "p-promo-1",
				"product_name": "Makanan Hewan",
				"sku": "PET-01",
				"unit_price_idr": 100000,
				"quantity": 1
			}
		]
	}`, promoID))
	orderRec := httptest.NewRecorder()
	orderReq := httptest.NewRequest(http.MethodPost, "/api/v1/orders", bytes.NewReader(orderBody))
	orderReq.Header.Set("Content-Type", "application/json")
	router.ServeHTTP(orderRec, orderReq)
	if orderRec.Code != http.StatusCreated {
		t.Fatalf("expected 201 for order creation with promo, got %d: %s", orderRec.Code, orderRec.Body.String())
	}

	var orderRes struct {
		Data map[string]any `json:"data"`
	}
	_ = json.NewDecoder(orderRec.Body).Decode(&orderRes)
	if orderRes.Data["promo_code"] != "TESTHEMAT10" {
		t.Fatalf("expected promo_code TESTHEMAT10, got %v", orderRes.Data["promo_code"])
	}
	if orderRes.Data["total_idr"].(float64) != 90000 {
		t.Fatalf("expected total 90000, got %v", orderRes.Data["total_idr"])
	}
}

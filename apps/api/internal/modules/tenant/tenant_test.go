package tenant

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
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

func TestTenantRegisterSuccess(t *testing.T) {
	repo := NewMemoryRepository()
	handler := NewHandler(repo)

	r := chi.NewRouter()
	r.Post("/api/v1/tenants/register", handler.Register)
	r.Get("/api/v1/tenants", handler.List)

	payload := RegisterTenantRequest{
		Name:     "Kopi Janji Senja",
		Slug:     "kopi-senja",
		PlanType: "starter",
	}
	body, _ := json.Marshal(payload)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/v1/tenants/register", bytes.NewReader(body)))

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created, got %d: %s", rec.Code, rec.Body.String())
	}

	var res EnvelopeResponse
	_ = json.NewDecoder(rec.Body).Decode(&res)
	var created Tenant
	_ = json.Unmarshal(res.Data, &created)

	if created.Name != "Kopi Janji Senja" || created.Slug != "kopi-senja" {
		t.Fatalf("unexpected created tenant: %+v", created)
	}

	// Verify it shows up in list
	listRec := httptest.NewRecorder()
	r.ServeHTTP(listRec, httptest.NewRequest(http.MethodGet, "/api/v1/tenants", nil))
	var listRes EnvelopeResponse
	_ = json.NewDecoder(listRec.Body).Decode(&listRes)
	var list []Tenant
	_ = json.Unmarshal(listRes.Data, &list)

	// Should have default tenant + newly created tenant
	if len(list) != 2 {
		t.Fatalf("expected 2 tenants in list, got %d", len(list))
	}
}

func TestTenantRegisterDuplicateSlug(t *testing.T) {
	repo := NewMemoryRepository()
	handler := NewHandler(repo)

	r := chi.NewRouter()
	r.Post("/api/v1/tenants/register", handler.Register)

	payload := RegisterTenantRequest{
		Name: "Toko Pertama",
		Slug: "toko-kembar",
	}
	body, _ := json.Marshal(payload)
	rec1 := httptest.NewRecorder()
	r.ServeHTTP(rec1, httptest.NewRequest(http.MethodPost, "/api/v1/tenants/register", bytes.NewReader(body)))
	if rec1.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created, got %d", rec1.Code)
	}

	// Second registration with duplicate slug
	payload2 := RegisterTenantRequest{
		Name: "Toko Kedua",
		Slug: "toko-kembar",
	}
	body2, _ := json.Marshal(payload2)
	rec2 := httptest.NewRecorder()
	r.ServeHTTP(rec2, httptest.NewRequest(http.MethodPost, "/api/v1/tenants/register", bytes.NewReader(body2)))

	if rec2.Code != http.StatusConflict {
		t.Fatalf("expected 409 Conflict, got %d", rec2.Code)
	}

	var res EnvelopeResponse
	_ = json.NewDecoder(rec2.Body).Decode(&res)
	if res.Error == nil || res.Error.Code != "TENANT_SLUG_EXISTS" {
		t.Fatalf("expected TENANT_SLUG_EXISTS code, got %+v", res.Error)
	}
}

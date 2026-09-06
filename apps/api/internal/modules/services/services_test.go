package services

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestMemoryServicePackageFlow(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := context.Background()

	svc, err := repo.CreateService(ctx, UpsertServiceRequest{
		Name: "Grooming Lengkap Kucing", Category: "GROOMING", PriceIDR: 75000, DurationMinutes: 90,
	})
	if err != nil {
		t.Fatalf("CreateService = %v", err)
	}
	if svc.Category != "grooming" {
		t.Fatalf("category not normalized = %#v", svc)
	}
	if _, err := repo.CreateService(ctx, UpsertServiceRequest{Name: "grooming lengkap kucing"}); err != ErrServiceExists {
		t.Fatalf("duplicate err = %v", err)
	}

	list, err := repo.ListServices(ctx, "grooming")
	if err != nil || len(list) != 1 {
		t.Fatalf("filter services = %+v, %v", list, err)
	}

	pkg, err := repo.CreatePackage(ctx, UpsertPackageRequest{
		Name: "Paket Grooming 3x", PriceIDR: 199000,
		Items: []PackageItemInput{{ServiceID: svc.ID, SessionsIncluded: 3}},
	})
	if err != nil {
		t.Fatalf("CreatePackage = %v", err)
	}
	if len(pkg.Items) != 1 || pkg.Items[0].ServiceName != "Grooming Lengkap Kucing" {
		t.Fatalf("package items = %#v", pkg)
	}

	if _, err := repo.CreatePackage(ctx, UpsertPackageRequest{Name: "Broken", Items: []PackageItemInput{{ServiceID: "ghost", SessionsIncluded: 1}}}); err != ErrServiceNotFound {
		t.Fatalf("ghost service err = %v", err)
	}

	got, err := repo.GetPackageByID(ctx, pkg.ID)
	if err != nil || got.PriceIDR != 199000 {
		t.Fatalf("get package = %#v, %v", got, err)
	}
	if _, err := repo.GetServiceByID(ctx, "nope"); err != ErrServiceNotFound {
		t.Fatalf("missing service err = %v", err)
	}
}

func TestHandlerServiceValidation(t *testing.T) {
	h := NewHandler(NewMemoryRepository())

	bad := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/services", bytes.NewReader([]byte(`{"name":"","category":"alien"}`)))
	h.CreateService(bad, req)
	if bad.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", bad.Code)
	}

	good := httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPost, "/api/v1/services", bytes.NewReader([]byte(`{"name":"Vaksin Rabies","category":"klinik","price_idr":120000}`)))
	h.CreateService(good, req)
	if good.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", good.Code, good.Body.String())
	}

	dup := httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPost, "/api/v1/services", bytes.NewReader([]byte(`{"name":"Vaksin Rabies"}`)))
	h.CreateService(dup, req)
	if dup.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d", dup.Code)
	}

	var payload map[string]any
	if err := json.Unmarshal(good.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if payload["request_id"] == nil {
		t.Fatalf("missing request_id in %v", payload)
	}
}

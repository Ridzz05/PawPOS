package products

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestMemoryCategoryRepository(t *testing.T) {
	repo := NewMemoryCategoryRepository()
	ctx := context.Background()

	list, err := repo.List(ctx)
	if err != nil || len(list) != 0 {
		t.Fatalf("empty list = %+v, %v", list, err)
	}

	created, err := repo.Create(ctx, CreateCategoryRequest{Name: "  Pakan Kucing  "})
	if err != nil {
		t.Fatalf("Create = %v", err)
	}
	if created.Name != "Pakan Kucing" || !created.IsActive {
		t.Fatalf("unexpected category = %#v", created)
	}

	if _, err := repo.Create(ctx, CreateCategoryRequest{Name: "pakan kucing"}); err != ErrCategoryExists {
		t.Fatalf("duplicate err = %v", err)
	}

	list, err = repo.List(ctx)
	if err != nil || len(list) != 1 {
		t.Fatalf("list after create = %+v, %v", list, err)
	}
}

func TestCategoryHandlerValidation(t *testing.T) {
	handler := NewCategoryHandler(NewMemoryCategoryRepository())

	// Empty name -> 400
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/categories", strings.NewReader(`{"name":""}`))
	handler.CreateCategory(rec, req)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rec.Code)
	}

	// Valid -> 201
	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPost, "/api/v1/categories", strings.NewReader(`{"name":"Grooming"}`))
	handler.CreateCategory(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}

	// Duplicate -> 409
	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPost, "/api/v1/categories", strings.NewReader(`{"name":"GROOMING"}`))
	handler.CreateCategory(rec, req)
	if rec.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d", rec.Code)
	}

	// List -> 200 with 1 item
	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/api/v1/categories", nil)
	handler.ListCategories(rec, req)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), "Grooming") {
		t.Fatalf("unexpected list: %d %s", rec.Code, rec.Body.String())
	}
}

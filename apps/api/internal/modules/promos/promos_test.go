package promos

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/muhri/ai-operational-pos/apps/api/internal/platform/tenantcontext"
)

func TestCalculateDiscount(t *testing.T) {
	now := time.Now().UTC()

	t.Run("valid percent discount without cap", func(t *testing.T) {
		promo := Promo{
			Kind:      "percent",
			Value:     10,
			IsActive:  true,
			StartsAt:  now.Add(-1 * time.Hour),
			EndsAt:    now.Add(24 * time.Hour),
			MinSpend:  50000,
			Quota:     10,
			UsedCount: 0,
		}
		discount, err := CalculateDiscount(promo, 100000)
		if err != nil {
			t.Fatalf("expected no error, got: %v", err)
		}
		if discount != 10000 {
			t.Fatalf("expected 10000, got: %d", discount)
		}
	})

	t.Run("percent discount with max_discount cap", func(t *testing.T) {
		promo := Promo{
			Kind:        "percent",
			Value:       50,
			MaxDiscount: 20000,
			IsActive:    true,
			StartsAt:    now.Add(-1 * time.Hour),
			EndsAt:      now.Add(24 * time.Hour),
			MinSpend:    10000,
		}
		discount, err := CalculateDiscount(promo, 100000)
		if err != nil {
			t.Fatalf("expected no error, got: %v", err)
		}
		if discount != 20000 {
			t.Fatalf("expected capped 20000, got: %d", discount)
		}
	})

	t.Run("nominal discount capped at subtotal", func(t *testing.T) {
		promo := Promo{
			Kind:     "nominal",
			Value:    50000,
			IsActive: true,
			StartsAt: now.Add(-1 * time.Hour),
			EndsAt:   now.Add(24 * time.Hour),
		}
		discount, err := CalculateDiscount(promo, 30000)
		if err != nil {
			t.Fatalf("expected no error, got: %v", err)
		}
		if discount != 30000 {
			t.Fatalf("expected 30000, got: %d", discount)
		}
	})

	t.Run("min spend not met", func(t *testing.T) {
		promo := Promo{
			Kind:     "percent",
			Value:    10,
			IsActive: true,
			StartsAt: now.Add(-1 * time.Hour),
			EndsAt:   now.Add(24 * time.Hour),
			MinSpend: 50000,
		}
		_, err := CalculateDiscount(promo, 40000)
		if err != ErrPromoMinSpendNotMet {
			t.Fatalf("expected ErrPromoMinSpendNotMet, got: %v", err)
		}
	})

	t.Run("quota exhausted", func(t *testing.T) {
		promo := Promo{
			Kind:      "nominal",
			Value:     10000,
			IsActive:  true,
			StartsAt:  now.Add(-1 * time.Hour),
			EndsAt:    now.Add(24 * time.Hour),
			Quota:     5,
			UsedCount: 5,
		}
		_, err := CalculateDiscount(promo, 50000)
		if err != ErrPromoQuotaExceeded {
			t.Fatalf("expected ErrPromoQuotaExceeded, got: %v", err)
		}
	})

	t.Run("inactive promo", func(t *testing.T) {
		promo := Promo{
			Kind:     "nominal",
			Value:    10000,
			IsActive: false,
			StartsAt: now.Add(-1 * time.Hour),
			EndsAt:   now.Add(24 * time.Hour),
		}
		_, err := CalculateDiscount(promo, 50000)
		if err != ErrPromoInactive {
			t.Fatalf("expected ErrPromoInactive, got: %v", err)
		}
	})

	t.Run("expired promo", func(t *testing.T) {
		promo := Promo{
			Kind:     "nominal",
			Value:    10000,
			IsActive: true,
			StartsAt: now.Add(-48 * time.Hour),
			EndsAt:   now.Add(-1 * time.Hour),
		}
		_, err := CalculateDiscount(promo, 50000)
		if err != ErrPromoExpired {
			t.Fatalf("expected ErrPromoExpired, got: %v", err)
		}
	})

	t.Run("not started promo", func(t *testing.T) {
		promo := Promo{
			Kind:     "nominal",
			Value:    10000,
			IsActive: true,
			StartsAt: now.Add(24 * time.Hour),
			EndsAt:   now.Add(48 * time.Hour),
		}
		_, err := CalculateDiscount(promo, 50000)
		if err != ErrPromoNotStarted {
			t.Fatalf("expected ErrPromoNotStarted, got: %v", err)
		}
	})
}

func TestMemoryRepository(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := tenantcontext.WithTenantID(context.Background(), "t-1")

	// 1. Create promo
	created, err := repo.CreatePromo(ctx, UpsertPromoRequest{
		Code:     "DISKON10",
		Name:     "Diskon 10%",
		Kind:     "percent",
		Value:    10,
		MinSpend: 20000,
		Quota:    2,
	})
	if err != nil {
		t.Fatalf("failed to create promo: %v", err)
	}
	if created.Code != "DISKON10" {
		t.Fatalf("expected code DISKON10, got: %s", created.Code)
	}

	// 2. Prevent duplicate code in same tenant
	_, err = repo.CreatePromo(ctx, UpsertPromoRequest{
		Code:  "diskon10",
		Kind:  "percent",
		Value: 5,
	})
	if err != ErrPromoCodeDuplicate {
		t.Fatalf("expected duplicate error, got: %v", err)
	}

	// 3. Different tenant can use same code
	ctx2 := tenantcontext.WithTenantID(context.Background(), "t-2")
	_, err = repo.CreatePromo(ctx2, UpsertPromoRequest{
		Code:  "diskon10",
		Kind:  "percent",
		Value: 5,
	})
	if err != nil {
		t.Fatalf("expected no error for different tenant, got: %v", err)
	}

	// 4. Validate promo
	valRes, err := repo.ValidatePromo(ctx, ValidatePromoRequest{
		Code:        "DISKON10",
		SubtotalIDR: 50000,
	})
	if err != nil {
		t.Fatalf("failed to validate promo: %v", err)
	}
	if valRes.DiscountIDR != 5000 {
		t.Fatalf("expected 5000 discount, got: %d", valRes.DiscountIDR)
	}

	// 5. Record redemption up to quota
	if err := repo.RecordRedemption(ctx, created.ID, "ord-1", 5000); err != nil {
		t.Fatalf("failed redemption 1: %v", err)
	}
	if err := repo.RecordRedemption(ctx, created.ID, "ord-2", 5000); err != nil {
		t.Fatalf("failed redemption 2: %v", err)
	}

	// 6. Quota exceeded on 3rd redemption
	err = repo.RecordRedemption(ctx, created.ID, "ord-3", 5000)
	if err != ErrPromoQuotaExceeded {
		t.Fatalf("expected ErrPromoQuotaExceeded, got: %v", err)
	}
}

func TestHandlerEndpoints(t *testing.T) {
	repo := NewMemoryRepository()
	h := NewHandler(repo)

	r := chi.NewRouter()
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			ctx := tenantcontext.WithTenantID(req.Context(), "tenant-test")
			next.ServeHTTP(w, req.WithContext(ctx))
		})
	})
	r.Get("/promos", h.List)
	r.Post("/promos", h.Create)
	r.Post("/promos/validate", h.Validate)

	// Create promo via POST
	body, _ := json.Marshal(UpsertPromoRequest{
		Code:     "HEBAT20",
		Name:     "Diskon 20%",
		Kind:     "percent",
		Value:    20,
		MinSpend: 10000,
		Quota:    50,
	})
	req := httptest.NewRequest("POST", "/promos", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}

	// Validate via POST /promos/validate
	valBody, _ := json.Marshal(ValidatePromoRequest{
		Code:        "hebat20",
		SubtotalIDR: 100000,
	})
	valReq := httptest.NewRequest("POST", "/promos/validate", bytes.NewReader(valBody))
	valRec := httptest.NewRecorder()
	r.ServeHTTP(valRec, valReq)
	if valRec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", valRec.Code, valRec.Body.String())
	}

	var valResp struct {
		Data ValidatePromoResponse `json:"data"`
	}
	_ = json.NewDecoder(valRec.Body).Decode(&valResp)
	if valResp.Data.DiscountIDR != 20000 {
		t.Fatalf("expected 20000, got %d", valResp.Data.DiscountIDR)
	}
}

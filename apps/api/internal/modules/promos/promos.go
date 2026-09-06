package promos

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
	"github.com/muhri/ai-operational-pos/apps/api/internal/platform/envelope"
	"github.com/muhri/ai-operational-pos/apps/api/internal/platform/tenantcontext"
)

var (
	ErrPromoNotFound       = errors.New("kode promo tidak ditemukan")
	ErrPromoInactive       = errors.New("kode promo sedang tidak aktif")
	ErrPromoNotStarted     = errors.New("periode promo belum dimulai")
	ErrPromoExpired        = errors.New("periode promo telah berakhir")
	ErrPromoQuotaExceeded  = errors.New("kuota pemakaian promo telah habis")
	ErrPromoMinSpendNotMet = errors.New("subtotal belanja belum memenuhi batas minimum promo")
	ErrPromoCodeDuplicate  = errors.New("kode promo sudah digunakan")
	ErrInvalidPromoKind    = errors.New("jenis promo tidak valid, gunakan percent atau nominal")
	ErrInvalidPromoValue   = errors.New("nilai diskon promo tidak valid")
	ErrInvalidPromoDates   = errors.New("tanggal mulai harus sebelum tanggal berakhir")
	ErrInvalidCode         = errors.New("kode promo wajib diisi")
)

type Promo struct {
	ID          string    `json:"id"`
	TenantID    string    `json:"tenant_id"`
	Code        string    `json:"code"`
	Name        string    `json:"name"`
	Kind        string    `json:"kind"` // "percent" | "nominal"
	Value       int64     `json:"value"`
	MinSpend    int64     `json:"min_spend"`
	MaxDiscount int64     `json:"max_discount"`
	Quota       int       `json:"quota"`
	UsedCount   int       `json:"used_count"`
	StartsAt    time.Time `json:"starts_at"`
	EndsAt      time.Time `json:"ends_at"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type PromoRedemption struct {
	ID              string    `json:"id"`
	TenantID        string    `json:"tenant_id"`
	PromoID         string    `json:"promo_id"`
	OrderID         string    `json:"order_id"`
	DiscountApplied int64     `json:"discount_applied"`
	RedeemedAt      time.Time `json:"redeemed_at"`
}

type UpsertPromoRequest struct {
	Code        string     `json:"code"`
	Name        string     `json:"name"`
	Kind        string     `json:"kind"`
	Value       int64      `json:"value"`
	MinSpend    int64      `json:"min_spend"`
	MaxDiscount int64      `json:"max_discount"`
	Quota       int        `json:"quota"`
	StartsAt    *time.Time `json:"starts_at,omitempty"`
	EndsAt      *time.Time `json:"ends_at,omitempty"`
	IsActive    *bool      `json:"is_active,omitempty"`
}

type ValidatePromoRequest struct {
	Code        string `json:"code"`
	SubtotalIDR int64  `json:"subtotal_idr"`
}

type ValidatePromoResponse struct {
	PromoID     string `json:"promo_id"`
	Code        string `json:"code"`
	Name        string `json:"name"`
	Kind        string `json:"kind"`
	Value       int64  `json:"value"`
	DiscountIDR int64  `json:"discount_idr"`
}

func CalculateDiscount(promo Promo, subtotal int64) (int64, error) {
	now := time.Now().UTC()
	if !promo.IsActive {
		return 0, ErrPromoInactive
	}
	if now.Before(promo.StartsAt) {
		return 0, ErrPromoNotStarted
	}
	if now.After(promo.EndsAt) {
		return 0, ErrPromoExpired
	}
	if promo.Quota > 0 && promo.UsedCount >= promo.Quota {
		return 0, ErrPromoQuotaExceeded
	}
	if promo.MinSpend > 0 && subtotal < promo.MinSpend {
		return 0, ErrPromoMinSpendNotMet
	}

	var discount int64
	switch promo.Kind {
	case "percent":
		discount = (subtotal * promo.Value) / 100
		if promo.MaxDiscount > 0 && discount > promo.MaxDiscount {
			discount = promo.MaxDiscount
		}
	case "nominal":
		discount = promo.Value
	default:
		return 0, ErrInvalidPromoKind
	}

	if discount > subtotal {
		discount = subtotal
	}
	if discount < 0 {
		discount = 0
	}
	return discount, nil
}

type Repository interface {
	ListPromos(ctx context.Context) ([]Promo, error)
	GetPromoByID(ctx context.Context, id string) (Promo, error)
	GetPromoByCode(ctx context.Context, code string) (Promo, error)
	CreatePromo(ctx context.Context, req UpsertPromoRequest) (Promo, error)
	UpdatePromo(ctx context.Context, id string, req UpsertPromoRequest) (Promo, error)
	DeletePromo(ctx context.Context, id string) error
	ValidatePromo(ctx context.Context, req ValidatePromoRequest) (ValidatePromoResponse, error)
	RecordRedemption(ctx context.Context, promoID string, orderID string, discountApplied int64) error
	RecordRedemptionTx(ctx context.Context, tx *sql.Tx, tenantID string, promoID string, orderID string, discountApplied int64) error
}

type MemoryRepository struct {
	mu          sync.RWMutex
	promos      []Promo
	redemptions []PromoRedemption
}

func NewMemoryRepository() *MemoryRepository {
	return &MemoryRepository{
		promos:      make([]Promo, 0),
		redemptions: make([]PromoRedemption, 0),
	}
}

func (m *MemoryRepository) ListPromos(ctx context.Context) ([]Promo, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	tenantID := tenantcontext.FromContext(ctx)

	result := make([]Promo, 0)
	for _, p := range m.promos {
		if p.TenantID == tenantID {
			result = append(result, p)
		}
	}
	return result, nil
}

func (m *MemoryRepository) GetPromoByID(ctx context.Context, id string) (Promo, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	tenantID := tenantcontext.FromContext(ctx)

	for _, p := range m.promos {
		if p.TenantID == tenantID && p.ID == id {
			return p, nil
		}
	}
	return Promo{}, ErrPromoNotFound
}

func (m *MemoryRepository) GetPromoByCode(ctx context.Context, code string) (Promo, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	tenantID := tenantcontext.FromContext(ctx)
	normalized := strings.ToUpper(strings.TrimSpace(code))

	for _, p := range m.promos {
		if p.TenantID == tenantID && strings.EqualFold(p.Code, normalized) {
			return p, nil
		}
	}
	return Promo{}, ErrPromoNotFound
}

func (m *MemoryRepository) CreatePromo(ctx context.Context, req UpsertPromoRequest) (Promo, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	tenantID := tenantcontext.FromContext(ctx)

	code := strings.ToUpper(strings.TrimSpace(req.Code))
	if code == "" {
		return Promo{}, ErrInvalidCode
	}
	if req.Kind != "percent" && req.Kind != "nominal" {
		return Promo{}, ErrInvalidPromoKind
	}
	if req.Value <= 0 || (req.Kind == "percent" && req.Value > 100) {
		return Promo{}, ErrInvalidPromoValue
	}

	for _, p := range m.promos {
		if p.TenantID == tenantID && strings.EqualFold(p.Code, code) {
			return Promo{}, ErrPromoCodeDuplicate
		}
	}

	now := time.Now().UTC()
	startsAt := now
	if req.StartsAt != nil {
		startsAt = req.StartsAt.UTC()
	}
	endsAt := now.AddDate(1, 0, 0)
	if req.EndsAt != nil {
		endsAt = req.EndsAt.UTC()
	}
	if endsAt.Before(startsAt) {
		return Promo{}, ErrInvalidPromoDates
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	promo := Promo{
		ID:          fmt.Sprintf("promo-%d", time.Now().UnixNano()),
		TenantID:    tenantID,
		Code:        code,
		Name:        strings.TrimSpace(req.Name),
		Kind:        req.Kind,
		Value:       req.Value,
		MinSpend:    req.MinSpend,
		MaxDiscount: req.MaxDiscount,
		Quota:       req.Quota,
		UsedCount:   0,
		StartsAt:    startsAt,
		EndsAt:      endsAt,
		IsActive:    isActive,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	m.promos = append(m.promos, promo)
	return promo, nil
}

func (m *MemoryRepository) UpdatePromo(ctx context.Context, id string, req UpsertPromoRequest) (Promo, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	tenantID := tenantcontext.FromContext(ctx)

	idx := -1
	for i, p := range m.promos {
		if p.TenantID == tenantID && p.ID == id {
			idx = i
			break
		}
	}
	if idx == -1 {
		return Promo{}, ErrPromoNotFound
	}

	code := strings.ToUpper(strings.TrimSpace(req.Code))
	if code == "" {
		return Promo{}, ErrInvalidCode
	}
	if req.Kind != "percent" && req.Kind != "nominal" {
		return Promo{}, ErrInvalidPromoKind
	}
	if req.Value <= 0 || (req.Kind == "percent" && req.Value > 100) {
		return Promo{}, ErrInvalidPromoValue
	}

	for i, p := range m.promos {
		if p.TenantID == tenantID && i != idx && strings.EqualFold(p.Code, code) {
			return Promo{}, ErrPromoCodeDuplicate
		}
	}

	now := time.Now().UTC()
	startsAt := m.promos[idx].StartsAt
	if req.StartsAt != nil {
		startsAt = req.StartsAt.UTC()
	}
	endsAt := m.promos[idx].EndsAt
	if req.EndsAt != nil {
		endsAt = req.EndsAt.UTC()
	}
	if endsAt.Before(startsAt) {
		return Promo{}, ErrInvalidPromoDates
	}

	isActive := m.promos[idx].IsActive
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	m.promos[idx].Code = code
	m.promos[idx].Name = strings.TrimSpace(req.Name)
	m.promos[idx].Kind = req.Kind
	m.promos[idx].Value = req.Value
	m.promos[idx].MinSpend = req.MinSpend
	m.promos[idx].MaxDiscount = req.MaxDiscount
	m.promos[idx].Quota = req.Quota
	m.promos[idx].StartsAt = startsAt
	m.promos[idx].EndsAt = endsAt
	m.promos[idx].IsActive = isActive
	m.promos[idx].UpdatedAt = now

	return m.promos[idx], nil
}

func (m *MemoryRepository) DeletePromo(ctx context.Context, id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	tenantID := tenantcontext.FromContext(ctx)

	idx := -1
	for i, p := range m.promos {
		if p.TenantID == tenantID && p.ID == id {
			idx = i
			break
		}
	}
	if idx == -1 {
		return ErrPromoNotFound
	}

	m.promos = append(m.promos[:idx], m.promos[idx+1:]...)
	return nil
}

func (m *MemoryRepository) ValidatePromo(ctx context.Context, req ValidatePromoRequest) (ValidatePromoResponse, error) {
	promo, err := m.GetPromoByCode(ctx, req.Code)
	if err != nil {
		return ValidatePromoResponse{}, err
	}

	discount, err := CalculateDiscount(promo, req.SubtotalIDR)
	if err != nil {
		return ValidatePromoResponse{}, err
	}

	return ValidatePromoResponse{
		PromoID:     promo.ID,
		Code:        promo.Code,
		Name:        promo.Name,
		Kind:        promo.Kind,
		Value:       promo.Value,
		DiscountIDR: discount,
	}, nil
}

func (m *MemoryRepository) RecordRedemption(ctx context.Context, promoID string, orderID string, discountApplied int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	tenantID := tenantcontext.FromContext(ctx)

	for i, p := range m.promos {
		if p.TenantID == tenantID && p.ID == promoID {
			if p.Quota > 0 && p.UsedCount >= p.Quota {
				return ErrPromoQuotaExceeded
			}
			m.promos[i].UsedCount++
			m.redemptions = append(m.redemptions, PromoRedemption{
				ID:              fmt.Sprintf("red-%d", time.Now().UnixNano()),
				TenantID:        tenantID,
				PromoID:         promoID,
				OrderID:         orderID,
				DiscountApplied: discountApplied,
				RedeemedAt:      time.Now().UTC(),
			})
			return nil
		}
	}
	return ErrPromoNotFound
}

func (m *MemoryRepository) RecordRedemptionTx(ctx context.Context, tx *sql.Tx, tenantID string, promoID string, orderID string, discountApplied int64) error {
	return m.RecordRedemption(ctx, promoID, orderID, discountApplied)
}

type PostgresRepository struct {
	db *sql.DB
}

func NewPostgresRepository(db *sql.DB) *PostgresRepository {
	return &PostgresRepository{db: db}
}

func (p *PostgresRepository) ListPromos(ctx context.Context) ([]Promo, error) {
	tenantID := tenantcontext.FromContext(ctx)
	rows, err := p.db.QueryContext(ctx, `
		SELECT id, tenant_id, code, name, kind, value, min_spend, max_discount, quota, used_count, starts_at, ends_at, is_active, created_at, updated_at
		FROM promos
		WHERE tenant_id = $1
		ORDER BY created_at DESC`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("list promos query failed: %w", err)
	}
	defer rows.Close()

	var result []Promo
	for rows.Next() {
		var promo Promo
		if err := rows.Scan(
			&promo.ID, &promo.TenantID, &promo.Code, &promo.Name, &promo.Kind, &promo.Value,
			&promo.MinSpend, &promo.MaxDiscount, &promo.Quota, &promo.UsedCount,
			&promo.StartsAt, &promo.EndsAt, &promo.IsActive, &promo.CreatedAt, &promo.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan promo failed: %w", err)
		}
		result = append(result, promo)
	}
	return result, nil
}

func (p *PostgresRepository) GetPromoByID(ctx context.Context, id string) (Promo, error) {
	tenantID := tenantcontext.FromContext(ctx)
	var promo Promo
	err := p.db.QueryRowContext(ctx, `
		SELECT id, tenant_id, code, name, kind, value, min_spend, max_discount, quota, used_count, starts_at, ends_at, is_active, created_at, updated_at
		FROM promos
		WHERE tenant_id = $1 AND id = $2`, tenantID, id).Scan(
		&promo.ID, &promo.TenantID, &promo.Code, &promo.Name, &promo.Kind, &promo.Value,
		&promo.MinSpend, &promo.MaxDiscount, &promo.Quota, &promo.UsedCount,
		&promo.StartsAt, &promo.EndsAt, &promo.IsActive, &promo.CreatedAt, &promo.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return Promo{}, ErrPromoNotFound
	} else if err != nil {
		return Promo{}, fmt.Errorf("get promo query failed: %w", err)
	}
	return promo, nil
}

func (p *PostgresRepository) GetPromoByCode(ctx context.Context, code string) (Promo, error) {
	tenantID := tenantcontext.FromContext(ctx)
	normalized := strings.ToUpper(strings.TrimSpace(code))
	var promo Promo
	err := p.db.QueryRowContext(ctx, `
		SELECT id, tenant_id, code, name, kind, value, min_spend, max_discount, quota, used_count, starts_at, ends_at, is_active, created_at, updated_at
		FROM promos
		WHERE tenant_id = $1 AND UPPER(code) = $2`, tenantID, normalized).Scan(
		&promo.ID, &promo.TenantID, &promo.Code, &promo.Name, &promo.Kind, &promo.Value,
		&promo.MinSpend, &promo.MaxDiscount, &promo.Quota, &promo.UsedCount,
		&promo.StartsAt, &promo.EndsAt, &promo.IsActive, &promo.CreatedAt, &promo.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return Promo{}, ErrPromoNotFound
	} else if err != nil {
		return Promo{}, fmt.Errorf("get promo by code query failed: %w", err)
	}
	return promo, nil
}

func (p *PostgresRepository) CreatePromo(ctx context.Context, req UpsertPromoRequest) (Promo, error) {
	tenantID := tenantcontext.FromContext(ctx)
	code := strings.ToUpper(strings.TrimSpace(req.Code))
	if code == "" {
		return Promo{}, ErrInvalidCode
	}
	if req.Kind != "percent" && req.Kind != "nominal" {
		return Promo{}, ErrInvalidPromoKind
	}
	if req.Value <= 0 || (req.Kind == "percent" && req.Value > 100) {
		return Promo{}, ErrInvalidPromoValue
	}

	now := time.Now().UTC()
	startsAt := now
	if req.StartsAt != nil {
		startsAt = req.StartsAt.UTC()
	}
	endsAt := now.AddDate(1, 0, 0)
	if req.EndsAt != nil {
		endsAt = req.EndsAt.UTC()
	}
	if endsAt.Before(startsAt) {
		return Promo{}, ErrInvalidPromoDates
	}

	isActive := true
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	var promo Promo
	err := p.db.QueryRowContext(ctx, `
		INSERT INTO promos (tenant_id, code, name, kind, value, min_spend, max_discount, quota, used_count, starts_at, ends_at, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9, $10, $11, $12, $12)
		RETURNING id, tenant_id, code, name, kind, value, min_spend, max_discount, quota, used_count, starts_at, ends_at, is_active, created_at, updated_at`,
		tenantID, code, strings.TrimSpace(req.Name), req.Kind, req.Value, req.MinSpend, req.MaxDiscount, req.Quota, startsAt, endsAt, isActive, now,
	).Scan(
		&promo.ID, &promo.TenantID, &promo.Code, &promo.Name, &promo.Kind, &promo.Value,
		&promo.MinSpend, &promo.MaxDiscount, &promo.Quota, &promo.UsedCount,
		&promo.StartsAt, &promo.EndsAt, &promo.IsActive, &promo.CreatedAt, &promo.UpdatedAt,
	)
	if err != nil {
		if strings.Contains(err.Error(), "promos_tenant_code_unique") || strings.Contains(err.Error(), "duplicate key") {
			return Promo{}, ErrPromoCodeDuplicate
		}
		return Promo{}, fmt.Errorf("insert promo failed: %w", err)
	}
	return promo, nil
}

func (p *PostgresRepository) UpdatePromo(ctx context.Context, id string, req UpsertPromoRequest) (Promo, error) {
	tenantID := tenantcontext.FromContext(ctx)
	code := strings.ToUpper(strings.TrimSpace(req.Code))
	if code == "" {
		return Promo{}, ErrInvalidCode
	}
	if req.Kind != "percent" && req.Kind != "nominal" {
		return Promo{}, ErrInvalidPromoKind
	}
	if req.Value <= 0 || (req.Kind == "percent" && req.Value > 100) {
		return Promo{}, ErrInvalidPromoValue
	}

	current, err := p.GetPromoByID(ctx, id)
	if err != nil {
		return Promo{}, err
	}

	now := time.Now().UTC()
	startsAt := current.StartsAt
	if req.StartsAt != nil {
		startsAt = req.StartsAt.UTC()
	}
	endsAt := current.EndsAt
	if req.EndsAt != nil {
		endsAt = req.EndsAt.UTC()
	}
	if endsAt.Before(startsAt) {
		return Promo{}, ErrInvalidPromoDates
	}

	isActive := current.IsActive
	if req.IsActive != nil {
		isActive = *req.IsActive
	}

	var promo Promo
	err = p.db.QueryRowContext(ctx, `
		UPDATE promos
		SET code = $1, name = $2, kind = $3, value = $4, min_spend = $5, max_discount = $6, quota = $7, starts_at = $8, ends_at = $9, is_active = $10, updated_at = $11
		WHERE tenant_id = $12 AND id = $13
		RETURNING id, tenant_id, code, name, kind, value, min_spend, max_discount, quota, used_count, starts_at, ends_at, is_active, created_at, updated_at`,
		code, strings.TrimSpace(req.Name), req.Kind, req.Value, req.MinSpend, req.MaxDiscount, req.Quota, startsAt, endsAt, isActive, now, tenantID, id,
	).Scan(
		&promo.ID, &promo.TenantID, &promo.Code, &promo.Name, &promo.Kind, &promo.Value,
		&promo.MinSpend, &promo.MaxDiscount, &promo.Quota, &promo.UsedCount,
		&promo.StartsAt, &promo.EndsAt, &promo.IsActive, &promo.CreatedAt, &promo.UpdatedAt,
	)
	if err != nil {
		if strings.Contains(err.Error(), "promos_tenant_code_unique") || strings.Contains(err.Error(), "duplicate key") {
			return Promo{}, ErrPromoCodeDuplicate
		}
		return Promo{}, fmt.Errorf("update promo failed: %w", err)
	}
	return promo, nil
}

func (p *PostgresRepository) DeletePromo(ctx context.Context, id string) error {
	tenantID := tenantcontext.FromContext(ctx)
	res, err := p.db.ExecContext(ctx, `DELETE FROM promos WHERE tenant_id = $1 AND id = $2`, tenantID, id)
	if err != nil {
		return fmt.Errorf("delete promo failed: %w", err)
	}
	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("check rows affected failed: %w", err)
	}
	if rowsAffected == 0 {
		return ErrPromoNotFound
	}
	return nil
}

func (p *PostgresRepository) ValidatePromo(ctx context.Context, req ValidatePromoRequest) (ValidatePromoResponse, error) {
	promo, err := p.GetPromoByCode(ctx, req.Code)
	if err != nil {
		return ValidatePromoResponse{}, err
	}

	discount, err := CalculateDiscount(promo, req.SubtotalIDR)
	if err != nil {
		return ValidatePromoResponse{}, err
	}

	return ValidatePromoResponse{
		PromoID:     promo.ID,
		Code:        promo.Code,
		Name:        promo.Name,
		Kind:        promo.Kind,
		Value:       promo.Value,
		DiscountIDR: discount,
	}, nil
}

func (p *PostgresRepository) RecordRedemption(ctx context.Context, promoID string, orderID string, discountApplied int64) error {
	tenantID := tenantcontext.FromContext(ctx)
	tx, err := p.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if err := p.RecordRedemptionTx(ctx, tx, tenantID, promoID, orderID, discountApplied); err != nil {
		return err
	}
	return tx.Commit()
}

func (p *PostgresRepository) RecordRedemptionTx(ctx context.Context, tx *sql.Tx, tenantID string, promoID string, orderID string, discountApplied int64) error {
	var quota, usedCount int
	var isActive bool
	var startsAt, endsAt time.Time

	err := tx.QueryRowContext(ctx, `
		SELECT quota, used_count, is_active, starts_at, ends_at
		FROM promos
		WHERE tenant_id = $1 AND id = $2
		FOR UPDATE`, tenantID, promoID).Scan(&quota, &usedCount, &isActive, &startsAt, &endsAt)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrPromoNotFound
	} else if err != nil {
		return fmt.Errorf("lock promo failed: %w", err)
	}

	now := time.Now().UTC()
	if !isActive {
		return ErrPromoInactive
	}
	if now.Before(startsAt) {
		return ErrPromoNotStarted
	}
	if now.After(endsAt) {
		return ErrPromoExpired
	}
	if quota > 0 && usedCount >= quota {
		return ErrPromoQuotaExceeded
	}

	_, err = tx.ExecContext(ctx, `
		UPDATE promos
		SET used_count = used_count + 1, updated_at = now()
		WHERE tenant_id = $1 AND id = $2`, tenantID, promoID)
	if err != nil {
		return fmt.Errorf("increment used_count failed: %w", err)
	}

	_, err = tx.ExecContext(ctx, `
		INSERT INTO promo_redemptions (tenant_id, promo_id, order_id, discount_applied, redeemed_at)
		VALUES ($1, $2, $3, $4, now())`, tenantID, promoID, orderID, discountApplied)
	if err != nil {
		return fmt.Errorf("insert promo_redemption failed: %w", err)
	}

	return nil
}

type Handler struct {
	repo Repository
}

func NewHandler(repo Repository) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	promos, err := h.repo.ListPromos(r.Context())
	if err != nil {
		envelope.WriteError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Gagal memuat daftar promo", nil)
		return
	}
	if promos == nil {
		promos = make([]Promo, 0)
	}
	envelope.Write(w, r, http.StatusOK, promos)
}

func (h *Handler) GetByID(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	promo, err := h.repo.GetPromoByID(r.Context(), id)
	if errors.Is(err, ErrPromoNotFound) {
		envelope.WriteError(w, r, http.StatusNotFound, "NOT_FOUND", "Promo tidak ditemukan", nil)
		return
	} else if err != nil {
		envelope.WriteError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Gagal mengambil data promo", nil)
		return
	}
	envelope.Write(w, r, http.StatusOK, promo)
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var req UpsertPromoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		envelope.WriteError(w, r, http.StatusBadRequest, "INVALID_REQUEST", "Format request tidak valid", nil)
		return
	}

	promo, err := h.repo.CreatePromo(r.Context(), req)
	if errors.Is(err, ErrPromoCodeDuplicate) {
		envelope.WriteError(w, r, http.StatusConflict, "DUPLICATE_CODE", "Kode promo sudah terdaftar", nil)
		return
	} else if errors.Is(err, ErrInvalidCode) || errors.Is(err, ErrInvalidPromoKind) || errors.Is(err, ErrInvalidPromoValue) || errors.Is(err, ErrInvalidPromoDates) {
		envelope.WriteError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", err.Error(), nil)
		return
	} else if err != nil {
		envelope.WriteError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Gagal menambahkan promo", nil)
		return
	}

	envelope.Write(w, r, http.StatusCreated, promo)
}

func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req UpsertPromoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		envelope.WriteError(w, r, http.StatusBadRequest, "INVALID_REQUEST", "Format request tidak valid", nil)
		return
	}

	promo, err := h.repo.UpdatePromo(r.Context(), id, req)
	if errors.Is(err, ErrPromoNotFound) {
		envelope.WriteError(w, r, http.StatusNotFound, "NOT_FOUND", "Promo tidak ditemukan", nil)
		return
	} else if errors.Is(err, ErrPromoCodeDuplicate) {
		envelope.WriteError(w, r, http.StatusConflict, "DUPLICATE_CODE", "Kode promo sudah terdaftar", nil)
		return
	} else if errors.Is(err, ErrInvalidCode) || errors.Is(err, ErrInvalidPromoKind) || errors.Is(err, ErrInvalidPromoValue) || errors.Is(err, ErrInvalidPromoDates) {
		envelope.WriteError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", err.Error(), nil)
		return
	} else if err != nil {
		envelope.WriteError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Gagal memperbarui promo", nil)
		return
	}

	envelope.Write(w, r, http.StatusOK, promo)
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	err := h.repo.DeletePromo(r.Context(), id)
	if errors.Is(err, ErrPromoNotFound) {
		envelope.WriteError(w, r, http.StatusNotFound, "NOT_FOUND", "Promo tidak ditemukan", nil)
		return
	} else if err != nil {
		envelope.WriteError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Gagal menghapus promo", nil)
		return
	}

	envelope.Write(w, r, http.StatusOK, map[string]string{"message": "Promo berhasil dihapus"})
}

func (h *Handler) Validate(w http.ResponseWriter, r *http.Request) {
	var req ValidatePromoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		envelope.WriteError(w, r, http.StatusBadRequest, "INVALID_REQUEST", "Format request validasi tidak valid", nil)
		return
	}

	res, err := h.repo.ValidatePromo(r.Context(), req)
	if errors.Is(err, ErrPromoNotFound) {
		envelope.WriteError(w, r, http.StatusNotFound, "PROMO_NOT_FOUND", "Kode promo tidak ditemukan", nil)
		return
	} else if errors.Is(err, ErrPromoInactive) || errors.Is(err, ErrPromoNotStarted) || errors.Is(err, ErrPromoExpired) || errors.Is(err, ErrPromoQuotaExceeded) || errors.Is(err, ErrPromoMinSpendNotMet) {
		envelope.WriteError(w, r, http.StatusBadRequest, "PROMO_INVALID", err.Error(), nil)
		return
	} else if err != nil {
		envelope.WriteError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Gagal memvalidasi promo", nil)
		return
	}

	envelope.Write(w, r, http.StatusOK, res)
}

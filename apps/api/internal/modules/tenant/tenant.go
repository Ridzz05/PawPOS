package tenant

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/muhri/ai-operational-pos/apps/api/internal/platform/envelope"
	"github.com/muhri/ai-operational-pos/apps/api/internal/platform/tenantcontext"
)

var (
	ErrTenantNotFound = errors.New("tenant not found")
	ErrSlugExists     = errors.New("tenant slug already exists")
)

// Tenant represents a merchant organization on the SaaS platform.
type Tenant struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Slug      string    `json:"slug"`
	PlanType  string    `json:"plan_type"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// RegisterTenantRequest defines payload to register a new merchant tenant.
type RegisterTenantRequest struct {
	Name     string `json:"name"`
	Slug     string `json:"slug"`
	PlanType string `json:"plan_type,omitempty"`
}

// Repository defines data access for tenants.
type Repository interface {
	Create(ctx context.Context, req RegisterTenantRequest) (Tenant, error)
	GetByID(ctx context.Context, id string) (Tenant, error)
	GetBySlug(ctx context.Context, slug string) (Tenant, error)
	List(ctx context.Context) ([]Tenant, error)
}

// MemoryRepository provides thread-safe in-memory storage for tenants.
type MemoryRepository struct {
	mu      sync.RWMutex
	tenants []Tenant
}

func NewMemoryRepository() *MemoryRepository {
	now := time.Now().UTC()
	return &MemoryRepository{
		tenants: []Tenant{
			{
				ID:        tenantcontext.DefaultTenantID,
				Name:      "Default Store",
				Slug:      "default-store",
				PlanType:  "starter",
				IsActive:  true,
				CreatedAt: now,
				UpdatedAt: now,
			},
		},
	}
}

func (m *MemoryRepository) Create(_ context.Context, req RegisterTenantRequest) (Tenant, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	for _, t := range m.tenants {
		if strings.EqualFold(t.Slug, req.Slug) {
			return Tenant{}, ErrSlugExists
		}
	}

	plan := req.PlanType
	if plan == "" {
		plan = "starter"
	}

	now := time.Now().UTC()
	t := Tenant{
		ID:        fmt.Sprintf("tenant-%d", len(m.tenants)+1),
		Name:      req.Name,
		Slug:      req.Slug,
		PlanType:  plan,
		IsActive:  true,
		CreatedAt: now,
		UpdatedAt: now,
	}

	m.tenants = append(m.tenants, t)
	return t, nil
}

func (m *MemoryRepository) GetByID(_ context.Context, id string) (Tenant, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, t := range m.tenants {
		if t.ID == id {
			return t, nil
		}
	}
	return Tenant{}, ErrTenantNotFound
}

func (m *MemoryRepository) GetBySlug(_ context.Context, slug string) (Tenant, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, t := range m.tenants {
		if strings.EqualFold(t.Slug, slug) {
			return t, nil
		}
	}
	return Tenant{}, ErrTenantNotFound
}

func (m *MemoryRepository) List(_ context.Context) ([]Tenant, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make([]Tenant, len(m.tenants))
	copy(result, m.tenants)
	return result, nil
}

// PostgresRepository manages tenants in PostgreSQL database.
type PostgresRepository struct {
	db *sql.DB
}

func NewPostgresRepository(db *sql.DB) *PostgresRepository {
	return &PostgresRepository{db: db}
}

func (p *PostgresRepository) Create(ctx context.Context, req RegisterTenantRequest) (Tenant, error) {
	plan := req.PlanType
	if plan == "" {
		plan = "starter"
	}

	query := `
		INSERT INTO tenants (name, slug, plan_type, is_active)
		VALUES ($1, $2, $3, TRUE)
		RETURNING id, name, slug, plan_type, is_active, created_at, updated_at
	`
	var t Tenant
	err := p.db.QueryRowContext(ctx, query, req.Name, req.Slug, plan).Scan(
		&t.ID,
		&t.Name,
		&t.Slug,
		&t.PlanType,
		&t.IsActive,
		&t.CreatedAt,
		&t.UpdatedAt,
	)
	if err != nil {
		if strings.Contains(err.Error(), "unique constraint") || strings.Contains(err.Error(), "duplicate key") {
			return Tenant{}, ErrSlugExists
		}
		return Tenant{}, fmt.Errorf("insert tenant: %w", err)
	}
	return t, nil
}

func (p *PostgresRepository) GetByID(ctx context.Context, id string) (Tenant, error) {
	query := `
		SELECT id, name, slug, plan_type, is_active, created_at, updated_at
		FROM tenants
		WHERE id = $1
	`
	var t Tenant
	err := p.db.QueryRowContext(ctx, query, id).Scan(
		&t.ID,
		&t.Name,
		&t.Slug,
		&t.PlanType,
		&t.IsActive,
		&t.CreatedAt,
		&t.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return Tenant{}, ErrTenantNotFound
	}
	if err != nil {
		return Tenant{}, fmt.Errorf("query tenant by id: %w", err)
	}
	return t, nil
}

func (p *PostgresRepository) GetBySlug(ctx context.Context, slug string) (Tenant, error) {
	query := `
		SELECT id, name, slug, plan_type, is_active, created_at, updated_at
		FROM tenants
		WHERE slug = $1
	`
	var t Tenant
	err := p.db.QueryRowContext(ctx, query, slug).Scan(
		&t.ID,
		&t.Name,
		&t.Slug,
		&t.PlanType,
		&t.IsActive,
		&t.CreatedAt,
		&t.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return Tenant{}, ErrTenantNotFound
	}
	if err != nil {
		return Tenant{}, fmt.Errorf("query tenant by slug: %w", err)
	}
	return t, nil
}

func (p *PostgresRepository) List(ctx context.Context) ([]Tenant, error) {
	query := `
		SELECT id, name, slug, plan_type, is_active, created_at, updated_at
		FROM tenants
		WHERE is_active = TRUE
		ORDER BY created_at ASC
	`
	rows, err := p.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("query tenants list: %w", err)
	}
	defer rows.Close()

	tenants := make([]Tenant, 0)
	for rows.Next() {
		var t Tenant
		if err := rows.Scan(
			&t.ID,
			&t.Name,
			&t.Slug,
			&t.PlanType,
			&t.IsActive,
			&t.CreatedAt,
			&t.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan tenant: %w", err)
		}
		tenants = append(tenants, t)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate tenants: %w", err)
	}
	return tenants, nil
}

// Handler handles HTTP requests for tenant lifecycle.
type Handler struct {
	repo Repository
}

func NewHandler(repo Repository) *Handler {
	return &Handler{repo: repo}
}

var slugRegex = regexp.MustCompile(`^[a-z0-9-]+$`)

// Register handles POST /api/v1/tenants/register
func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var req RegisterTenantRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		envelope.WriteError(w, r, http.StatusBadRequest, "INVALID_REQUEST", "Request payload must be valid JSON.", nil)
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	req.Slug = strings.ToLower(strings.TrimSpace(req.Slug))

	details := make(map[string]string)
	if req.Name == "" {
		details["name"] = "Nama toko / merchant wajib diisi."
	}
	if req.Slug == "" {
		details["slug"] = "Slug subdomain / identifier toko wajib diisi."
	} else if !slugRegex.MatchString(req.Slug) {
		details["slug"] = "Slug hanya boleh berupa huruf kecil, angka, dan tanda hubung (-)."
	}

	if len(details) > 0 {
		envelope.WriteError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "Data pendaftaran toko tidak valid.", details)
		return
	}

	created, err := h.repo.Create(r.Context(), req)
	if err != nil {
		if errors.Is(err, ErrSlugExists) {
			envelope.WriteError(w, r, http.StatusConflict, "TENANT_SLUG_EXISTS", "Slug atau nama toko sudah digunakan.", map[string]string{"slug": req.Slug})
			return
		}
		envelope.WriteError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Gagal mendaftarkan toko baru.", nil)
		return
	}

	envelope.Write(w, r, http.StatusCreated, created)
}

// List handles GET /api/v1/tenants
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	list, err := h.repo.List(r.Context())
	if err != nil {
		envelope.WriteError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Gagal memuat daftar toko.", nil)
		return
	}
	if list == nil {
		list = make([]Tenant, 0)
	}
	envelope.Write(w, r, http.StatusOK, list)
}

// GetByID handles GET /api/v1/tenants/{id}
func (h *Handler) GetByID(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		envelope.WriteError(w, r, http.StatusBadRequest, "INVALID_REQUEST", "ID toko wajib disertakan.", nil)
		return
	}

	t, err := h.repo.GetByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, ErrTenantNotFound) {
			envelope.WriteError(w, r, http.StatusNotFound, "TENANT_NOT_FOUND", "Toko tidak ditemukan.", nil)
			return
		}
		envelope.WriteError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Gagal memuat data toko.", nil)
		return
	}

	envelope.Write(w, r, http.StatusOK, t)
}

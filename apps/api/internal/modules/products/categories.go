package products

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

	"github.com/muhri/ai-operational-pos/apps/api/internal/platform/envelope"
	"github.com/muhri/ai-operational-pos/apps/api/internal/platform/tenantcontext"
)

var (
	ErrCategoryNotFound = errors.New("category not found")
	ErrCategoryExists   = errors.New("category already exists")
)

// Category represents a product grouping owned by a tenant.
type Category struct {
	ID          string    `json:"id"`
	TenantID    string    `json:"tenant_id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// CreateCategoryRequest defines the payload to register a new category.
type CreateCategoryRequest struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
}

// CategoryRepository defines data access for product categories.
type CategoryRepository interface {
	List(ctx context.Context) ([]Category, error)
	Create(ctx context.Context, req CreateCategoryRequest) (Category, error)
}

// MemoryCategoryRepository provides thread-safe in-memory category storage.
type MemoryCategoryRepository struct {
	mu         sync.RWMutex
	categories []Category
}

func NewMemoryCategoryRepository() *MemoryCategoryRepository {
	return &MemoryCategoryRepository{
		categories: make([]Category, 0),
	}
}

func (m *MemoryCategoryRepository) List(ctx context.Context) ([]Category, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	tenantID := tenantcontext.FromContext(ctx)
	result := make([]Category, 0, len(m.categories))
	for _, c := range m.categories {
		if c.TenantID == tenantID && c.IsActive {
			result = append(result, c)
		}
	}
	return result, nil
}

func (m *MemoryCategoryRepository) Create(ctx context.Context, req CreateCategoryRequest) (Category, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	tenantID := tenantcontext.FromContext(ctx)
	name := strings.TrimSpace(req.Name)
	for _, c := range m.categories {
		if c.TenantID == tenantID && strings.EqualFold(c.Name, name) && c.IsActive {
			return Category{}, ErrCategoryExists
		}
	}

	now := time.Now().UTC()
	cat := Category{
		ID:          fmt.Sprintf("cat-%d", len(m.categories)+1),
		TenantID:    tenantID,
		Name:        name,
		Description: strings.TrimSpace(req.Description),
		IsActive:    true,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	m.categories = append(m.categories, cat)
	return cat, nil
}

// PostgresCategoryRepository manages categories in PostgreSQL.
type PostgresCategoryRepository struct {
	db *sql.DB
}

func NewPostgresCategoryRepository(db *sql.DB) *PostgresCategoryRepository {
	return &PostgresCategoryRepository{db: db}
}

func (p *PostgresCategoryRepository) List(ctx context.Context) ([]Category, error) {
	rows, err := p.db.QueryContext(ctx, `
		SELECT id, tenant_id, name, description, is_active, created_at, updated_at
		FROM categories
		WHERE tenant_id = $1 AND is_active = TRUE
		ORDER BY name ASC
	`, tenantcontext.FromContext(ctx))
	if err != nil {
		return nil, fmt.Errorf("query categories list: %w", err)
	}
	defer rows.Close()

	result := make([]Category, 0)
	for rows.Next() {
		var c Category
		if err := rows.Scan(&c.ID, &c.TenantID, &c.Name, &c.Description, &c.IsActive, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan category: %w", err)
		}
		result = append(result, c)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate categories: %w", err)
	}
	return result, nil
}

func (p *PostgresCategoryRepository) Create(ctx context.Context, req CreateCategoryRequest) (Category, error) {
	tenantID := tenantcontext.FromContext(ctx)
	name := strings.TrimSpace(req.Name)

	var c Category
	err := p.db.QueryRowContext(ctx, `
		INSERT INTO categories (tenant_id, name, description, is_active)
		VALUES ($1, $2, $3, TRUE)
		RETURNING id, tenant_id, name, description, is_active, created_at, updated_at
	`, tenantID, name, strings.TrimSpace(req.Description)).Scan(
		&c.ID, &c.TenantID, &c.Name, &c.Description, &c.IsActive, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		if strings.Contains(err.Error(), "unique constraint") || strings.Contains(err.Error(), "duplicate key") {
			return Category{}, ErrCategoryExists
		}
		return Category{}, fmt.Errorf("insert category: %w", err)
	}
	return c, nil
}

// CategoryHandler handles HTTP requests for product categories.
type CategoryHandler struct {
	repo CategoryRepository
}

func NewCategoryHandler(repo CategoryRepository) *CategoryHandler {
	return &CategoryHandler{repo: repo}
}

// ListCategories handles GET /api/v1/categories
func (h *CategoryHandler) ListCategories(w http.ResponseWriter, r *http.Request) {
	list, err := h.repo.List(r.Context())
	if err != nil {
		envelope.WriteError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Gagal memuat daftar kategori.", nil)
		return
	}
	if list == nil {
		list = make([]Category, 0)
	}
	envelope.Write(w, r, http.StatusOK, list)
}

// CreateCategory handles POST /api/v1/categories
func (h *CategoryHandler) CreateCategory(w http.ResponseWriter, r *http.Request) {
	var req CreateCategoryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		envelope.WriteError(w, r, http.StatusBadRequest, "INVALID_REQUEST", "Request payload must be valid JSON.", nil)
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	details := make(map[string]string)
	if req.Name == "" {
		details["name"] = "Nama kategori wajib diisi."
	} else if len([]rune(req.Name)) > 80 {
		details["name"] = "Nama kategori maksimal 80 karakter."
	}
	if len(details) > 0 {
		envelope.WriteError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "Data kategori tidak valid.", details)
		return
	}

	created, err := h.repo.Create(r.Context(), req)
	if err != nil {
		if errors.Is(err, ErrCategoryExists) {
			envelope.WriteError(w, r, http.StatusConflict, "CATEGORY_EXISTS", "Kategori dengan nama tersebut sudah ada.", map[string]string{"name": req.Name})
			return
		}
		envelope.WriteError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Gagal membuat kategori baru.", nil)
		return
	}

	envelope.Write(w, r, http.StatusCreated, created)
}

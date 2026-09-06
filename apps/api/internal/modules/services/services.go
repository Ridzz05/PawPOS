package services

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
	ErrServiceNotFound = errors.New("service not found")
	ErrServiceExists   = errors.New("service already exists")
	ErrPackageNotFound = errors.New("package not found")
	ErrPackageExists   = errors.New("package already exists")
)

var validCategories = map[string]bool{
	"grooming":  true,
	"klinik":    true,
	"penitipan": true,
	"lainnya":   true,
}

// Service represents a sellable pet-care service.
type Service struct {
	ID              string    `json:"id"`
	TenantID        string    `json:"tenant_id"`
	Name            string    `json:"name"`
	Category        string    `json:"category"`
	PriceIDR        int64     `json:"price_idr"`
	DurationMinutes int       `json:"duration_minutes"`
	Description     string    `json:"description"`
	IsActive        bool      `json:"is_active"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// UpsertServiceRequest defines the payload to create or update a service.
type UpsertServiceRequest struct {
	Name            string `json:"name"`
	Category        string `json:"category,omitempty"`
	PriceIDR        int64  `json:"price_idr"`
	DurationMinutes int    `json:"duration_minutes"`
	Description     string `json:"description,omitempty"`
}

// PackageItem links a service into a bundle with included sessions.
type PackageItem struct {
	ServiceID        string `json:"service_id"`
	ServiceName      string `json:"service_name,omitempty"`
	SessionsIncluded int    `json:"sessions_included"`
	DurationMinutes  int    `json:"duration_minutes,omitempty"`
}

// Package represents a bundled service offering with a bundle price.
type Package struct {
	ID          string        `json:"id"`
	TenantID    string        `json:"tenant_id"`
	Name        string        `json:"name"`
	PriceIDR    int64         `json:"price_idr"`
	Description string        `json:"description"`
	Items       []PackageItem `json:"items"`
	IsActive    bool          `json:"is_active"`
	CreatedAt   time.Time     `json:"created_at"`
	UpdatedAt   time.Time     `json:"updated_at"`
}

// UpsertPackageRequest defines the payload to create or update a package.
type UpsertPackageRequest struct {
	Name        string             `json:"name"`
	PriceIDR    int64              `json:"price_idr"`
	Description string             `json:"description,omitempty"`
	Items       []PackageItemInput `json:"items"`
}

// PackageItemInput is a single service line inside a package payload.
type PackageItemInput struct {
	ServiceID        string `json:"service_id"`
	SessionsIncluded int    `json:"sessions_included"`
}

// Repository defines data access for services and packages.
type Repository interface {
	ListServices(ctx context.Context, category string) ([]Service, error)
	CreateService(ctx context.Context, req UpsertServiceRequest) (Service, error)
	GetServiceByID(ctx context.Context, id string) (Service, error)
	UpdateService(ctx context.Context, id string, req UpsertServiceRequest) (Service, error)
	ListPackages(ctx context.Context) ([]Package, error)
	CreatePackage(ctx context.Context, req UpsertPackageRequest) (Package, error)
	GetPackageByID(ctx context.Context, id string) (Package, error)
	UpdatePackage(ctx context.Context, id string, req UpsertPackageRequest) (Package, error)
}

// MemoryRepository provides thread-safe in-memory storage.
type MemoryRepository struct {
	mu       sync.RWMutex
	services []Service
	packages []Package
}

func NewMemoryRepository() *MemoryRepository {
	return &MemoryRepository{
		services: make([]Service, 0),
		packages: make([]Package, 0),
	}
}

func normalizeService(req UpsertServiceRequest) UpsertServiceRequest {
	req.Name = strings.TrimSpace(req.Name)
	req.Category = strings.ToLower(strings.TrimSpace(req.Category))
	if req.Category == "" {
		req.Category = "lainnya"
	}
	req.Description = strings.TrimSpace(req.Description)
	return req
}

func validateService(req UpsertServiceRequest) map[string]string {
	details := make(map[string]string)
	if req.Name == "" {
		details["name"] = "Nama layanan wajib diisi."
	}
	if !validCategories[req.Category] {
		details["category"] = "Kategori harus grooming, klinik, penitipan, atau lainnya."
	}
	if req.PriceIDR < 0 {
		details["price_idr"] = "Harga tidak boleh negatif."
	}
	if req.DurationMinutes < 0 {
		details["duration_minutes"] = "Durasi tidak boleh negatif."
	}
	return details
}

func (m *MemoryRepository) ListServices(ctx context.Context, category string) ([]Service, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	tenantID := tenantcontext.FromContext(ctx)
	result := make([]Service, 0, len(m.services))
	for _, s := range m.services {
		if s.TenantID != tenantID || !s.IsActive {
			continue
		}
		if category != "" && s.Category != category {
			continue
		}
		result = append(result, s)
	}
	return result, nil
}

func (m *MemoryRepository) CreateService(ctx context.Context, req UpsertServiceRequest) (Service, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	req = normalizeService(req)
	tenantID := tenantcontext.FromContext(ctx)
	for _, s := range m.services {
		if s.TenantID == tenantID && strings.EqualFold(s.Name, req.Name) && s.IsActive {
			return Service{}, ErrServiceExists
		}
	}

	now := time.Now().UTC()
	svc := Service{
		ID:              fmt.Sprintf("svc-%d", len(m.services)+1),
		TenantID:        tenantID,
		Name:            req.Name,
		Category:        req.Category,
		PriceIDR:        req.PriceIDR,
		DurationMinutes: req.DurationMinutes,
		Description:     req.Description,
		IsActive:        true,
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	m.services = append(m.services, svc)
	return svc, nil
}

func (m *MemoryRepository) GetServiceByID(ctx context.Context, id string) (Service, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	tenantID := tenantcontext.FromContext(ctx)
	for _, s := range m.services {
		if s.ID == id && s.TenantID == tenantID {
			return s, nil
		}
	}
	return Service{}, ErrServiceNotFound
}

func (m *MemoryRepository) UpdateService(ctx context.Context, id string, req UpsertServiceRequest) (Service, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	tenantID := tenantcontext.FromContext(ctx)
	req = normalizeService(req)
	for i, s := range m.services {
		if s.ID == id && s.TenantID == tenantID {
			m.services[i].Name = req.Name
			m.services[i].Category = req.Category
			m.services[i].PriceIDR = req.PriceIDR
			m.services[i].DurationMinutes = req.DurationMinutes
			m.services[i].Description = req.Description
			m.services[i].UpdatedAt = time.Now().UTC()
			return m.services[i], nil
		}
	}
	return Service{}, ErrServiceNotFound
}

func (m *MemoryRepository) serviceByIDLocked(id, tenantID string) (Service, bool) {
	for _, s := range m.services {
		if s.ID == id && s.TenantID == tenantID {
			return s, true
		}
	}
	return Service{}, false
}

func (m *MemoryRepository) ListPackages(ctx context.Context) ([]Package, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	tenantID := tenantcontext.FromContext(ctx)
	result := make([]Package, 0, len(m.packages))
	for _, p := range m.packages {
		if p.TenantID == tenantID && p.IsActive {
			result = append(result, p)
		}
	}
	return result, nil
}

func validatePackageItems(items []PackageItemInput) map[string]string {
	details := make(map[string]string)
	if len(items) == 0 {
		details["items"] = "Paket wajib memuat minimal satu layanan."
		return details
	}
	seen := make(map[string]bool)
	for i, it := range items {
		if strings.TrimSpace(it.ServiceID) == "" {
			details[fmt.Sprintf("items[%d].service_id", i)] = "Layanan wajib dipilih."
		}
		if it.SessionsIncluded <= 0 {
			details[fmt.Sprintf("items[%d].sessions_included", i)] = "Sesi wajib lebih dari nol."
		}
		if seen[it.ServiceID] {
			details[fmt.Sprintf("items[%d].service_id", i)] = "Layanan tidak boleh ganda dalam satu paket."
		}
		seen[it.ServiceID] = true
	}
	return details
}

func (m *MemoryRepository) buildPackageItems(tenantID string, inputs []PackageItemInput) ([]PackageItem, error) {
	items := make([]PackageItem, 0, len(inputs))
	for _, in := range inputs {
		svc, ok := m.serviceByIDLocked(in.ServiceID, tenantID)
		if !ok {
			return nil, ErrServiceNotFound
		}
		items = append(items, PackageItem{
			ServiceID:        svc.ID,
			ServiceName:      svc.Name,
			SessionsIncluded: in.SessionsIncluded,
			DurationMinutes:  svc.DurationMinutes,
		})
	}
	return items, nil
}

func (m *MemoryRepository) CreatePackage(ctx context.Context, req UpsertPackageRequest) (Package, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	tenantID := tenantcontext.FromContext(ctx)
	name := strings.TrimSpace(req.Name)
	for _, p := range m.packages {
		if p.TenantID == tenantID && strings.EqualFold(p.Name, name) && p.IsActive {
			return Package{}, ErrPackageExists
		}
	}
	items, err := m.buildPackageItems(tenantID, req.Items)
	if err != nil {
		return Package{}, err
	}

	now := time.Now().UTC()
	pkg := Package{
		ID:          fmt.Sprintf("pkg-%d", len(m.packages)+1),
		TenantID:    tenantID,
		Name:        name,
		PriceIDR:    req.PriceIDR,
		Description: strings.TrimSpace(req.Description),
		Items:       items,
		IsActive:    true,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	m.packages = append(m.packages, pkg)
	return pkg, nil
}

func (m *MemoryRepository) GetPackageByID(ctx context.Context, id string) (Package, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	tenantID := tenantcontext.FromContext(ctx)
	for _, p := range m.packages {
		if p.ID == id && p.TenantID == tenantID {
			return p, nil
		}
	}
	return Package{}, ErrPackageNotFound
}

func (m *MemoryRepository) UpdatePackage(ctx context.Context, id string, req UpsertPackageRequest) (Package, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	tenantID := tenantcontext.FromContext(ctx)
	name := strings.TrimSpace(req.Name)
	items, err := m.buildPackageItems(tenantID, req.Items)
	if err != nil {
		return Package{}, err
	}
	for i, p := range m.packages {
		if p.ID == id && p.TenantID == tenantID {
			m.packages[i].Name = name
			m.packages[i].PriceIDR = req.PriceIDR
			m.packages[i].Description = strings.TrimSpace(req.Description)
			m.packages[i].Items = items
			m.packages[i].UpdatedAt = time.Now().UTC()
			return m.packages[i], nil
		}
	}
	return Package{}, ErrPackageNotFound
}

// PostgresRepository manages services and packages in PostgreSQL.
type PostgresRepository struct {
	db *sql.DB
}

func NewPostgresRepository(db *sql.DB) *PostgresRepository {
	return &PostgresRepository{db: db}
}

const serviceColumns = "id, tenant_id, name, category, price_idr, duration_minutes, description, is_active, created_at, updated_at"

func scanService(row interface {
	Scan(dest ...any) error
}) (Service, error) {
	var s Service
	if err := row.Scan(&s.ID, &s.TenantID, &s.Name, &s.Category, &s.PriceIDR, &s.DurationMinutes, &s.Description, &s.IsActive, &s.CreatedAt, &s.UpdatedAt); err != nil {
		return Service{}, err
	}
	return s, nil
}

func (p *PostgresRepository) ListServices(ctx context.Context, category string) ([]Service, error) {
	query := `SELECT ` + serviceColumns + ` FROM services WHERE tenant_id = $1 AND is_active = TRUE`
	args := []any{tenantcontext.FromContext(ctx)}
	if category != "" {
		query += ` AND category = $2`
		args = append(args, category)
	}
	query += ` ORDER BY name ASC`
	rows, err := p.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query services: %w", err)
	}
	defer rows.Close()

	result := make([]Service, 0)
	for rows.Next() {
		s, err := scanService(rows)
		if err != nil {
			return nil, fmt.Errorf("scan service: %w", err)
		}
		result = append(result, s)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate services: %w", err)
	}
	return result, nil
}

func (p *PostgresRepository) CreateService(ctx context.Context, req UpsertServiceRequest) (Service, error) {
	req = normalizeService(req)
	var s Service
	err := p.db.QueryRowContext(ctx, `
		INSERT INTO services (tenant_id, name, category, price_idr, duration_minutes, description, is_active)
		VALUES ($1, $2, $3, $4, $5, $6, TRUE)
		RETURNING `+serviceColumns+`
	`, tenantcontext.FromContext(ctx), req.Name, req.Category, req.PriceIDR, req.DurationMinutes, req.Description).Scan(
		&s.ID, &s.TenantID, &s.Name, &s.Category, &s.PriceIDR, &s.DurationMinutes, &s.Description, &s.IsActive, &s.CreatedAt, &s.UpdatedAt,
	)
	if err != nil {
		if strings.Contains(err.Error(), "unique constraint") || strings.Contains(err.Error(), "duplicate key") {
			return Service{}, ErrServiceExists
		}
		return Service{}, fmt.Errorf("insert service: %w", err)
	}
	return s, nil
}

func (p *PostgresRepository) GetServiceByID(ctx context.Context, id string) (Service, error) {
	s, err := scanService(p.db.QueryRowContext(ctx, `
		SELECT `+serviceColumns+` FROM services WHERE id = $1 AND tenant_id = $2
	`, id, tenantcontext.FromContext(ctx)))
	if errors.Is(err, sql.ErrNoRows) {
		return Service{}, ErrServiceNotFound
	}
	if err != nil {
		return Service{}, fmt.Errorf("query service: %w", err)
	}
	return s, nil
}

func (p *PostgresRepository) UpdateService(ctx context.Context, id string, req UpsertServiceRequest) (Service, error) {
	req = normalizeService(req)
	var s Service
	err := p.db.QueryRowContext(ctx, `
		UPDATE services SET name = $3, category = $4, price_idr = $5, duration_minutes = $6, description = $7, updated_at = now()
		WHERE id = $1 AND tenant_id = $2
		RETURNING `+serviceColumns+`
	`, id, tenantcontext.FromContext(ctx), req.Name, req.Category, req.PriceIDR, req.DurationMinutes, req.Description).Scan(
		&s.ID, &s.TenantID, &s.Name, &s.Category, &s.PriceIDR, &s.DurationMinutes, &s.Description, &s.IsActive, &s.CreatedAt, &s.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return Service{}, ErrServiceNotFound
	}
	if err != nil {
		return Service{}, fmt.Errorf("update service: %w", err)
	}
	return s, nil
}

func (p *PostgresRepository) packageItems(ctx context.Context, packageID string) ([]PackageItem, error) {
	rows, err := p.db.QueryContext(ctx, `
		SELECT pi.service_id, s.name, pi.sessions_included, s.duration_minutes
		FROM service_package_items pi JOIN services s ON s.id = pi.service_id
		WHERE pi.package_id = $1 ORDER BY s.name ASC
	`, packageID)
	if err != nil {
		return nil, fmt.Errorf("query package items: %w", err)
	}
	defer rows.Close()

	items := make([]PackageItem, 0)
	for rows.Next() {
		var it PackageItem
		if err := rows.Scan(&it.ServiceID, &it.ServiceName, &it.SessionsIncluded, &it.DurationMinutes); err != nil {
			return nil, fmt.Errorf("scan package item: %w", err)
		}
		items = append(items, it)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate package items: %w", err)
	}
	return items, nil
}

func (p *PostgresRepository) ListPackages(ctx context.Context) ([]Package, error) {
	rows, err := p.db.QueryContext(ctx, `
		SELECT id, tenant_id, name, price_idr, description, is_active, created_at, updated_at
		FROM service_packages WHERE tenant_id = $1 AND is_active = TRUE ORDER BY name ASC
	`, tenantcontext.FromContext(ctx))
	if err != nil {
		return nil, fmt.Errorf("query packages: %w", err)
	}
	defer rows.Close()

	result := make([]Package, 0)
	for rows.Next() {
		var pkg Package
		if err := rows.Scan(&pkg.ID, &pkg.TenantID, &pkg.Name, &pkg.PriceIDR, &pkg.Description, &pkg.IsActive, &pkg.CreatedAt, &pkg.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan package: %w", err)
		}
		items, err := p.packageItems(ctx, pkg.ID)
		if err != nil {
			return nil, err
		}
		pkg.Items = items
		result = append(result, pkg)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate packages: %w", err)
	}
	return result, nil
}

func (p *PostgresRepository) writePackageItems(ctx context.Context, tx *sql.Tx, packageID string, inputs []PackageItemInput) error {
	if _, err := tx.ExecContext(ctx, `DELETE FROM service_package_items WHERE package_id = $1`, packageID); err != nil {
		return fmt.Errorf("clear package items: %w", err)
	}
	for _, in := range inputs {
		var exists bool
		err := tx.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM services WHERE id = $1 AND tenant_id = $2)`,
			in.ServiceID, tenantcontext.FromContext(ctx)).Scan(&exists)
		if err != nil {
			return fmt.Errorf("check service: %w", err)
		}
		if !exists {
			return ErrServiceNotFound
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO service_package_items (package_id, service_id, sessions_included) VALUES ($1, $2, $3)
		`, packageID, in.ServiceID, in.SessionsIncluded); err != nil {
			return fmt.Errorf("insert package item: %w", err)
		}
	}
	return nil
}

func (p *PostgresRepository) CreatePackage(ctx context.Context, req UpsertPackageRequest) (Package, error) {
	name := strings.TrimSpace(req.Name)
	tx, err := p.db.BeginTx(ctx, nil)
	if err != nil {
		return Package{}, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	var pkg Package
	err = tx.QueryRowContext(ctx, `
		INSERT INTO service_packages (tenant_id, name, price_idr, description, is_active)
		VALUES ($1, $2, $3, $4, TRUE)
		RETURNING id, tenant_id, name, price_idr, description, is_active, created_at, updated_at
	`, tenantcontext.FromContext(ctx), name, req.PriceIDR, strings.TrimSpace(req.Description)).Scan(
		&pkg.ID, &pkg.TenantID, &pkg.Name, &pkg.PriceIDR, &pkg.Description, &pkg.IsActive, &pkg.CreatedAt, &pkg.UpdatedAt,
	)
	if err != nil {
		if strings.Contains(err.Error(), "unique constraint") || strings.Contains(err.Error(), "duplicate key") {
			return Package{}, ErrPackageExists
		}
		return Package{}, fmt.Errorf("insert package: %w", err)
	}
	if err := p.writePackageItems(ctx, tx, pkg.ID, req.Items); err != nil {
		return Package{}, err
	}
	if err := tx.Commit(); err != nil {
		return Package{}, fmt.Errorf("commit tx: %w", err)
	}
	return p.GetPackageByID(ctx, pkg.ID)
}

func (p *PostgresRepository) GetPackageByID(ctx context.Context, id string) (Package, error) {
	var pkg Package
	err := p.db.QueryRowContext(ctx, `
		SELECT id, tenant_id, name, price_idr, description, is_active, created_at, updated_at
		FROM service_packages WHERE id = $1 AND tenant_id = $2
	`, id, tenantcontext.FromContext(ctx)).Scan(
		&pkg.ID, &pkg.TenantID, &pkg.Name, &pkg.PriceIDR, &pkg.Description, &pkg.IsActive, &pkg.CreatedAt, &pkg.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return Package{}, ErrPackageNotFound
	}
	if err != nil {
		return Package{}, fmt.Errorf("query package: %w", err)
	}
	items, err := p.packageItems(ctx, pkg.ID)
	if err != nil {
		return Package{}, err
	}
	pkg.Items = items
	return pkg, nil
}

func (p *PostgresRepository) UpdatePackage(ctx context.Context, id string, req UpsertPackageRequest) (Package, error) {
	tx, err := p.db.BeginTx(ctx, nil)
	if err != nil {
		return Package{}, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	res, err := tx.ExecContext(ctx, `
		UPDATE service_packages SET name = $3, price_idr = $4, description = $5, updated_at = now()
		WHERE id = $1 AND tenant_id = $2
	`, id, tenantcontext.FromContext(ctx), strings.TrimSpace(req.Name), req.PriceIDR, strings.TrimSpace(req.Description))
	if err != nil {
		return Package{}, fmt.Errorf("update package: %w", err)
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return Package{}, fmt.Errorf("update package rows: %w", err)
	}
	if affected == 0 {
		return Package{}, ErrPackageNotFound
	}
	if err := p.writePackageItems(ctx, tx, id, req.Items); err != nil {
		return Package{}, err
	}
	if err := tx.Commit(); err != nil {
		return Package{}, fmt.Errorf("commit tx: %w", err)
	}
	return p.GetPackageByID(ctx, id)
}

// Handler handles HTTP requests for services and packages.
type Handler struct {
	repo Repository
}

func NewHandler(repo Repository) *Handler {
	return &Handler{repo: repo}
}

func validateUpsertService(req UpsertServiceRequest) (UpsertServiceRequest, map[string]string) {
	req = normalizeService(req)
	details := validateService(req)
	if req.PriceIDR < 0 {
		details["price_idr"] = "Harga tidak boleh negatif."
	}
	return req, details
}

func validateUpsertPackage(req UpsertPackageRequest) (UpsertPackageRequest, map[string]string) {
	req.Name = strings.TrimSpace(req.Name)
	req.Description = strings.TrimSpace(req.Description)
	details := make(map[string]string)
	if req.Name == "" {
		details["name"] = "Nama paket wajib diisi."
	}
	if req.PriceIDR < 0 {
		details["price_idr"] = "Harga paket tidak boleh negatif."
	}
	for k, v := range validatePackageItems(req.Items) {
		details[k] = v
	}
	return req, details
}

// ListServices handles GET /api/v1/services?category=
func (h *Handler) ListServices(w http.ResponseWriter, r *http.Request) {
	list, err := h.repo.ListServices(r.Context(), r.URL.Query().Get("category"))
	if err != nil {
		envelope.WriteError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Gagal memuat layanan.", nil)
		return
	}
	if list == nil {
		list = make([]Service, 0)
	}
	envelope.Write(w, r, http.StatusOK, list)
}

// CreateService handles POST /api/v1/services
func (h *Handler) CreateService(w http.ResponseWriter, r *http.Request) {
	var req UpsertServiceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		envelope.WriteError(w, r, http.StatusBadRequest, "INVALID_REQUEST", "Request payload must be valid JSON.", nil)
		return
	}
	req, details := validateUpsertService(req)
	if len(details) > 0 {
		envelope.WriteError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "Data layanan tidak valid.", details)
		return
	}
	created, err := h.repo.CreateService(r.Context(), req)
	if err != nil {
		if errors.Is(err, ErrServiceExists) {
			envelope.WriteError(w, r, http.StatusConflict, "SERVICE_EXISTS", "Layanan tersebut sudah terdaftar.", nil)
			return
		}
		envelope.WriteError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Gagal menyimpan layanan.", nil)
		return
	}
	envelope.Write(w, r, http.StatusCreated, created)
}

// GetService handles GET /api/v1/services/{id}
func (h *Handler) GetService(w http.ResponseWriter, r *http.Request) {
	s, err := h.repo.GetServiceByID(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		if errors.Is(err, ErrServiceNotFound) {
			envelope.WriteError(w, r, http.StatusNotFound, "SERVICE_NOT_FOUND", "Layanan tidak ditemukan.", nil)
			return
		}
		envelope.WriteError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Gagal memuat layanan.", nil)
		return
	}
	envelope.Write(w, r, http.StatusOK, s)
}

// UpdateService handles PUT /api/v1/services/{id}
func (h *Handler) UpdateService(w http.ResponseWriter, r *http.Request) {
	var req UpsertServiceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		envelope.WriteError(w, r, http.StatusBadRequest, "INVALID_REQUEST", "Request payload must be valid JSON.", nil)
		return
	}
	req, details := validateUpsertService(req)
	if len(details) > 0 {
		envelope.WriteError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "Data layanan tidak valid.", details)
		return
	}
	updated, err := h.repo.UpdateService(r.Context(), chi.URLParam(r, "id"), req)
	if err != nil {
		if errors.Is(err, ErrServiceNotFound) {
			envelope.WriteError(w, r, http.StatusNotFound, "SERVICE_NOT_FOUND", "Layanan tidak ditemukan.", nil)
			return
		}
		envelope.WriteError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Gagal memperbarui layanan.", nil)
		return
	}
	envelope.Write(w, r, http.StatusOK, updated)
}

// ListPackages handles GET /api/v1/packages
func (h *Handler) ListPackages(w http.ResponseWriter, r *http.Request) {
	list, err := h.repo.ListPackages(r.Context())
	if err != nil {
		envelope.WriteError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Gagal memuat paket layanan.", nil)
		return
	}
	if list == nil {
		list = make([]Package, 0)
	}
	envelope.Write(w, r, http.StatusOK, list)
}

// CreatePackage handles POST /api/v1/packages
func (h *Handler) CreatePackage(w http.ResponseWriter, r *http.Request) {
	var req UpsertPackageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		envelope.WriteError(w, r, http.StatusBadRequest, "INVALID_REQUEST", "Request payload must be valid JSON.", nil)
		return
	}
	req, details := validateUpsertPackage(req)
	if len(details) > 0 {
		envelope.WriteError(w, r, http.StatusUnprocessableEntity, "VALIDATION_FAILED", "Data paket tidak valid.", details)
		return
	}
	created, err := h.repo.CreatePackage(r.Context(), req)
	if err != nil {
		switch {
		case errors.Is(err, ErrPackageExists):
			envelope.WriteError(w, r, http.StatusConflict, "PACKAGE_EXISTS", "Paket tersebut sudah terdaftar.", nil)
		case errors.Is(err, ErrServiceNotFound):
			envelope.WriteError(w, r, http.StatusUnprocessableEntity, "SERVICE_NOT_FOUND", "Salah satu layanan dalam paket tidak ditemukan.", nil)
		default:
			envelope.WriteError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Gagal menyimpan paket.", nil)
		}
		return
	}
	envelope.Write(w, r, http.StatusCreated, created)
}

// GetPackage handles GET /api/v1/packages/{id}
func (h *Handler) GetPackage(w http.ResponseWriter, r *http.Request) {
	pkg, err := h.repo.GetPackageByID(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		if errors.Is(err, ErrPackageNotFound) {
			envelope.WriteError(w, r, http.StatusNotFound, "PACKAGE_NOT_FOUND", "Paket tidak ditemukan.", nil)
			return
		}
		envelope.WriteError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Gagal memuat paket.", nil)
		return
	}
	envelope.Write(w, r, http.StatusOK, pkg)
}

// UpdatePackage handles PUT /api/v1/packages/{id}
func (h *Handler) UpdatePackage(w http.ResponseWriter, r *http.Request) {
	var req UpsertPackageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		envelope.WriteError(w, r, http.StatusBadRequest, "INVALID_REQUEST", "Request payload must be valid JSON.", nil)
		return
	}
	req, details := validateUpsertPackage(req)
	if len(details) > 0 {
		envelope.WriteError(w, r, http.StatusUnprocessableEntity, "VALIDATION_FAILED", "Data paket tidak valid.", details)
		return
	}
	updated, err := h.repo.UpdatePackage(r.Context(), chi.URLParam(r, "id"), req)
	if err != nil {
		switch {
		case errors.Is(err, ErrPackageNotFound):
			envelope.WriteError(w, r, http.StatusNotFound, "PACKAGE_NOT_FOUND", "Paket tidak ditemukan.", nil)
		case errors.Is(err, ErrServiceNotFound):
			envelope.WriteError(w, r, http.StatusUnprocessableEntity, "SERVICE_NOT_FOUND", "Salah satu layanan dalam paket tidak ditemukan.", nil)
		default:
			envelope.WriteError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Gagal memperbarui paket.", nil)
		}
		return
	}
	envelope.Write(w, r, http.StatusOK, updated)
}

package customers

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
	ErrCustomerNotFound = errors.New("customer not found")
	ErrPetNotFound      = errors.New("pet not found")
)

// Customer represents a pet owner registered to a tenant.
type Customer struct {
	ID        string    `json:"id"`
	TenantID  string    `json:"tenant_id"`
	Name      string    `json:"name"`
	Phone     string    `json:"phone"`
	Email     string    `json:"email"`
	Address   string    `json:"address"`
	Notes     string    `json:"notes"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// UpsertCustomerRequest defines the payload to create or update a customer.
type UpsertCustomerRequest struct {
	Name    string `json:"name"`
	Phone   string `json:"phone,omitempty"`
	Email   string `json:"email,omitempty"`
	Address string `json:"address,omitempty"`
	Notes   string `json:"notes,omitempty"`
}

// Pet represents an animal owned by a customer.
type Pet struct {
	ID           string    `json:"id"`
	TenantID     string    `json:"tenant_id"`
	CustomerID   string    `json:"customer_id"`
	CustomerName string    `json:"customer_name,omitempty"`
	Name         string    `json:"name"`
	Species      string    `json:"species,omitempty"`
	Breed        string    `json:"breed,omitempty"`
	BirthDate    *string   `json:"birth_date,omitempty"`
	Gender       string    `json:"gender,omitempty"`
	WeightKg     float64   `json:"weight_kg"`
	Color        string    `json:"color,omitempty"`
	Allergies    string    `json:"allergies,omitempty"`
	Notes        string    `json:"notes,omitempty"`
	IsActive     bool      `json:"is_active"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// UpsertPetRequest defines the payload to create or update a pet.
type UpsertPetRequest struct {
	CustomerID string  `json:"customer_id"`
	Name       string  `json:"name"`
	Species    string  `json:"species,omitempty"`
	Breed      string  `json:"breed,omitempty"`
	BirthDate  *string `json:"birth_date,omitempty"`
	Gender     string  `json:"gender,omitempty"`
	WeightKg   float64 `json:"weight_kg"`
	Color      string  `json:"color,omitempty"`
	Allergies  string  `json:"allergies,omitempty"`
	Notes      string  `json:"notes,omitempty"`
}

// Repository defines data access for customers and pets.
type Repository interface {
	ListCustomers(ctx context.Context, search string) ([]Customer, error)
	CreateCustomer(ctx context.Context, req UpsertCustomerRequest) (Customer, error)
	GetCustomerByID(ctx context.Context, id string) (Customer, error)
	UpdateCustomer(ctx context.Context, id string, req UpsertCustomerRequest) (Customer, error)
	ListPets(ctx context.Context, customerID string) ([]Pet, error)
	CreatePet(ctx context.Context, req UpsertPetRequest) (Pet, error)
	GetPetByID(ctx context.Context, id string) (Pet, error)
	UpdatePet(ctx context.Context, id string, req UpsertPetRequest) (Pet, error)
}

// MemoryRepository provides thread-safe in-memory storage.
type MemoryRepository struct {
	mu        sync.RWMutex
	customers []Customer
	pets      []Pet
}

func NewMemoryRepository() *MemoryRepository {
	return &MemoryRepository{
		customers: make([]Customer, 0),
		pets:      make([]Pet, 0),
	}
}

func normalizeCustomer(req UpsertCustomerRequest) UpsertCustomerRequest {
	req.Name = strings.TrimSpace(req.Name)
	req.Phone = strings.TrimSpace(req.Phone)
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	req.Address = strings.TrimSpace(req.Address)
	req.Notes = strings.TrimSpace(req.Notes)
	return req
}

func (m *MemoryRepository) ListCustomers(ctx context.Context, search string) ([]Customer, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	tenantID := tenantcontext.FromContext(ctx)
	q := strings.ToLower(strings.TrimSpace(search))
	result := make([]Customer, 0, len(m.customers))
	for _, c := range m.customers {
		if c.TenantID != tenantID || !c.IsActive {
			continue
		}
		if q != "" && !strings.Contains(strings.ToLower(c.Name+" "+c.Phone+" "+c.Email), q) {
			continue
		}
		result = append(result, c)
	}
	return result, nil
}

func (m *MemoryRepository) CreateCustomer(ctx context.Context, req UpsertCustomerRequest) (Customer, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	req = normalizeCustomer(req)
	now := time.Now().UTC()
	c := Customer{
		ID:        fmt.Sprintf("cust-%d", len(m.customers)+1),
		TenantID:  tenantcontext.FromContext(ctx),
		Name:      req.Name,
		Phone:     req.Phone,
		Email:     req.Email,
		Address:   req.Address,
		Notes:     req.Notes,
		IsActive:  true,
		CreatedAt: now,
		UpdatedAt: now,
	}
	m.customers = append(m.customers, c)
	return c, nil
}

func (m *MemoryRepository) GetCustomerByID(ctx context.Context, id string) (Customer, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	tenantID := tenantcontext.FromContext(ctx)
	for _, c := range m.customers {
		if c.ID == id && c.TenantID == tenantID {
			return c, nil
		}
	}
	return Customer{}, ErrCustomerNotFound
}

func (m *MemoryRepository) UpdateCustomer(ctx context.Context, id string, req UpsertCustomerRequest) (Customer, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	tenantID := tenantcontext.FromContext(ctx)
	req = normalizeCustomer(req)
	for i, c := range m.customers {
		if c.ID == id && c.TenantID == tenantID {
			m.customers[i].Name = req.Name
			m.customers[i].Phone = req.Phone
			m.customers[i].Email = req.Email
			m.customers[i].Address = req.Address
			m.customers[i].Notes = req.Notes
			m.customers[i].UpdatedAt = time.Now().UTC()
			return m.customers[i], nil
		}
	}
	return Customer{}, ErrCustomerNotFound
}

func normalizePet(req UpsertPetRequest) UpsertPetRequest {
	req.Name = strings.TrimSpace(req.Name)
	req.Species = strings.TrimSpace(req.Species)
	req.Breed = strings.TrimSpace(req.Breed)
	req.Gender = strings.ToLower(strings.TrimSpace(req.Gender))
	req.Color = strings.TrimSpace(req.Color)
	req.Allergies = strings.TrimSpace(req.Allergies)
	req.Notes = strings.TrimSpace(req.Notes)
	if req.BirthDate != nil {
		trimmed := strings.TrimSpace(*req.BirthDate)
		if trimmed == "" {
			req.BirthDate = nil
		} else {
			req.BirthDate = &trimmed
		}
	}
	return req
}

func (m *MemoryRepository) customerNameLocked(customerID string) string {
	for _, c := range m.customers {
		if c.ID == customerID {
			return c.Name
		}
	}
	return ""
}

func (m *MemoryRepository) ListPets(ctx context.Context, customerID string) ([]Pet, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	tenantID := tenantcontext.FromContext(ctx)
	result := make([]Pet, 0, len(m.pets))
	for _, p := range m.pets {
		if p.TenantID != tenantID || !p.IsActive {
			continue
		}
		if customerID != "" && p.CustomerID != customerID {
			continue
		}
		p.CustomerName = m.customerNameLocked(p.CustomerID)
		result = append(result, p)
	}
	return result, nil
}

func (m *MemoryRepository) CreatePet(ctx context.Context, req UpsertPetRequest) (Pet, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	tenantID := tenantcontext.FromContext(ctx)
	req = normalizePet(req)
	found := false
	for _, c := range m.customers {
		if c.ID == req.CustomerID && c.TenantID == tenantID {
			found = true
			break
		}
	}
	if !found {
		return Pet{}, ErrCustomerNotFound
	}

	now := time.Now().UTC()
	p := Pet{
		ID:         fmt.Sprintf("pet-%d", len(m.pets)+1),
		TenantID:   tenantID,
		CustomerID: req.CustomerID,
		Name:       req.Name,
		Species:    req.Species,
		Breed:      req.Breed,
		BirthDate:  req.BirthDate,
		Gender:     req.Gender,
		WeightKg:   req.WeightKg,
		Color:      req.Color,
		Allergies:  req.Allergies,
		Notes:      req.Notes,
		IsActive:   true,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	m.pets = append(m.pets, p)
	p.CustomerName = m.customerNameLocked(p.CustomerID)
	return p, nil
}

func (m *MemoryRepository) GetPetByID(ctx context.Context, id string) (Pet, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	tenantID := tenantcontext.FromContext(ctx)
	for _, p := range m.pets {
		if p.ID == id && p.TenantID == tenantID {
			p.CustomerName = m.customerNameLocked(p.CustomerID)
			return p, nil
		}
	}
	return Pet{}, ErrPetNotFound
}

func (m *MemoryRepository) UpdatePet(ctx context.Context, id string, req UpsertPetRequest) (Pet, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	tenantID := tenantcontext.FromContext(ctx)
	req = normalizePet(req)
	for i, p := range m.pets {
		if p.ID == id && p.TenantID == tenantID {
			m.pets[i].Name = req.Name
			m.pets[i].Species = req.Species
			m.pets[i].Breed = req.Breed
			m.pets[i].BirthDate = req.BirthDate
			m.pets[i].Gender = req.Gender
			m.pets[i].WeightKg = req.WeightKg
			m.pets[i].Color = req.Color
			m.pets[i].Allergies = req.Allergies
			m.pets[i].Notes = req.Notes
			m.pets[i].UpdatedAt = time.Now().UTC()
			updated := m.pets[i]
			updated.CustomerName = m.customerNameLocked(updated.CustomerID)
			return updated, nil
		}
	}
	return Pet{}, ErrPetNotFound
}

// PostgresRepository manages customers and pets in PostgreSQL.
type PostgresRepository struct {
	db *sql.DB
}

func NewPostgresRepository(db *sql.DB) *PostgresRepository {
	return &PostgresRepository{db: db}
}

const customerColumns = "id, tenant_id, name, phone, email, address, notes, is_active, created_at, updated_at"

func scanCustomer(row interface {
	Scan(dest ...any) error
}) (Customer, error) {
	var c Customer
	if err := row.Scan(&c.ID, &c.TenantID, &c.Name, &c.Phone, &c.Email, &c.Address, &c.Notes, &c.IsActive, &c.CreatedAt, &c.UpdatedAt); err != nil {
		return Customer{}, err
	}
	return c, nil
}

func (p *PostgresRepository) ListCustomers(ctx context.Context, search string) ([]Customer, error) {
	tenantID := tenantcontext.FromContext(ctx)
	query := `SELECT ` + customerColumns + ` FROM customers WHERE tenant_id = $1 AND is_active = TRUE`
	args := []any{tenantID}
	if q := strings.TrimSpace(search); q != "" {
		query += ` AND (name ILIKE $2 OR phone ILIKE $2 OR email ILIKE $2)`
		args = append(args, "%"+q+"%")
	}
	query += ` ORDER BY name ASC`
	rows, err := p.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query customers: %w", err)
	}
	defer rows.Close()

	result := make([]Customer, 0)
	for rows.Next() {
		c, err := scanCustomer(rows)
		if err != nil {
			return nil, fmt.Errorf("scan customer: %w", err)
		}
		result = append(result, c)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate customers: %w", err)
	}
	return result, nil
}

func (p *PostgresRepository) CreateCustomer(ctx context.Context, req UpsertCustomerRequest) (Customer, error) {
	req = normalizeCustomer(req)
	var c Customer
	err := p.db.QueryRowContext(ctx, `
		INSERT INTO customers (tenant_id, name, phone, email, address, notes, is_active)
		VALUES ($1, $2, $3, $4, $5, $6, TRUE)
		RETURNING `+customerColumns+`
	`, tenantcontext.FromContext(ctx), req.Name, req.Phone, req.Email, req.Address, req.Notes).Scan(
		&c.ID, &c.TenantID, &c.Name, &c.Phone, &c.Email, &c.Address, &c.Notes, &c.IsActive, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		return Customer{}, fmt.Errorf("insert customer: %w", err)
	}
	return c, nil
}

func (p *PostgresRepository) GetCustomerByID(ctx context.Context, id string) (Customer, error) {
	c, err := scanCustomer(p.db.QueryRowContext(ctx, `
		SELECT `+customerColumns+` FROM customers WHERE id = $1 AND tenant_id = $2
	`, id, tenantcontext.FromContext(ctx)))
	if errors.Is(err, sql.ErrNoRows) {
		return Customer{}, ErrCustomerNotFound
	}
	if err != nil {
		return Customer{}, fmt.Errorf("query customer: %w", err)
	}
	return c, nil
}

func (p *PostgresRepository) UpdateCustomer(ctx context.Context, id string, req UpsertCustomerRequest) (Customer, error) {
	req = normalizeCustomer(req)
	var c Customer
	err := p.db.QueryRowContext(ctx, `
		UPDATE customers SET name = $3, phone = $4, email = $5, address = $6, notes = $7, updated_at = now()
		WHERE id = $1 AND tenant_id = $2
		RETURNING `+customerColumns+`
	`, id, tenantcontext.FromContext(ctx), req.Name, req.Phone, req.Email, req.Address, req.Notes).Scan(
		&c.ID, &c.TenantID, &c.Name, &c.Phone, &c.Email, &c.Address, &c.Notes, &c.IsActive, &c.CreatedAt, &c.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return Customer{}, ErrCustomerNotFound
	}
	if err != nil {
		return Customer{}, fmt.Errorf("update customer: %w", err)
	}
	return c, nil
}

const petColumns = "p.id, p.tenant_id, p.customer_id, c.name, p.name, p.species, p.breed, p.birth_date, p.gender, p.weight_kg, p.color, p.allergies, p.notes, p.is_active, p.created_at, p.updated_at"

func scanPet(row interface {
	Scan(dest ...any) error
}) (Pet, error) {
	var p Pet
	var birthDate sql.NullString
	var customerName sql.NullString
	if err := row.Scan(&p.ID, &p.TenantID, &p.CustomerID, &customerName, &p.Name, &p.Species, &p.Breed, &birthDate, &p.Gender, &p.WeightKg, &p.Color, &p.Allergies, &p.Notes, &p.IsActive, &p.CreatedAt, &p.UpdatedAt); err != nil {
		return Pet{}, err
	}
	if birthDate.Valid {
		p.BirthDate = &birthDate.String
	}
	if customerName.Valid {
		p.CustomerName = customerName.String
	}
	return p, nil
}

func (p *PostgresRepository) ListPets(ctx context.Context, customerID string) ([]Pet, error) {
	tenantID := tenantcontext.FromContext(ctx)
	query := `SELECT ` + petColumns + ` FROM pets p LEFT JOIN customers c ON c.id = p.customer_id WHERE p.tenant_id = $1 AND p.is_active = TRUE`
	args := []any{tenantID}
	if customerID != "" {
		query += ` AND p.customer_id = $2`
		args = append(args, customerID)
	}
	query += ` ORDER BY p.name ASC`
	rows, err := p.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query pets: %w", err)
	}
	defer rows.Close()

	result := make([]Pet, 0)
	for rows.Next() {
		pet, err := scanPet(rows)
		if err != nil {
			return nil, fmt.Errorf("scan pet: %w", err)
		}
		result = append(result, pet)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate pets: %w", err)
	}
	return result, nil
}

func (p *PostgresRepository) CreatePet(ctx context.Context, req UpsertPetRequest) (Pet, error) {
	req = normalizePet(req)
	var birthDate any
	if req.BirthDate != nil {
		birthDate = *req.BirthDate
	}
	var pet Pet
	err := p.db.QueryRowContext(ctx, `
		INSERT INTO pets (tenant_id, customer_id, name, species, breed, birth_date, gender, weight_kg, color, allergies, notes, is_active)
		SELECT $1, id, $3, $4, $5, $6, $7, $8, $9, $10, $11, TRUE FROM customers WHERE id = $2 AND tenant_id = $1
		RETURNING id
	`, tenantcontext.FromContext(ctx), req.CustomerID, req.Name, req.Species, req.Breed, birthDate, req.Gender, req.WeightKg, req.Color, req.Allergies, req.Notes).Scan(&pet.ID)
	if errors.Is(err, sql.ErrNoRows) {
		return Pet{}, ErrCustomerNotFound
	}
	if err != nil {
		return Pet{}, fmt.Errorf("insert pet: %w", err)
	}
	return p.GetPetByID(ctx, pet.ID)
}

func (p *PostgresRepository) GetPetByID(ctx context.Context, id string) (Pet, error) {
	pet, err := scanPet(p.db.QueryRowContext(ctx, `
		SELECT `+petColumns+` FROM pets p LEFT JOIN customers c ON c.id = p.customer_id
		WHERE p.id = $1 AND p.tenant_id = $2
	`, id, tenantcontext.FromContext(ctx)))
	if errors.Is(err, sql.ErrNoRows) {
		return Pet{}, ErrPetNotFound
	}
	if err != nil {
		return Pet{}, fmt.Errorf("query pet: %w", err)
	}
	return pet, nil
}

func (p *PostgresRepository) UpdatePet(ctx context.Context, id string, req UpsertPetRequest) (Pet, error) {
	req = normalizePet(req)
	var birthDate any
	if req.BirthDate != nil {
		birthDate = *req.BirthDate
	}
	res, err := p.db.ExecContext(ctx, `
		UPDATE pets SET name = $3, species = $4, breed = $5, birth_date = $6, gender = $7,
			weight_kg = $8, color = $9, allergies = $10, notes = $11, updated_at = now()
		WHERE id = $1 AND tenant_id = $2
	`, id, tenantcontext.FromContext(ctx), req.Name, req.Species, req.Breed, birthDate, req.Gender, req.WeightKg, req.Color, req.Allergies, req.Notes)
	if err != nil {
		return Pet{}, fmt.Errorf("update pet: %w", err)
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return Pet{}, fmt.Errorf("update pet rows: %w", err)
	}
	if affected == 0 {
		return Pet{}, ErrPetNotFound
	}
	return p.GetPetByID(ctx, id)
}

// Handler handles HTTP requests for customers and pets.
type Handler struct {
	repo Repository
}

func NewHandler(repo Repository) *Handler {
	return &Handler{repo: repo}
}

func validateCustomer(req UpsertCustomerRequest) (UpsertCustomerRequest, map[string]string) {
	req = normalizeCustomer(req)
	details := make(map[string]string)
	if req.Name == "" {
		details["name"] = "Nama pelanggan wajib diisi."
	}
	if len([]rune(req.Name)) > 120 {
		details["name"] = "Nama pelanggan maksimal 120 karakter."
	}
	return req, details
}

func validatePet(req UpsertPetRequest) (UpsertPetRequest, map[string]string) {
	req = normalizePet(req)
	details := make(map[string]string)
	if strings.TrimSpace(req.CustomerID) == "" {
		details["customer_id"] = "Pemilik hewan wajib dipilih."
	}
	if req.Name == "" {
		details["name"] = "Nama hewan wajib diisi."
	}
	if req.WeightKg < 0 {
		details["weight_kg"] = "Berat badan tidak boleh negatif."
	}
	return req, details
}

// ListCustomers handles GET /api/v1/customers?search=
func (h *Handler) ListCustomers(w http.ResponseWriter, r *http.Request) {
	list, err := h.repo.ListCustomers(r.Context(), r.URL.Query().Get("search"))
	if err != nil {
		envelope.WriteError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Gagal memuat data pelanggan.", nil)
		return
	}
	if list == nil {
		list = make([]Customer, 0)
	}
	envelope.Write(w, r, http.StatusOK, list)
}

// CreateCustomer handles POST /api/v1/customers
func (h *Handler) CreateCustomer(w http.ResponseWriter, r *http.Request) {
	var req UpsertCustomerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		envelope.WriteError(w, r, http.StatusBadRequest, "INVALID_REQUEST", "Request payload must be valid JSON.", nil)
		return
	}
	req, details := validateCustomer(req)
	if len(details) > 0 {
		envelope.WriteError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "Data pelanggan tidak valid.", details)
		return
	}
	created, err := h.repo.CreateCustomer(r.Context(), req)
	if err != nil {
		envelope.WriteError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Gagal menyimpan pelanggan.", nil)
		return
	}
	envelope.Write(w, r, http.StatusCreated, created)
}

// GetCustomer handles GET /api/v1/customers/{id}
func (h *Handler) GetCustomer(w http.ResponseWriter, r *http.Request) {
	c, err := h.repo.GetCustomerByID(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		if errors.Is(err, ErrCustomerNotFound) {
			envelope.WriteError(w, r, http.StatusNotFound, "CUSTOMER_NOT_FOUND", "Pelanggan tidak ditemukan.", nil)
			return
		}
		envelope.WriteError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Gagal memuat pelanggan.", nil)
		return
	}
	envelope.Write(w, r, http.StatusOK, c)
}

// UpdateCustomer handles PUT /api/v1/customers/{id}
func (h *Handler) UpdateCustomer(w http.ResponseWriter, r *http.Request) {
	var req UpsertCustomerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		envelope.WriteError(w, r, http.StatusBadRequest, "INVALID_REQUEST", "Request payload must be valid JSON.", nil)
		return
	}
	req, details := validateCustomer(req)
	if len(details) > 0 {
		envelope.WriteError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "Data pelanggan tidak valid.", details)
		return
	}
	updated, err := h.repo.UpdateCustomer(r.Context(), chi.URLParam(r, "id"), req)
	if err != nil {
		if errors.Is(err, ErrCustomerNotFound) {
			envelope.WriteError(w, r, http.StatusNotFound, "CUSTOMER_NOT_FOUND", "Pelanggan tidak ditemukan.", nil)
			return
		}
		envelope.WriteError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Gagal memperbarui pelanggan.", nil)
		return
	}
	envelope.Write(w, r, http.StatusOK, updated)
}

// ListPets handles GET /api/v1/pets?customer_id=
func (h *Handler) ListPets(w http.ResponseWriter, r *http.Request) {
	list, err := h.repo.ListPets(r.Context(), r.URL.Query().Get("customer_id"))
	if err != nil {
		envelope.WriteError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Gagal memuat data hewan.", nil)
		return
	}
	if list == nil {
		list = make([]Pet, 0)
	}
	envelope.Write(w, r, http.StatusOK, list)
}

// CreatePet handles POST /api/v1/pets
func (h *Handler) CreatePet(w http.ResponseWriter, r *http.Request) {
	var req UpsertPetRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		envelope.WriteError(w, r, http.StatusBadRequest, "INVALID_REQUEST", "Request payload must be valid JSON.", nil)
		return
	}
	req, details := validatePet(req)
	if len(details) > 0 {
		envelope.WriteError(w, r, http.StatusUnprocessableEntity, "VALIDATION_FAILED", "Data hewan tidak valid.", details)
		return
	}
	created, err := h.repo.CreatePet(r.Context(), req)
	if err != nil {
		if errors.Is(err, ErrCustomerNotFound) {
			envelope.WriteError(w, r, http.StatusUnprocessableEntity, "CUSTOMER_NOT_FOUND", "Pemilik hewan tidak ditemukan.", nil)
			return
		}
		envelope.WriteError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Gagal menyimpan data hewan.", nil)
		return
	}
	envelope.Write(w, r, http.StatusCreated, created)
}

// GetPet handles GET /api/v1/pets/{id}
func (h *Handler) GetPet(w http.ResponseWriter, r *http.Request) {
	p, err := h.repo.GetPetByID(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		if errors.Is(err, ErrPetNotFound) {
			envelope.WriteError(w, r, http.StatusNotFound, "PET_NOT_FOUND", "Data hewan tidak ditemukan.", nil)
			return
		}
		envelope.WriteError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Gagal memuat data hewan.", nil)
		return
	}
	envelope.Write(w, r, http.StatusOK, p)
}

// UpdatePet handles PUT /api/v1/pets/{id}
func (h *Handler) UpdatePet(w http.ResponseWriter, r *http.Request) {
	var req UpsertPetRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		envelope.WriteError(w, r, http.StatusBadRequest, "INVALID_REQUEST", "Request payload must be valid JSON.", nil)
		return
	}
	req, details := validatePet(req)
	if len(details) > 0 {
		envelope.WriteError(w, r, http.StatusUnprocessableEntity, "VALIDATION_FAILED", "Data hewan tidak valid.", details)
		return
	}
	updated, err := h.repo.UpdatePet(r.Context(), chi.URLParam(r, "id"), req)
	if err != nil {
		if errors.Is(err, ErrPetNotFound) {
			envelope.WriteError(w, r, http.StatusNotFound, "PET_NOT_FOUND", "Data hewan tidak ditemukan.", nil)
			return
		}
		envelope.WriteError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Gagal memperbarui data hewan.", nil)
		return
	}
	envelope.Write(w, r, http.StatusOK, updated)
}

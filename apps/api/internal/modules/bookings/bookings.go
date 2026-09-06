package bookings

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
	"github.com/muhri/ai-operational-pos/apps/api/internal/modules/customers"
	"github.com/muhri/ai-operational-pos/apps/api/internal/modules/orders"
	"github.com/muhri/ai-operational-pos/apps/api/internal/modules/services"
	"github.com/muhri/ai-operational-pos/apps/api/internal/platform/envelope"
	"github.com/muhri/ai-operational-pos/apps/api/internal/platform/tenantcontext"
)

var (
	ErrBookingNotFound  = errors.New("booking not found")
	ErrInvalidStatus    = errors.New("invalid booking status transition")
	ErrAlreadyClosed    = errors.New("booking is already closed")
	ErrOrderCreatorDown = errors.New("order settlement is unavailable")
)

const (
	StatusAntre   = "antre"
	StatusProses  = "proses"
	StatusSelesai = "selesai"
	StatusBatal   = "batal"
)

// Booking represents a scheduled pet-care service visit.
type Booking struct {
	ID          string    `json:"id"`
	TenantID    string    `json:"tenant_id"`
	CustomerID  string    `json:"customer_id"`
	PetID       string    `json:"pet_id"`
	ServiceID   *string   `json:"service_id,omitempty"`
	PackageID   *string   `json:"package_id,omitempty"`
	LocationID  string    `json:"location_id"`
	ScheduledAt time.Time `json:"scheduled_at"`
	Status      string    `json:"status"`
	StaffName   string    `json:"staff_name"`
	Notes       string    `json:"notes"`
	OrderID     *string   `json:"order_id,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// UpsertBookingRequest defines the payload to create a booking.
type UpsertBookingRequest struct {
	CustomerID  string  `json:"customer_id"`
	PetID       string  `json:"pet_id"`
	ServiceID   *string `json:"service_id,omitempty"`
	PackageID   *string `json:"package_id,omitempty"`
	LocationID  string  `json:"location_id"`
	ScheduledAt string  `json:"scheduled_at"`
	StaffName   string  `json:"staff_name,omitempty"`
	Notes       string  `json:"notes,omitempty"`
}

// StatusRequest moves a booking to proses or batal.
type StatusRequest struct {
	Status string `json:"status"`
	Notes  string `json:"notes,omitempty"`
}

// CompleteRequest settles a booking into a POS order.
type CompleteRequest struct {
	PaymentMethod    string `json:"payment_method"`
	PaidAmountIDR    int64  `json:"paid_amount_idr"`
	CashAmountIDR    *int64 `json:"cash_amount_idr,omitempty"`
	NonCashAmountIDR *int64 `json:"non_cash_amount_idr,omitempty"`
	Notes            string `json:"notes,omitempty"`
}

// BookingFilter scopes list queries.
type BookingFilter struct {
	Status string
	Date   string
}

// Repository defines persistence for bookings.
type Repository interface {
	Create(ctx context.Context, b Booking) (Booking, error)
	List(ctx context.Context, filter BookingFilter) ([]Booking, error)
	GetByID(ctx context.Context, id string) (Booking, error)
	UpdateStatus(ctx context.Context, id, status, notes string) (Booking, error)
	MarkCompleted(ctx context.Context, id, orderID string) (Booking, error)
}

// MemoryRepository provides thread-safe in-memory storage.
type MemoryRepository struct {
	mu       sync.RWMutex
	bookings []Booking
}

func NewMemoryRepository() *MemoryRepository {
	return &MemoryRepository{bookings: make([]Booking, 0)}
}

func (m *MemoryRepository) Create(ctx context.Context, b Booking) (Booking, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	now := time.Now().UTC()
	b.ID = fmt.Sprintf("book-%d", len(m.bookings)+1)
	b.TenantID = tenantcontext.FromContext(ctx)
	b.Status = StatusAntre
	b.CreatedAt = now
	b.UpdatedAt = now
	m.bookings = append(m.bookings, b)
	return b, nil
}

func matchFilter(b Booking, filter BookingFilter, tenantID string) bool {
	if b.TenantID != tenantID {
		return false
	}
	if filter.Status != "" && b.Status != filter.Status {
		return false
	}
	if filter.Date != "" && b.ScheduledAt.UTC().Format("2006-01-02") != filter.Date {
		return false
	}
	return true
}

func (m *MemoryRepository) List(ctx context.Context, filter BookingFilter) ([]Booking, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	tenantID := tenantcontext.FromContext(ctx)
	result := make([]Booking, 0, len(m.bookings))
	for _, b := range m.bookings {
		if matchFilter(b, filter, tenantID) {
			result = append(result, b)
		}
	}
	return result, nil
}

func (m *MemoryRepository) GetByID(ctx context.Context, id string) (Booking, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	tenantID := tenantcontext.FromContext(ctx)
	for _, b := range m.bookings {
		if b.ID == id && b.TenantID == tenantID {
			return b, nil
		}
	}
	return Booking{}, ErrBookingNotFound
}

func (m *MemoryRepository) UpdateStatus(ctx context.Context, id, status, notes string) (Booking, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	tenantID := tenantcontext.FromContext(ctx)
	for i, b := range m.bookings {
		if b.ID != id || b.TenantID != tenantID {
			continue
		}
		if b.Status == StatusSelesai || b.Status == StatusBatal {
			return Booking{}, ErrAlreadyClosed
		}
		if (b.Status == StatusAntre && status != StatusProses && status != StatusBatal) ||
			(b.Status == StatusProses && status != StatusBatal) {
			return Booking{}, ErrInvalidStatus
		}
		m.bookings[i].Status = status
		if strings.TrimSpace(notes) != "" {
			m.bookings[i].Notes = strings.TrimSpace(notes)
		}
		m.bookings[i].UpdatedAt = time.Now().UTC()
		return m.bookings[i], nil
	}
	return Booking{}, ErrBookingNotFound
}

func (m *MemoryRepository) MarkCompleted(ctx context.Context, id, orderID string) (Booking, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	tenantID := tenantcontext.FromContext(ctx)
	for i, b := range m.bookings {
		if b.ID != id || b.TenantID != tenantID {
			continue
		}
		if b.Status == StatusSelesai || b.Status == StatusBatal {
			return Booking{}, ErrAlreadyClosed
		}
		m.bookings[i].Status = StatusSelesai
		m.bookings[i].OrderID = &orderID
		m.bookings[i].UpdatedAt = time.Now().UTC()
		return m.bookings[i], nil
	}
	return Booking{}, ErrBookingNotFound
}

// PostgresRepository persists bookings in PostgreSQL.
type PostgresRepository struct {
	db *sql.DB
}

func NewPostgresRepository(db *sql.DB) *PostgresRepository {
	return &PostgresRepository{db: db}
}

const bookingColumns = "id, tenant_id, customer_id, pet_id, service_id, package_id, location_id, scheduled_at, status, staff_name, notes, order_id, created_at, updated_at"

func scanBooking(row interface {
	Scan(dest ...any) error
}) (Booking, error) {
	var b Booking
	var serviceID, packageID, orderID sql.NullString
	if err := row.Scan(&b.ID, &b.TenantID, &b.CustomerID, &b.PetID, &serviceID, &packageID,
		&b.LocationID, &b.ScheduledAt, &b.Status, &b.StaffName, &b.Notes, &orderID, &b.CreatedAt, &b.UpdatedAt); err != nil {
		return Booking{}, err
	}
	if serviceID.Valid {
		b.ServiceID = &serviceID.String
	}
	if packageID.Valid {
		b.PackageID = &packageID.String
	}
	if orderID.Valid {
		b.OrderID = &orderID.String
	}
	return b, nil
}

func nullStr(s *string) any {
	if s == nil || strings.TrimSpace(*s) == "" {
		return nil
	}
	return strings.TrimSpace(*s)
}

func (p *PostgresRepository) Create(ctx context.Context, b Booking) (Booking, error) {
	var created Booking
	err := p.db.QueryRowContext(ctx, `
		INSERT INTO bookings (tenant_id, customer_id, pet_id, service_id, package_id, location_id, scheduled_at, status, staff_name, notes)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING `+bookingColumns+`
	`, b.TenantID, b.CustomerID, b.PetID, nullStr(b.ServiceID), nullStr(b.PackageID),
		b.LocationID, b.ScheduledAt, StatusAntre, b.StaffName, b.Notes).Scan(
		&created.ID, &created.TenantID, &created.CustomerID, &created.PetID,
		&sql.NullString{}, &sql.NullString{}, &created.LocationID, &created.ScheduledAt,
		&created.Status, &created.StaffName, &created.Notes, &sql.NullString{},
		&created.CreatedAt, &created.UpdatedAt,
	)
	if err != nil {
		if strings.Contains(err.Error(), "foreign key") {
			return Booking{}, ErrBookingNotFound
		}
		return Booking{}, fmt.Errorf("insert booking: %w", err)
	}
	return p.GetByID(ctx, created.ID)
}

func (p *PostgresRepository) List(ctx context.Context, filter BookingFilter) ([]Booking, error) {
	query := `SELECT ` + bookingColumns + ` FROM bookings WHERE tenant_id = $1`
	args := []any{tenantcontext.FromContext(ctx)}
	if filter.Status != "" {
		query += fmt.Sprintf(` AND status = $%d`, len(args)+1)
		args = append(args, filter.Status)
	}
	if filter.Date != "" {
		query += fmt.Sprintf(` AND scheduled_at::date = $%d::date`, len(args)+1)
		args = append(args, filter.Date)
	}
	query += ` ORDER BY scheduled_at ASC`
	rows, err := p.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query bookings: %w", err)
	}
	defer rows.Close()

	result := make([]Booking, 0)
	for rows.Next() {
		b, err := scanBooking(rows)
		if err != nil {
			return nil, fmt.Errorf("scan booking: %w", err)
		}
		result = append(result, b)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate bookings: %w", err)
	}
	return result, nil
}

func (p *PostgresRepository) GetByID(ctx context.Context, id string) (Booking, error) {
	b, err := scanBooking(p.db.QueryRowContext(ctx, `
		SELECT `+bookingColumns+` FROM bookings WHERE id = $1 AND tenant_id = $2
	`, id, tenantcontext.FromContext(ctx)))
	if errors.Is(err, sql.ErrNoRows) {
		return Booking{}, ErrBookingNotFound
	}
	if err != nil {
		return Booking{}, fmt.Errorf("query booking: %w", err)
	}
	return b, nil
}

func (p *PostgresRepository) UpdateStatus(ctx context.Context, id, status, notes string) (Booking, error) {
	var current string
	err := p.db.QueryRowContext(ctx, `SELECT status FROM bookings WHERE id = $1 AND tenant_id = $2`,
		id, tenantcontext.FromContext(ctx)).Scan(&current)
	if errors.Is(err, sql.ErrNoRows) {
		return Booking{}, ErrBookingNotFound
	}
	if err != nil {
		return Booking{}, fmt.Errorf("query booking status: %w", err)
	}
	if current == StatusSelesai || current == StatusBatal {
		return Booking{}, ErrAlreadyClosed
	}
	if (current == StatusAntre && status != StatusProses && status != StatusBatal) ||
		(current == StatusProses && status != StatusBatal) {
		return Booking{}, ErrInvalidStatus
	}
	if strings.TrimSpace(notes) != "" {
		_, err = p.db.ExecContext(ctx, `UPDATE bookings SET status = $3, notes = $4, updated_at = now() WHERE id = $1 AND tenant_id = $2`,
			id, tenantcontext.FromContext(ctx), status, strings.TrimSpace(notes))
	} else {
		_, err = p.db.ExecContext(ctx, `UPDATE bookings SET status = $3, updated_at = now() WHERE id = $1 AND tenant_id = $2`,
			id, tenantcontext.FromContext(ctx), status)
	}
	if err != nil {
		return Booking{}, fmt.Errorf("update booking status: %w", err)
	}
	return p.GetByID(ctx, id)
}

func (p *PostgresRepository) MarkCompleted(ctx context.Context, id, orderID string) (Booking, error) {
	res, err := p.db.ExecContext(ctx, `
		UPDATE bookings SET status = $3, order_id = $4, updated_at = now()
		WHERE id = $1 AND tenant_id = $2 AND status IN ('antre', 'proses')
	`, id, tenantcontext.FromContext(ctx), StatusSelesai, orderID)
	if err != nil {
		return Booking{}, fmt.Errorf("complete booking: %w", err)
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return Booking{}, fmt.Errorf("complete booking rows: %w", err)
	}
	if affected == 0 {
		if _, err := p.GetByID(ctx, id); err != nil {
			return Booking{}, err
		}
		return Booking{}, ErrAlreadyClosed
	}
	return p.GetByID(ctx, id)
}

// Handler orchestrates bookings across customers, services, and order settlement.
type Handler struct {
	repo      Repository
	orders    orders.Repository
	services  services.Repository
	customers customers.Repository
}

func NewHandler(repo Repository, orderRepo orders.Repository, serviceRepo services.Repository, customerRepo customers.Repository) *Handler {
	return &Handler{repo: repo, orders: orderRepo, services: serviceRepo, customers: customerRepo}
}

func parseScheduledAt(raw string) (time.Time, bool) {
	for _, layout := range []string{time.RFC3339, "2006-01-02T15:04", "2006-01-02"} {
		if t, err := time.Parse(layout, strings.TrimSpace(raw)); err == nil {
			return t, true
		}
	}
	return time.Time{}, false
}

// resolveBookingRefs validates customer, pet, service/package and location,
// returning display names and the settlement price.
func (h *Handler) resolveBookingRefs(ctx context.Context, customerID, petID string, serviceID, packageID *string, locationID string) (petName, itemName, sku string, price int64, details map[string]string) {
	details = make(map[string]string)
	if strings.TrimSpace(customerID) == "" {
		details["customer_id"] = "Pelanggan wajib dipilih."
	} else if _, err := h.customers.GetCustomerByID(ctx, customerID); err != nil {
		details["customer_id"] = "Pelanggan tidak ditemukan."
	}
	pet, petErr := h.customers.GetPetByID(ctx, petID)
	if strings.TrimSpace(petID) == "" || petErr != nil {
		details["pet_id"] = "Hewan wajib dipilih dan terdaftar."
	} else {
		petName = pet.Name
	}
	hasService := serviceID != nil && strings.TrimSpace(*serviceID) != ""
	hasPackage := packageID != nil && strings.TrimSpace(*packageID) != ""
	if hasService == hasPackage {
		details["service_id"] = "Pilih tepat satu layanan atau satu paket."
		return "", "", "", 0, details
	}
	if strings.TrimSpace(locationID) == "" {
		details["location_id"] = "Lokasi layanan wajib diisi."
	}
	if hasService {
		svc, err := h.services.GetServiceByID(ctx, strings.TrimSpace(*serviceID))
		if err != nil {
			details["service_id"] = "Layanan tidak ditemukan."
			return "", "", "", 0, details
		}
		return petName, svc.Name, "JASA-" + strings.ToUpper(svc.Category), svc.PriceIDR, details
	}
	pkg, err := h.services.GetPackageByID(ctx, strings.TrimSpace(*packageID))
	if err != nil {
		details["package_id"] = "Paket tidak ditemukan."
		return "", "", "", 0, details
	}
	return petName, pkg.Name, "PAKET", pkg.PriceIDR, details
}

// Create handles POST /api/v1/bookings
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var req UpsertBookingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		envelope.WriteError(w, r, http.StatusBadRequest, "INVALID_REQUEST", "Request payload must be valid JSON.", nil)
		return
	}
	scheduledAt, ok := parseScheduledAt(req.ScheduledAt)
	if !ok {
		envelope.WriteError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "Jadwal tidak valid.",
			map[string]string{"scheduled_at": "Gunakan format tanggal RFC3339 (mis. 2026-09-07T10:00:00Z)."})
		return
	}
	_, _, _, _, details := h.resolveBookingRefs(r.Context(), req.CustomerID, req.PetID, req.ServiceID, req.PackageID, req.LocationID)
	if len(details) > 0 {
		envelope.WriteError(w, r, http.StatusUnprocessableEntity, "VALIDATION_FAILED", "Data booking tidak valid.", details)
		return
	}
	created, err := h.repo.Create(r.Context(), Booking{
		TenantID:    tenantcontext.FromContext(r.Context()),
		CustomerID:  strings.TrimSpace(req.CustomerID),
		PetID:       strings.TrimSpace(req.PetID),
		ServiceID:   req.ServiceID,
		PackageID:   req.PackageID,
		LocationID:  strings.TrimSpace(req.LocationID),
		ScheduledAt: scheduledAt,
		StaffName:   strings.TrimSpace(req.StaffName),
		Notes:       strings.TrimSpace(req.Notes),
	})
	if err != nil {
		if errors.Is(err, ErrBookingNotFound) {
			envelope.WriteError(w, r, http.StatusUnprocessableEntity, "REFERENCE_NOT_FOUND", "Relasi booking tidak valid.", nil)
			return
		}
		envelope.WriteError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Gagal menyimpan booking.", nil)
		return
	}
	envelope.Write(w, r, http.StatusCreated, created)
}

// List handles GET /api/v1/bookings?status=&date=
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	list, err := h.repo.List(r.Context(), BookingFilter{
		Status: r.URL.Query().Get("status"),
		Date:   r.URL.Query().Get("date"),
	})
	if err != nil {
		envelope.WriteError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Gagal memuat booking.", nil)
		return
	}
	if list == nil {
		list = make([]Booking, 0)
	}
	envelope.Write(w, r, http.StatusOK, list)
}

// GetByID handles GET /api/v1/bookings/{id}
func (h *Handler) GetByID(w http.ResponseWriter, r *http.Request) {
	b, err := h.repo.GetByID(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		if errors.Is(err, ErrBookingNotFound) {
			envelope.WriteError(w, r, http.StatusNotFound, "BOOKING_NOT_FOUND", "Booking tidak ditemukan.", nil)
			return
		}
		envelope.WriteError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Gagal memuat booking.", nil)
		return
	}
	envelope.Write(w, r, http.StatusOK, b)
}

// ChangeStatus handles POST /api/v1/bookings/{id}/status (proses/batal only)
func (h *Handler) ChangeStatus(w http.ResponseWriter, r *http.Request) {
	var req StatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		envelope.WriteError(w, r, http.StatusBadRequest, "INVALID_REQUEST", "Request payload must be valid JSON.", nil)
		return
	}
	status := strings.TrimSpace(req.Status)
	if status != StatusProses && status != StatusBatal {
		envelope.WriteError(w, r, http.StatusUnprocessableEntity, "VALIDATION_FAILED",
			"Status hanya boleh proses atau batal. Selesai wajib lewat pembayaran.",
			map[string]string{"status": "Gunakan endpoint complete untuk menyelesaikan booking."})
		return
	}
	updated, err := h.repo.UpdateStatus(r.Context(), chi.URLParam(r, "id"), status, req.Notes)
	if err != nil {
		switch {
		case errors.Is(err, ErrBookingNotFound):
			envelope.WriteError(w, r, http.StatusNotFound, "BOOKING_NOT_FOUND", "Booking tidak ditemukan.", nil)
		case errors.Is(err, ErrAlreadyClosed):
			envelope.WriteError(w, r, http.StatusConflict, "BOOKING_CLOSED", "Booking sudah selesai atau batal.", nil)
		case errors.Is(err, ErrInvalidStatus):
			envelope.WriteError(w, r, http.StatusUnprocessableEntity, "INVALID_STATUS", "Transisi status tidak valid.", nil)
		default:
			envelope.WriteError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Gagal memperbarui status.", nil)
		}
		return
	}
	envelope.Write(w, r, http.StatusOK, updated)
}

// Complete handles POST /api/v1/bookings/{id}/complete (settle into a POS order)
func (h *Handler) Complete(w http.ResponseWriter, r *http.Request) {
	var req CompleteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		envelope.WriteError(w, r, http.StatusBadRequest, "INVALID_REQUEST", "Request payload must be valid JSON.", nil)
		return
	}
	if h.orders == nil {
		envelope.WriteError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Layanan penyelesaian order tidak tersedia.", nil)
		return
	}

	b, err := h.repo.GetByID(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		if errors.Is(err, ErrBookingNotFound) {
			envelope.WriteError(w, r, http.StatusNotFound, "BOOKING_NOT_FOUND", "Booking tidak ditemukan.", nil)
			return
		}
		envelope.WriteError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Gagal memuat booking.", nil)
		return
	}
	if b.Status == StatusSelesai || b.Status == StatusBatal {
		envelope.WriteError(w, r, http.StatusConflict, "BOOKING_CLOSED", "Booking sudah selesai atau batal.", nil)
		return
	}

	_, itemName, sku, price, details := h.resolveBookingRefs(r.Context(), b.CustomerID, b.PetID, b.ServiceID, b.PackageID, b.LocationID)
	if len(details) > 0 {
		envelope.WriteError(w, r, http.StatusUnprocessableEntity, "VALIDATION_FAILED", "Relasi booking tidak valid.", details)
		return
	}

	var serviceID *string
	if b.ServiceID != nil && strings.TrimSpace(*b.ServiceID) != "" {
		trimmed := strings.TrimSpace(*b.ServiceID)
		serviceID = &trimmed
	}
	notes := fmt.Sprintf("Booking %s (%s)", b.ID, itemName)
	if strings.TrimSpace(req.Notes) != "" {
		notes += " - " + strings.TrimSpace(req.Notes)
	}
	order, err := h.orders.CreateOrder(r.Context(), orders.CreateOrderRequest{
		LocationID:       b.LocationID,
		PaymentMethod:    req.PaymentMethod,
		PaidAmountIDR:    req.PaidAmountIDR,
		CashAmountIDR:    req.CashAmountIDR,
		NonCashAmountIDR: req.NonCashAmountIDR,
		Notes:            notes,
		Items: []orders.CreateOrderItemRequest{{
			ProductName:  itemName,
			SKU:          sku,
			UnitPriceIDR: price,
			Quantity:     1,
			ItemKind:     orders.ItemKindJasa,
			ServiceID:    serviceID,
		}},
	})
	if err != nil {
		envelope.WriteError(w, r, http.StatusUnprocessableEntity, "ORDER_FAILED", "Pembayaran booking gagal: "+err.Error(), nil)
		return
	}

	completed, err := h.repo.MarkCompleted(r.Context(), b.ID, order.ID)
	if err != nil {
		envelope.WriteError(w, r, http.StatusConflict, "BOOKING_CLOSED", "Booking berubah saat penyelesaian.", map[string]string{"order_id": order.ID})
		return
	}
	envelope.Write(w, r, http.StatusOK, map[string]any{"booking": completed, "order": order})
}

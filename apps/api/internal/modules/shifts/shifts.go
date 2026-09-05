package shifts

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
	ErrShiftNotFound       = errors.New("shift not found")
	ErrShiftAlreadyOpen    = errors.New("a cashier shift is already active for this store")
	ErrNoActiveShift       = errors.New("no active cashier shift found for this store")
	ErrShiftAlreadyClosed  = errors.New("shift is already closed")
	ErrInvalidStartingCash = errors.New("starting cash cannot be negative")
	ErrInvalidActualCash   = errors.New("actual cash cannot be negative")
	ErrCashierNameRequired = errors.New("cashier name is required")
)

// Shift represents a cashier session with cash drawer tracking.
type Shift struct {
	ID                   string     `json:"id"`
	TenantID             string     `json:"tenant_id"`
	CashierID            *string    `json:"cashier_id,omitempty"`
	CashierName          string     `json:"cashier_name"`
	Status               string     `json:"status"` // "open" | "closed"
	StartingCashIDR      int64      `json:"starting_cash_idr"`
	ExpectedCashIDR      int64      `json:"expected_cash_idr"`
	ActualCashIDR        int64      `json:"actual_cash_idr"`
	CashDifferenceIDR    int64      `json:"cash_difference_idr"`
	TotalCashSalesIDR    int64      `json:"total_cash_sales_idr"`
	TotalNonCashSalesIDR int64      `json:"total_non_cash_sales_idr"`
	TransactionCount     int        `json:"transaction_count"`
	Notes                string     `json:"notes"`
	OpenedAt             time.Time  `json:"opened_at"`
	ClosedAt             *time.Time `json:"closed_at,omitempty"`
}

// OpenShiftRequest defines payload to start a new cashier session.
type OpenShiftRequest struct {
	CashierName     string  `json:"cashier_name"`
	CashierID       *string `json:"cashier_id,omitempty"`
	StartingCashIDR int64   `json:"starting_cash_idr"`
	Notes           string  `json:"notes,omitempty"`
}

// CloseShiftRequest defines payload to reconcile cash and close a shift.
type CloseShiftRequest struct {
	ActualCashIDR int64  `json:"actual_cash_idr"`
	Notes         string `json:"notes,omitempty"`
}

// Repository handles shift lifecycle and persistence.
type Repository interface {
	OpenShift(ctx context.Context, req OpenShiftRequest) (Shift, error)
	GetCurrentShift(ctx context.Context) (*Shift, error)
	CloseShift(ctx context.Context, shiftID string, req CloseShiftRequest) (Shift, error)
	ListShifts(ctx context.Context, limit int) ([]Shift, error)
	GetShiftByID(ctx context.Context, id string) (Shift, error)
	RecordSale(ctx context.Context, tenantID string, paymentMethod string, totalIDR int64, cashAmountIDR int64, nonCashAmountIDR int64) error
}

// MemoryRepository implements Repository in memory.
type MemoryRepository struct {
	mu     sync.RWMutex
	shifts []Shift
}

func NewMemoryRepository() *MemoryRepository {
	return &MemoryRepository{
		shifts: make([]Shift, 0),
	}
}

func (m *MemoryRepository) OpenShift(ctx context.Context, req OpenShiftRequest) (Shift, error) {
	tenantID := tenantcontext.FromContext(ctx)
	req.CashierName = strings.TrimSpace(req.CashierName)
	if req.CashierName == "" {
		return Shift{}, ErrCashierNameRequired
	}
	if req.StartingCashIDR < 0 {
		return Shift{}, ErrInvalidStartingCash
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	// Check if an open shift already exists for this tenant
	for _, s := range m.shifts {
		if s.TenantID == tenantID && s.Status == "open" {
			return Shift{}, ErrShiftAlreadyOpen
		}
	}

	now := time.Now().UTC()
	shift := Shift{
		ID:                   fmt.Sprintf("shift-%d", len(m.shifts)+1),
		TenantID:             tenantID,
		CashierID:            req.CashierID,
		CashierName:          req.CashierName,
		Status:               "open",
		StartingCashIDR:      req.StartingCashIDR,
		ExpectedCashIDR:      req.StartingCashIDR, // Initially equals starting cash
		ActualCashIDR:        0,
		CashDifferenceIDR:    0,
		TotalCashSalesIDR:    0,
		TotalNonCashSalesIDR: 0,
		TransactionCount:     0,
		Notes:                strings.TrimSpace(req.Notes),
		OpenedAt:             now,
		ClosedAt:             nil,
	}

	m.shifts = append(m.shifts, shift)
	return shift, nil
}

func (m *MemoryRepository) GetCurrentShift(ctx context.Context) (*Shift, error) {
	tenantID := tenantcontext.FromContext(ctx)
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, s := range m.shifts {
		if s.TenantID == tenantID && s.Status == "open" {
			copyShift := s
			return &copyShift, nil
		}
	}

	return nil, nil
}

func (m *MemoryRepository) CloseShift(ctx context.Context, shiftID string, req CloseShiftRequest) (Shift, error) {
	tenantID := tenantcontext.FromContext(ctx)
	if req.ActualCashIDR < 0 {
		return Shift{}, ErrInvalidActualCash
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	var targetIndex = -1
	for i, s := range m.shifts {
		if s.TenantID == tenantID {
			if shiftID == "" && s.Status == "open" {
				targetIndex = i
				break
			}
			if s.ID == shiftID {
				targetIndex = i
				break
			}
		}
	}

	if targetIndex == -1 {
		if shiftID == "" {
			return Shift{}, ErrNoActiveShift
		}
		return Shift{}, ErrShiftNotFound
	}

	shift := &m.shifts[targetIndex]
	if shift.Status == "closed" {
		return Shift{}, ErrShiftAlreadyClosed
	}

	now := time.Now().UTC()
	shift.Status = "closed"
	shift.ClosedAt = &now
	shift.ActualCashIDR = req.ActualCashIDR
	shift.ExpectedCashIDR = shift.StartingCashIDR + shift.TotalCashSalesIDR
	shift.CashDifferenceIDR = shift.ActualCashIDR - shift.ExpectedCashIDR
	if req.Notes != "" {
		if shift.Notes != "" {
			shift.Notes = shift.Notes + " | " + strings.TrimSpace(req.Notes)
		} else {
			shift.Notes = strings.TrimSpace(req.Notes)
		}
	}

	return *shift, nil
}

func (m *MemoryRepository) ListShifts(ctx context.Context, limit int) ([]Shift, error) {
	tenantID := tenantcontext.FromContext(ctx)
	if limit <= 0 {
		limit = 50
	}

	m.mu.RLock()
	defer m.mu.RUnlock()

	var result []Shift
	// Iterate in reverse for latest first
	for i := len(m.shifts) - 1; i >= 0; i-- {
		if m.shifts[i].TenantID == tenantID {
			result = append(result, m.shifts[i])
			if len(result) >= limit {
				break
			}
		}
	}

	if result == nil {
		result = make([]Shift, 0)
	}
	return result, nil
}

func (m *MemoryRepository) GetShiftByID(ctx context.Context, id string) (Shift, error) {
	tenantID := tenantcontext.FromContext(ctx)
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, s := range m.shifts {
		if s.TenantID == tenantID && s.ID == id {
			return s, nil
		}
	}
	return Shift{}, ErrShiftNotFound
}

func (m *MemoryRepository) RecordSale(_ context.Context, tenantID string, paymentMethod string, totalIDR int64, cashAmountIDR int64, nonCashAmountIDR int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	for i := range m.shifts {
		if m.shifts[i].TenantID == tenantID && m.shifts[i].Status == "open" {
			m.shifts[i].TransactionCount++
			if paymentMethod == "split" {
				m.shifts[i].TotalCashSalesIDR += cashAmountIDR
				m.shifts[i].ExpectedCashIDR = m.shifts[i].StartingCashIDR + m.shifts[i].TotalCashSalesIDR
				m.shifts[i].TotalNonCashSalesIDR += nonCashAmountIDR
			} else if paymentMethod == "cash" {
				m.shifts[i].TotalCashSalesIDR += totalIDR
				m.shifts[i].ExpectedCashIDR = m.shifts[i].StartingCashIDR + m.shifts[i].TotalCashSalesIDR
			} else {
				m.shifts[i].TotalNonCashSalesIDR += totalIDR
			}
			break
		}
	}
	return nil
}

// PostgresRepository implements Repository using PostgreSQL.
type PostgresRepository struct {
	db *sql.DB
}

func NewPostgresRepository(db *sql.DB) *PostgresRepository {
	return &PostgresRepository{db: db}
}

func (p *PostgresRepository) OpenShift(ctx context.Context, req OpenShiftRequest) (Shift, error) {
	tenantID := tenantcontext.FromContext(ctx)
	req.CashierName = strings.TrimSpace(req.CashierName)
	if req.CashierName == "" {
		return Shift{}, ErrCashierNameRequired
	}
	if req.StartingCashIDR < 0 {
		return Shift{}, ErrInvalidStartingCash
	}

	// Check if already open
	var existingID string
	err := p.db.QueryRowContext(ctx,
		`SELECT id FROM cashier_shifts WHERE tenant_id = $1 AND status = 'open' LIMIT 1`,
		tenantID,
	).Scan(&existingID)
	if err == nil {
		return Shift{}, ErrShiftAlreadyOpen
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return Shift{}, err
	}

	query := `
		INSERT INTO cashier_shifts (
			tenant_id, cashier_id, cashier_name, status,
			starting_cash_idr, expected_cash_idr, actual_cash_idr,
			cash_difference_idr, total_cash_sales_idr, total_non_cash_sales_idr,
			transaction_count, notes, opened_at
		) VALUES ($1, $2, $3, 'open', $4, $4, 0, 0, 0, 0, 0, $5, now())
		RETURNING id, tenant_id, cashier_id, cashier_name, status,
		          starting_cash_idr, expected_cash_idr, actual_cash_idr,
		          cash_difference_idr, total_cash_sales_idr, total_non_cash_sales_idr,
		          transaction_count, notes, opened_at, closed_at
	`

	var s Shift
	var cashierID sql.NullString
	var closedAt sql.NullTime

	err = p.db.QueryRowContext(ctx, query,
		tenantID, req.CashierID, req.CashierName, req.StartingCashIDR, strings.TrimSpace(req.Notes),
	).Scan(
		&s.ID, &s.TenantID, &cashierID, &s.CashierName, &s.Status,
		&s.StartingCashIDR, &s.ExpectedCashIDR, &s.ActualCashIDR,
		&s.CashDifferenceIDR, &s.TotalCashSalesIDR, &s.TotalNonCashSalesIDR,
		&s.TransactionCount, &s.Notes, &s.OpenedAt, &closedAt,
	)
	if err != nil {
		return Shift{}, err
	}
	if cashierID.Valid {
		s.CashierID = &cashierID.String
	}
	if closedAt.Valid {
		s.ClosedAt = &closedAt.Time
	}
	return s, nil
}

func (p *PostgresRepository) GetCurrentShift(ctx context.Context) (*Shift, error) {
	tenantID := tenantcontext.FromContext(ctx)
	query := `
		SELECT id, tenant_id, cashier_id, cashier_name, status,
		       starting_cash_idr, expected_cash_idr, actual_cash_idr,
		       cash_difference_idr, total_cash_sales_idr, total_non_cash_sales_idr,
		       transaction_count, notes, opened_at, closed_at
		FROM cashier_shifts
		WHERE tenant_id = $1 AND status = 'open'
		ORDER BY opened_at DESC
		LIMIT 1
	`
	var s Shift
	var cashierID sql.NullString
	var closedAt sql.NullTime

	err := p.db.QueryRowContext(ctx, query, tenantID).Scan(
		&s.ID, &s.TenantID, &cashierID, &s.CashierName, &s.Status,
		&s.StartingCashIDR, &s.ExpectedCashIDR, &s.ActualCashIDR,
		&s.CashDifferenceIDR, &s.TotalCashSalesIDR, &s.TotalNonCashSalesIDR,
		&s.TransactionCount, &s.Notes, &s.OpenedAt, &closedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if cashierID.Valid {
		s.CashierID = &cashierID.String
	}
	if closedAt.Valid {
		s.ClosedAt = &closedAt.Time
	}
	return &s, nil
}

func (p *PostgresRepository) CloseShift(ctx context.Context, shiftID string, req CloseShiftRequest) (Shift, error) {
	tenantID := tenantcontext.FromContext(ctx)
	if req.ActualCashIDR < 0 {
		return Shift{}, ErrInvalidActualCash
	}

	var current Shift
	var err error
	if shiftID == "" {
		cur, errCur := p.GetCurrentShift(ctx)
		if errCur != nil {
			return Shift{}, errCur
		}
		if cur == nil {
			return Shift{}, ErrNoActiveShift
		}
		current = *cur
		shiftID = current.ID
	} else {
		current, err = p.GetShiftByID(ctx, shiftID)
		if err != nil {
			return Shift{}, err
		}
	}

	if current.Status == "closed" {
		return Shift{}, ErrShiftAlreadyClosed
	}

	expectedCash := current.StartingCashIDR + current.TotalCashSalesIDR
	difference := req.ActualCashIDR - expectedCash
	notes := current.Notes
	if req.Notes != "" {
		if notes != "" {
			notes = notes + " | " + strings.TrimSpace(req.Notes)
		} else {
			notes = strings.TrimSpace(req.Notes)
		}
	}

	query := `
		UPDATE cashier_shifts
		SET status = 'closed',
		    actual_cash_idr = $1,
		    expected_cash_idr = $2,
		    cash_difference_idr = $3,
		    notes = $4,
		    closed_at = now()
		WHERE id = $5 AND tenant_id = $6
		RETURNING id, tenant_id, cashier_id, cashier_name, status,
		          starting_cash_idr, expected_cash_idr, actual_cash_idr,
		          cash_difference_idr, total_cash_sales_idr, total_non_cash_sales_idr,
		          transaction_count, notes, opened_at, closed_at
	`

	var s Shift
	var cashierID sql.NullString
	var closedAt sql.NullTime

	err = p.db.QueryRowContext(ctx, query,
		req.ActualCashIDR, expectedCash, difference, notes, shiftID, tenantID,
	).Scan(
		&s.ID, &s.TenantID, &cashierID, &s.CashierName, &s.Status,
		&s.StartingCashIDR, &s.ExpectedCashIDR, &s.ActualCashIDR,
		&s.CashDifferenceIDR, &s.TotalCashSalesIDR, &s.TotalNonCashSalesIDR,
		&s.TransactionCount, &s.Notes, &s.OpenedAt, &closedAt,
	)
	if err != nil {
		return Shift{}, err
	}
	if cashierID.Valid {
		s.CashierID = &cashierID.String
	}
	if closedAt.Valid {
		s.ClosedAt = &closedAt.Time
	}
	return s, nil
}

func (p *PostgresRepository) ListShifts(ctx context.Context, limit int) ([]Shift, error) {
	tenantID := tenantcontext.FromContext(ctx)
	if limit <= 0 {
		limit = 50
	}

	query := `
		SELECT id, tenant_id, cashier_id, cashier_name, status,
		       starting_cash_idr, expected_cash_idr, actual_cash_idr,
		       cash_difference_idr, total_cash_sales_idr, total_non_cash_sales_idr,
		       transaction_count, notes, opened_at, closed_at
		FROM cashier_shifts
		WHERE tenant_id = $1
		ORDER BY opened_at DESC
		LIMIT $2
	`

	rows, err := p.db.QueryContext(ctx, query, tenantID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var shifts []Shift
	for rows.Next() {
		var s Shift
		var cashierID sql.NullString
		var closedAt sql.NullTime
		if err := rows.Scan(
			&s.ID, &s.TenantID, &cashierID, &s.CashierName, &s.Status,
			&s.StartingCashIDR, &s.ExpectedCashIDR, &s.ActualCashIDR,
			&s.CashDifferenceIDR, &s.TotalCashSalesIDR, &s.TotalNonCashSalesIDR,
			&s.TransactionCount, &s.Notes, &s.OpenedAt, &closedAt,
		); err != nil {
			return nil, err
		}
		if cashierID.Valid {
			s.CashierID = &cashierID.String
		}
		if closedAt.Valid {
			s.ClosedAt = &closedAt.Time
		}
		shifts = append(shifts, s)
	}

	if shifts == nil {
		shifts = make([]Shift, 0)
	}
	return shifts, nil
}

func (p *PostgresRepository) GetShiftByID(ctx context.Context, id string) (Shift, error) {
	tenantID := tenantcontext.FromContext(ctx)
	query := `
		SELECT id, tenant_id, cashier_id, cashier_name, status,
		       starting_cash_idr, expected_cash_idr, actual_cash_idr,
		       cash_difference_idr, total_cash_sales_idr, total_non_cash_sales_idr,
		       transaction_count, notes, opened_at, closed_at
		FROM cashier_shifts
		WHERE id = $1 AND tenant_id = $2
	`
	var s Shift
	var cashierID sql.NullString
	var closedAt sql.NullTime

	err := p.db.QueryRowContext(ctx, query, id, tenantID).Scan(
		&s.ID, &s.TenantID, &cashierID, &s.CashierName, &s.Status,
		&s.StartingCashIDR, &s.ExpectedCashIDR, &s.ActualCashIDR,
		&s.CashDifferenceIDR, &s.TotalCashSalesIDR, &s.TotalNonCashSalesIDR,
		&s.TransactionCount, &s.Notes, &s.OpenedAt, &closedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return Shift{}, ErrShiftNotFound
	}
	if err != nil {
		return Shift{}, err
	}
	if cashierID.Valid {
		s.CashierID = &cashierID.String
	}
	if closedAt.Valid {
		s.ClosedAt = &closedAt.Time
	}
	return s, nil
}

func (p *PostgresRepository) RecordSale(ctx context.Context, tenantID string, paymentMethod string, totalIDR int64, cashAmountIDR int64, nonCashAmountIDR int64) error {
	var query string
	var args []any
	if paymentMethod == "split" {
		query = `
			UPDATE cashier_shifts
			SET transaction_count = transaction_count + 1,
			    total_cash_sales_idr = total_cash_sales_idr + $1,
			    expected_cash_idr = starting_cash_idr + total_cash_sales_idr + $1,
			    total_non_cash_sales_idr = total_non_cash_sales_idr + $2
			WHERE tenant_id = $3 AND status = 'open'
		`
		args = []any{cashAmountIDR, nonCashAmountIDR, tenantID}
	} else if paymentMethod == "cash" {
		query = `
			UPDATE cashier_shifts
			SET transaction_count = transaction_count + 1,
			    total_cash_sales_idr = total_cash_sales_idr + $1,
			    expected_cash_idr = starting_cash_idr + total_cash_sales_idr + $1
			WHERE tenant_id = $2 AND status = 'open'
		`
		args = []any{totalIDR, tenantID}
	} else {
		query = `
			UPDATE cashier_shifts
			SET transaction_count = transaction_count + 1,
			    total_non_cash_sales_idr = total_non_cash_sales_idr + $1
			WHERE tenant_id = $2 AND status = 'open'
		`
		args = []any{totalIDR, tenantID}
	}

	_, err := p.db.ExecContext(ctx, query, args...)
	return err
}

// Handler handles HTTP requests for shift management.
type Handler struct {
	repo Repository
}

func NewHandler(repo Repository) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) OpenShift(w http.ResponseWriter, r *http.Request) {
	var req OpenShiftRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		envelope.WriteError(w, r, http.StatusBadRequest, "INVALID_JSON", "Invalid request body.", nil)
		return
	}

	shift, err := h.repo.OpenShift(r.Context(), req)
	if err != nil {
		switch {
		case errors.Is(err, ErrCashierNameRequired):
			envelope.WriteError(w, r, http.StatusBadRequest, "INVALID_INPUT", err.Error(), nil)
		case errors.Is(err, ErrInvalidStartingCash):
			envelope.WriteError(w, r, http.StatusBadRequest, "INVALID_INPUT", err.Error(), nil)
		case errors.Is(err, ErrShiftAlreadyOpen):
			envelope.WriteError(w, r, http.StatusConflict, "SHIFT_ALREADY_OPEN", err.Error(), nil)
		default:
			envelope.WriteError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error(), nil)
		}
		return
	}

	envelope.Write(w, r, http.StatusCreated, shift)
}

func (h *Handler) GetCurrentShift(w http.ResponseWriter, r *http.Request) {
	shift, err := h.repo.GetCurrentShift(r.Context())
	if err != nil {
		envelope.WriteError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error(), nil)
		return
	}

	if shift == nil {
		envelope.Write[*Shift](w, r, http.StatusOK, nil)
		return
	}

	envelope.Write(w, r, http.StatusOK, shift)
}

func (h *Handler) CloseShift(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req CloseShiftRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		envelope.WriteError(w, r, http.StatusBadRequest, "INVALID_JSON", "Invalid request body.", nil)
		return
	}

	shift, err := h.repo.CloseShift(r.Context(), id, req)
	if err != nil {
		switch {
		case errors.Is(err, ErrNoActiveShift), errors.Is(err, ErrShiftNotFound):
			envelope.WriteError(w, r, http.StatusNotFound, "NOT_FOUND", err.Error(), nil)
		case errors.Is(err, ErrShiftAlreadyClosed):
			envelope.WriteError(w, r, http.StatusConflict, "SHIFT_ALREADY_CLOSED", err.Error(), nil)
		case errors.Is(err, ErrInvalidActualCash):
			envelope.WriteError(w, r, http.StatusBadRequest, "INVALID_INPUT", err.Error(), nil)
		default:
			envelope.WriteError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error(), nil)
		}
		return
	}

	envelope.Write(w, r, http.StatusOK, shift)
}

func (h *Handler) ListShifts(w http.ResponseWriter, r *http.Request) {
	shifts, err := h.repo.ListShifts(r.Context(), 50)
	if err != nil {
		envelope.WriteError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error(), nil)
		return
	}
	envelope.Write(w, r, http.StatusOK, shifts)
}

func (h *Handler) GetShiftByID(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	shift, err := h.repo.GetShiftByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, ErrShiftNotFound) {
			envelope.WriteError(w, r, http.StatusNotFound, "NOT_FOUND", err.Error(), nil)
			return
		}
		envelope.WriteError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", err.Error(), nil)
		return
	}
	envelope.Write(w, r, http.StatusOK, shift)
}

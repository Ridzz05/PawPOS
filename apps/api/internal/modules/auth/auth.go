package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"golang.org/x/crypto/bcrypt"

	"github.com/muhri/ai-operational-pos/apps/api/internal/platform/envelope"
	"github.com/muhri/ai-operational-pos/apps/api/internal/platform/tenantcontext"
)

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrSessionNotFound    = errors.New("session not found")
)

// ValidRoles mirrors the seeded roles table and frontend StaffRole.
var ValidRoles = map[string]bool{
	"owner":     true,
	"manager":   true,
	"cashier":   true,
	"warehouse": true,
}

func avatarForRole(role string) string {
	switch role {
	case "owner":
		return "👑"
	case "cashier":
		return "💳"
	case "warehouse":
		return "📦"
	case "manager":
		return "📋"
	default:
		return "👤"
	}
}

// User is the authenticated staff identity returned to clients.
type User struct {
	ID          string   `json:"id"`
	Email       string   `json:"email"`
	DisplayName string   `json:"display_name"`
	Role        string   `json:"role"`
	Avatar      string   `json:"avatar"`
	TenantID    string   `json:"tenant_id"`
	IsActive    bool     `json:"is_active"`
	Permissions []string `json:"permissions"`
}

// LoginRequest defines the email+password payload.
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// PinLoginRequest defines the fast cashier terminal payload.
type PinLoginRequest struct {
	Role string `json:"role"`
	PIN  string `json:"pin"`
}

// AuthResponse is returned on successful authentication.
type AuthResponse struct {
	Token     string    `json:"token"`
	ExpiresAt time.Time `json:"expires_at"`
	User      User      `json:"user"`
}

// Repository defines data access for authentication and sessions.
type Repository interface {
	AuthenticatePassword(ctx context.Context, tenantID, email, password string) (User, error)
	AuthenticatePIN(ctx context.Context, tenantID, role, pin string) (User, error)
	CreateSession(ctx context.Context, userID string, ttl time.Duration) (token string, expiresAt time.Time, err error)
	GetSessionUser(ctx context.Context, token string) (User, error)
	RevokeSession(ctx context.Context, token string) error
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func newToken() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("generate session token: %w", err)
	}
	return hex.EncodeToString(buf), nil
}

// seedCredential holds a demo staff account for the memory repository.
// Hashes are bcrypt(DefaultCost) of the public demo passwords.
type seedCredential struct {
	id           string
	email        string
	displayName  string
	passwordHash string
	pin          string
	role         string
	permissions  []string
}

var seedCredentials = []seedCredential{
	{
		id:           "staff-owner",
		email:        "owner@pawpos.id",
		displayName:  "Budi Santoso",
		passwordHash: "$2a$10$9WH.9UQOFMB9RxRZELjfh.wvRItZRaQ1bPhXsL3EwW2I8/lu4sILy",
		pin:          "9999",
		role:         "owner",
		permissions: []string{
			"access_dashboard", "access_pos", "access_orders", "access_products",
			"create_edit_products", "delete_products", "access_inventory",
			"record_stock_movement", "access_shifts", "reconcile_shifts",
			"access_settings", "register_store",
		},
	},
	{
		id:           "staff-manager",
		email:        "manager@pawpos.id",
		displayName:  "Dewi Lestari",
		passwordHash: "$2a$10$K91VY.gzE1i0y9tvbFJcu.3BKuhzO8njSntz3tl4QAwwV.9dGWLaS",
		pin:          "2026",
		role:         "manager",
		permissions: []string{
			"access_dashboard", "access_pos", "access_orders", "access_products",
			"create_edit_products", "access_inventory", "record_stock_movement",
			"access_shifts", "reconcile_shifts", "access_settings",
		},
	},
	{
		id:           "staff-cashier",
		email:        "kasir@pawpos.id",
		displayName:  "Siti Rahma",
		passwordHash: "$2a$10$QRQAbjEkkVv.pK4LKUaiE.w/0djIPSiBxD6KE0WOMGnzeJaoddOtq",
		pin:          "1234",
		role:         "cashier",
		permissions: []string{
			"access_pos", "access_orders", "access_shifts", "reconcile_shifts",
		},
	},
	{
		id:           "staff-warehouse",
		email:        "gudang@pawpos.id",
		displayName:  "Agus Pratama",
		passwordHash: "$2a$10$Hy0zQ/cwFJMUzZqAUUeS1uFgSx1HIVS/4Uh9MwulRNNe4LU1hADCO",
		pin:          "5678",
		role:         "warehouse",
		permissions: []string{
			"access_dashboard", "access_products", "access_inventory", "record_stock_movement",
		},
	},
}

type memorySession struct {
	userID    string
	expiresAt time.Time
}

// MemoryRepository provides thread-safe in-memory auth storage.
type MemoryRepository struct {
	mu       sync.RWMutex
	users    []seedCredential
	sessions map[string]memorySession
}

func NewMemoryRepository() *MemoryRepository {
	return &MemoryRepository{
		users:    seedCredentials,
		sessions: make(map[string]memorySession),
	}
}

func memoryUser(s seedCredential) User {
	perms := make([]string, len(s.permissions))
	copy(perms, s.permissions)
	return User{
		ID:          s.id,
		Email:       s.email,
		DisplayName: s.displayName,
		Role:        s.role,
		Avatar:      avatarForRole(s.role),
		TenantID:    tenantcontext.DefaultTenantID,
		IsActive:    true,
		Permissions: perms,
	}
}

func (m *MemoryRepository) AuthenticatePassword(_ context.Context, _ string, email, password string) (User, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	cleanEmail := strings.ToLower(strings.TrimSpace(email))
	for _, s := range m.users {
		if strings.ToLower(s.email) != cleanEmail {
			continue
		}
		if err := bcrypt.CompareHashAndPassword([]byte(s.passwordHash), []byte(password)); err != nil {
			return User{}, ErrInvalidCredentials
		}
		return memoryUser(s), nil
	}
	return User{}, ErrInvalidCredentials
}

func (m *MemoryRepository) AuthenticatePIN(_ context.Context, _ string, role, pin string) (User, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	cleanRole := strings.ToLower(strings.TrimSpace(role))
	for _, s := range m.users {
		if s.role != cleanRole {
			continue
		}
		if subtle.ConstantTimeCompare([]byte(s.pin), []byte(strings.TrimSpace(pin))) != 1 {
			return User{}, ErrInvalidCredentials
		}
		return memoryUser(s), nil
	}
	return User{}, ErrInvalidCredentials
}

func (m *MemoryRepository) CreateSession(_ context.Context, userID string, ttl time.Duration) (string, time.Time, error) {
	token, err := newToken()
	if err != nil {
		return "", time.Time{}, err
	}
	expiresAt := time.Now().UTC().Add(ttl)

	m.mu.Lock()
	defer m.mu.Unlock()
	m.sessions[hashToken(token)] = memorySession{userID: userID, expiresAt: expiresAt}
	return token, expiresAt, nil
}

func (m *MemoryRepository) GetSessionUser(_ context.Context, token string) (User, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	sess, ok := m.sessions[hashToken(strings.TrimSpace(token))]
	if !ok || time.Now().UTC().After(sess.expiresAt) {
		return User{}, ErrSessionNotFound
	}
	for _, s := range m.users {
		if s.id == sess.userID {
			return memoryUser(s), nil
		}
	}
	return User{}, ErrSessionNotFound
}

func (m *MemoryRepository) RevokeSession(_ context.Context, token string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	key := hashToken(strings.TrimSpace(token))
	if _, ok := m.sessions[key]; !ok {
		return ErrSessionNotFound
	}
	delete(m.sessions, key)
	return nil
}

// PostgresRepository manages auth against PostgreSQL using the
// users / roles / permissions / sessions tables from the migrations.
type PostgresRepository struct {
	db *sql.DB
}

func NewPostgresRepository(db *sql.DB) *PostgresRepository {
	return &PostgresRepository{db: db}
}

func (p *PostgresRepository) AuthenticatePassword(ctx context.Context, tenantID, email, password string) (User, error) {
	user, hash, err := p.findUser(ctx, tenantID, "u.email = $2", strings.ToLower(strings.TrimSpace(email)))
	if err != nil {
		return User{}, err
	}
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)); err != nil {
		return User{}, ErrInvalidCredentials
	}
	return user, nil
}

func (p *PostgresRepository) AuthenticatePIN(ctx context.Context, tenantID, role, pin string) (User, error) {
	cleanRole := strings.ToLower(strings.TrimSpace(role))
	if !ValidRoles[cleanRole] {
		return User{}, ErrInvalidCredentials
	}
	user, storedPIN, err := p.findUserWithPIN(ctx, tenantID, cleanRole)
	if err != nil {
		return User{}, err
	}
	if storedPIN == "" || subtle.ConstantTimeCompare([]byte(storedPIN), []byte(strings.TrimSpace(pin))) != 1 {
		return User{}, ErrInvalidCredentials
	}
	return user, nil
}

func (p *PostgresRepository) findUser(ctx context.Context, tenantID, extraWhere, extraArg string) (User, string, error) {
	query := fmt.Sprintf(`
		SELECT u.id, u.email, u.display_name, u.password_hash, u.pin, u.tenant_id, u.is_active, r.name
		FROM users u
		LEFT JOIN user_roles ur ON ur.user_id = u.id
		LEFT JOIN roles r ON r.id = ur.role_id
		WHERE u.tenant_id = $1 AND %s AND u.is_active = TRUE
		ORDER BY r.name ASC
		LIMIT 1
	`, extraWhere)
	var user User
	var hash string
	var pin sql.NullString
	var role sql.NullString
	err := p.db.QueryRowContext(ctx, query, tenantID, extraArg).Scan(
		&user.ID, &user.Email, &user.DisplayName, &hash, &pin, &user.TenantID, &user.IsActive, &role,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return User{}, "", ErrInvalidCredentials
	}
	if err != nil {
		return User{}, "", fmt.Errorf("query auth user: %w", err)
	}
	if role.Valid {
		user.Role = role.String
	} else {
		user.Role = "cashier"
	}
	user.Avatar = avatarForRole(user.Role)
	perms, err := p.listPermissions(ctx, user.ID)
	if err != nil {
		return User{}, "", err
	}
	user.Permissions = perms
	return user, hash, nil
}

func (p *PostgresRepository) findUserWithPIN(ctx context.Context, tenantID, role string) (User, string, error) {
	query := `
		SELECT u.id, u.email, u.display_name, u.password_hash, u.pin, u.tenant_id, u.is_active
		FROM users u
		JOIN user_roles ur ON ur.user_id = u.id
		JOIN roles r ON r.id = ur.role_id AND r.name = $2
		WHERE u.tenant_id = $1 AND u.is_active = TRUE
		ORDER BY u.created_at ASC
		LIMIT 1
	`
	var user User
	var hash string
	var pin sql.NullString
	err := p.db.QueryRowContext(ctx, query, tenantID, role).Scan(
		&user.ID, &user.Email, &user.DisplayName, &hash, &pin, &user.TenantID, &user.IsActive,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return User{}, "", ErrInvalidCredentials
	}
	if err != nil {
		return User{}, "", fmt.Errorf("query auth user by pin: %w", err)
	}
	user.Role = role
	user.Avatar = avatarForRole(role)
	perms, err := p.listPermissions(ctx, user.ID)
	if err != nil {
		return User{}, "", err
	}
	user.Permissions = perms
	storedPIN := ""
	if pin.Valid {
		storedPIN = pin.String
	}
	return user, storedPIN, nil
}

func (p *PostgresRepository) listPermissions(ctx context.Context, userID string) ([]string, error) {
	rows, err := p.db.QueryContext(ctx, `
		SELECT DISTINCT perm.code
		FROM permissions perm
		JOIN role_permissions rp ON rp.permission_id = perm.id
		JOIN user_roles ur ON ur.role_id = rp.role_id
		WHERE ur.user_id = $1
		ORDER BY perm.code ASC
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("query user permissions: %w", err)
	}
	defer rows.Close()

	perms := make([]string, 0)
	for rows.Next() {
		var code string
		if err := rows.Scan(&code); err != nil {
			return nil, fmt.Errorf("scan permission: %w", err)
		}
		perms = append(perms, code)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate permissions: %w", err)
	}
	return perms, nil
}

func (p *PostgresRepository) CreateSession(ctx context.Context, userID string, ttl time.Duration) (string, time.Time, error) {
	token, err := newToken()
	if err != nil {
		return "", time.Time{}, err
	}
	expiresAt := time.Now().UTC().Add(ttl)
	_, err = p.db.ExecContext(ctx, `
		INSERT INTO sessions (user_id, token_hash, expires_at)
		VALUES ($1, $2, $3)
	`, userID, hashToken(token), expiresAt)
	if err != nil {
		return "", time.Time{}, fmt.Errorf("insert session: %w", err)
	}
	return token, expiresAt, nil
}

func (p *PostgresRepository) GetSessionUser(ctx context.Context, token string) (User, error) {
	query := `
		SELECT u.id, u.email, u.display_name, u.tenant_id, u.is_active, r.name
		FROM sessions s
		JOIN users u ON u.id = s.user_id AND u.is_active = TRUE
		LEFT JOIN user_roles ur ON ur.user_id = u.id
		LEFT JOIN roles r ON r.id = ur.role_id
		WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now()
		ORDER BY r.name ASC
		LIMIT 1
	`
	var user User
	var role sql.NullString
	err := p.db.QueryRowContext(ctx, query, hashToken(strings.TrimSpace(token))).Scan(
		&user.ID, &user.Email, &user.DisplayName, &user.TenantID, &user.IsActive, &role,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return User{}, ErrSessionNotFound
	}
	if err != nil {
		return User{}, fmt.Errorf("query session user: %w", err)
	}
	if role.Valid {
		user.Role = role.String
	} else {
		user.Role = "cashier"
	}
	user.Avatar = avatarForRole(user.Role)
	perms, err := p.listPermissions(ctx, user.ID)
	if err != nil {
		return User{}, err
	}
	user.Permissions = perms
	return user, nil
}

func (p *PostgresRepository) RevokeSession(ctx context.Context, token string) error {
	res, err := p.db.ExecContext(ctx, `
		UPDATE sessions SET revoked_at = now()
		WHERE token_hash = $1 AND revoked_at IS NULL
	`, hashToken(strings.TrimSpace(token)))
	if err != nil {
		return fmt.Errorf("revoke session: %w", err)
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("revoke session rows: %w", err)
	}
	if affected == 0 {
		return ErrSessionNotFound
	}
	return nil
}

// Handler handles HTTP requests for authentication.
type Handler struct {
	repo       Repository
	sessionTTL time.Duration
}

func NewHandler(repo Repository, sessionTTL time.Duration) *Handler {
	if sessionTTL <= 0 {
		sessionTTL = 12 * time.Hour
	}
	return &Handler{repo: repo, sessionTTL: sessionTTL}
}

func (h *Handler) issueSession(w http.ResponseWriter, r *http.Request, user User) {
	token, expiresAt, err := h.repo.CreateSession(r.Context(), user.ID, h.sessionTTL)
	if err != nil {
		envelope.WriteError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Gagal membuat sesi login.", nil)
		return
	}
	envelope.Write(w, r, http.StatusOK, AuthResponse{Token: token, ExpiresAt: expiresAt, User: user})
}

// Login handles POST /api/v1/auth/login
func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		envelope.WriteError(w, r, http.StatusBadRequest, "INVALID_REQUEST", "Request payload must be valid JSON.", nil)
		return
	}
	req.Email = strings.TrimSpace(req.Email)
	if req.Email == "" || req.Password == "" {
		envelope.WriteError(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "Email dan kata sandi wajib diisi.",
			map[string]string{"email": "Email akun wajib diisi.", "password": "Kata sandi wajib diisi."})
		return
	}

	user, err := h.repo.AuthenticatePassword(r.Context(), tenantcontext.FromContext(r.Context()), req.Email, req.Password)
	if err != nil {
		if errors.Is(err, ErrInvalidCredentials) {
			envelope.WriteError(w, r, http.StatusUnauthorized, "INVALID_CREDENTIALS", "Email atau password akun tidak sesuai.", nil)
			return
		}
		envelope.WriteError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Gagal memproses login.", nil)
		return
	}
	h.issueSession(w, r, user)
}

// PinLogin handles POST /api/v1/auth/pin
func (h *Handler) PinLogin(w http.ResponseWriter, r *http.Request) {
	var req PinLoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		envelope.WriteError(w, r, http.StatusBadRequest, "INVALID_REQUEST", "Request payload must be valid JSON.", nil)
		return
	}
	req.Role = strings.ToLower(strings.TrimSpace(req.Role))
	req.PIN = strings.TrimSpace(req.PIN)
	if !ValidRoles[req.Role] || req.PIN == "" {
		envelope.WriteError(w, r, http.StatusUnprocessableEntity, "VALIDATION_FAILED", "Peran kasir dan PIN wajib valid.",
			map[string]string{"role": "Peran operator tidak dikenal.", "pin": "PIN kasir wajib diisi."})
		return
	}

	user, err := h.repo.AuthenticatePIN(r.Context(), tenantcontext.FromContext(r.Context()), req.Role, req.PIN)
	if err != nil {
		if errors.Is(err, ErrInvalidCredentials) {
			envelope.WriteError(w, r, http.StatusUnauthorized, "INVALID_CREDENTIALS", "PIN kasir salah. Silakan coba kembali.", nil)
			return
		}
		envelope.WriteError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Gagal memproses login PIN.", nil)
		return
	}
	h.issueSession(w, r, user)
}

func bearerToken(r *http.Request) string {
	header := r.Header.Get("Authorization")
	if header == "" {
		return ""
	}
	parts := strings.SplitN(header, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
		return ""
	}
	return strings.TrimSpace(parts[1])
}

// Me handles GET /api/v1/auth/me
func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	token := bearerToken(r)
	if token == "" {
		envelope.WriteError(w, r, http.StatusUnauthorized, "AUTH_REQUIRED", "Sesi login diperlukan.", nil)
		return
	}
	user, err := h.repo.GetSessionUser(r.Context(), token)
	if err != nil {
		if errors.Is(err, ErrSessionNotFound) {
			envelope.WriteError(w, r, http.StatusUnauthorized, "INVALID_SESSION", "Sesi tidak valid atau sudah kedaluwarsa.", nil)
			return
		}
		envelope.WriteError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Gagal memuat sesi.", nil)
		return
	}
	envelope.Write(w, r, http.StatusOK, user)
}

// Logout handles POST /api/v1/auth/logout
func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	token := bearerToken(r)
	if token == "" {
		envelope.WriteError(w, r, http.StatusUnauthorized, "AUTH_REQUIRED", "Sesi login diperlukan.", nil)
		return
	}
	if err := h.repo.RevokeSession(r.Context(), token); err != nil {
		if errors.Is(err, ErrSessionNotFound) {
			envelope.WriteError(w, r, http.StatusUnauthorized, "INVALID_SESSION", "Sesi tidak valid atau sudah keluar.", nil)
			return
		}
		envelope.WriteError(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Gagal mengakhiri sesi.", nil)
		return
	}
	envelope.Write(w, r, http.StatusOK, map[string]bool{"revoked": true})
}

package auth

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestMemoryAuthenticatePassword(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := t.Context()

	user, err := repo.AuthenticatePassword(ctx, "tenant-1", "OWNER@pawpos.id", "pawpos123")
	if err != nil {
		t.Fatalf("AuthenticatePassword = %v", err)
	}
	if user.Role != "owner" || len(user.Permissions) != 12 {
		t.Fatalf("unexpected owner user = %#v", user)
	}

	if _, err := repo.AuthenticatePassword(ctx, "tenant-1", "owner@pawpos.id", "wrong"); err != ErrInvalidCredentials {
		t.Fatalf("wrong password err = %v", err)
	}
	if _, err := repo.AuthenticatePassword(ctx, "tenant-1", "ghost@pawpos.id", "pawpos123"); err != ErrInvalidCredentials {
		t.Fatalf("unknown email err = %v", err)
	}
}

func TestMemoryAuthenticatePIN(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := t.Context()

	user, err := repo.AuthenticatePIN(ctx, "tenant-1", "cashier", "1234")
	if err != nil {
		t.Fatalf("AuthenticatePIN = %v", err)
	}
	if user.Email != "kasir@pawpos.id" {
		t.Fatalf("unexpected pin user = %#v", user)
	}

	if _, err := repo.AuthenticatePIN(ctx, "tenant-1", "cashier", "0000"); err != ErrInvalidCredentials {
		t.Fatalf("wrong pin err = %v", err)
	}
	if _, err := repo.AuthenticatePIN(ctx, "tenant-1", "stranger", "1234"); err != ErrInvalidCredentials {
		t.Fatalf("unknown role err = %v", err)
	}
}

func TestMemorySessionLifecycle(t *testing.T) {
	repo := NewMemoryRepository()
	ctx := t.Context()

	token, _, err := repo.CreateSession(ctx, "staff-cashier", time.Hour)
	if err != nil || token == "" {
		t.Fatalf("CreateSession = %v", err)
	}

	user, err := repo.GetSessionUser(ctx, token)
	if err != nil || user.Role != "cashier" {
		t.Fatalf("GetSessionUser = %#v, %v", user, err)
	}

	if err := repo.RevokeSession(ctx, token); err != nil {
		t.Fatalf("RevokeSession = %v", err)
	}
	if _, err := repo.GetSessionUser(ctx, token); err != ErrSessionNotFound {
		t.Fatalf("revoked session err = %v", err)
	}
	if _, err := repo.GetSessionUser(ctx, "bogus"); err != ErrSessionNotFound {
		t.Fatalf("bogus token err = %v", err)
	}

	expired, _, err := repo.CreateSession(ctx, "staff-cashier", -time.Hour)
	if err != nil {
		t.Fatalf("CreateSession expired = %v", err)
	}
	if _, err := repo.GetSessionUser(ctx, expired); err != ErrSessionNotFound {
		t.Fatalf("expired session err = %v", err)
	}
}

func doAuthRequest(t *testing.T, handler http.HandlerFunc, method, target, body, token string) (int, map[string]any) {
	t.Helper()
	var reader *bytes.Reader
	if body == "" {
		reader = bytes.NewReader(nil)
	} else {
		reader = bytes.NewReader([]byte(body))
	}
	req := httptest.NewRequest(method, target, reader)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	handler(rec, req)

	var payload map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v (body %q)", err, rec.Body.String())
	}
	return rec.Code, payload
}

func TestHandlerLoginFlow(t *testing.T) {
	h := NewHandler(NewMemoryRepository(), time.Hour)

	status, payload := doAuthRequest(t, h.Login, http.MethodPost, "/api/v1/auth/login",
		`{"email":"kasir@pawpos.id","password":"kasir123"}`, "")
	if status != http.StatusOK {
		t.Fatalf("login status = %d (%v)", status, payload)
	}
	data := payload["data"].(map[string]any)
	token := data["token"].(string)
	if token == "" || payload["request_id"] == nil {
		t.Fatalf("login payload missing token/request_id = %v", payload)
	}
	if data["user"].(map[string]any)["role"] != "cashier" {
		t.Fatalf("login user = %v", data["user"])
	}

	status, _ = doAuthRequest(t, h.Login, http.MethodPost, "/api/v1/auth/login",
		`{"email":"kasir@pawpos.id","password":"salah"}`, "")
	if status != http.StatusUnauthorized {
		t.Fatalf("bad login status = %d", status)
	}

	status, _ = doAuthRequest(t, h.Login, http.MethodPost, "/api/v1/auth/login",
		`{"email":"","password":""}`, "")
	if status != http.StatusBadRequest {
		t.Fatalf("empty login status = %d", status)
	}

	status, payload = doAuthRequest(t, h.Me, http.MethodGet, "/api/v1/auth/me", "", token)
	if status != http.StatusOK {
		t.Fatalf("me status = %d (%v)", status, payload)
	}

	status, _ = doAuthRequest(t, h.Me, http.MethodGet, "/api/v1/auth/me", "", "")
	if status != http.StatusUnauthorized {
		t.Fatalf("me without token status = %d", status)
	}

	status, _ = doAuthRequest(t, h.Logout, http.MethodPost, "/api/v1/auth/logout", "", token)
	if status != http.StatusOK {
		t.Fatalf("logout status = %d", status)
	}

	status, _ = doAuthRequest(t, h.Me, http.MethodGet, "/api/v1/auth/me", "", token)
	if status != http.StatusUnauthorized {
		t.Fatalf("me after logout status = %d", status)
	}
}

func TestHandlerPinLogin(t *testing.T) {
	h := NewHandler(NewMemoryRepository(), time.Hour)

	status, payload := doAuthRequest(t, h.PinLogin, http.MethodPost, "/api/v1/auth/pin",
		`{"role":"warehouse","pin":"5678"}`, "")
	if status != http.StatusOK {
		t.Fatalf("pin login status = %d (%v)", status, payload)
	}

	status, _ = doAuthRequest(t, h.PinLogin, http.MethodPost, "/api/v1/auth/pin",
		`{"role":"warehouse","pin":"0000"}`, "")
	if status != http.StatusUnauthorized {
		t.Fatalf("bad pin status = %d", status)
	}

	status, _ = doAuthRequest(t, h.PinLogin, http.MethodPost, "/api/v1/auth/pin",
		`{"role":"hacker","pin":"1234"}`, "")
	if status != http.StatusUnprocessableEntity {
		t.Fatalf("bad role status = %d", status)
	}
}

package health

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestReadyReturnsUnavailableWhenCheckFails(t *testing.T) {
	handler := NewHandler(func(context.Context) error { return context.DeadlineExceeded })
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/health/ready", nil)
	handler.Ready(recorder, request)
	if recorder.Code != http.StatusServiceUnavailable || !strings.Contains(recorder.Body.String(), "DEPENDENCY_UNAVAILABLE") {
		t.Fatalf("response = %d %s", recorder.Code, recorder.Body.String())
	}
}

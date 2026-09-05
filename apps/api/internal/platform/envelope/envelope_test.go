package envelope

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/muhri/ai-operational-pos/apps/api/internal/platform/requestid"
)

func TestWriteUsesSuccessEnvelopeAndRequestID(t *testing.T) {
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/", nil)
	handler := requestid.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		Write(w, r, http.StatusOK, map[string]string{"status": "ok"})
	}))
	handler.ServeHTTP(recorder, request)

	var got Success[map[string]string]
	if err := json.Unmarshal(recorder.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.Data["status"] != "ok" || got.RequestID == "" || recorder.Header().Get("X-Request-ID") == "" {
		t.Fatalf("envelope = %#v, headers = %#v", got, recorder.Header())
	}
}

func TestWriteErrorUsesErrorEnvelope(t *testing.T) {
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/", nil)
	WriteError(recorder, request, http.StatusBadRequest, "BAD_REQUEST", "invalid request", nil)

	var got Failure
	if err := json.Unmarshal(recorder.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.Error.Code != "BAD_REQUEST" || got.Error.Message != "invalid request" {
		t.Fatalf("error envelope = %#v", got)
	}
}

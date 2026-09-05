package envelope

import (
	"encoding/json"
	"net/http"

	"github.com/muhri/ai-operational-pos/apps/api/internal/platform/requestid"
)

type Success[T any] struct {
	Data      T      `json:"data"`
	RequestID string `json:"request_id"`
}

type ErrorBody struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Details any    `json:"details,omitempty"`
}

type Failure struct {
	Error     ErrorBody `json:"error"`
	RequestID string    `json:"request_id"`
}

func Write[T any](w http.ResponseWriter, r *http.Request, status int, data T) {
	write(w, status, Success[T]{Data: data, RequestID: requestid.FromContext(r.Context())})
}

func WriteError(w http.ResponseWriter, r *http.Request, status int, code, message string, details any) {
	write(w, status, Failure{Error: ErrorBody{Code: code, Message: message, Details: details}, RequestID: requestid.FromContext(r.Context())})
}

func write(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

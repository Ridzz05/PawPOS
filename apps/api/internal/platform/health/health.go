package health

import (
	"context"
	"net/http"

	"github.com/muhri/ai-operational-pos/apps/api/internal/platform/envelope"
)

type Check func(context.Context) error

type Handler struct {
	check Check
}

func NewHandler(check Check) Handler {
	return Handler{check: check}
}

func (h Handler) Live(w http.ResponseWriter, r *http.Request) {
	envelope.Write(w, r, http.StatusOK, map[string]string{"status": "ok"})
}

func (h Handler) Ready(w http.ResponseWriter, r *http.Request) {
	if h.check != nil {
		if err := h.check(r.Context()); err != nil {
			envelope.WriteError(w, r, http.StatusServiceUnavailable, "DEPENDENCY_UNAVAILABLE", "A required dependency is unavailable.", map[string]string{"database": "unavailable"})
			return
		}
	}
	envelope.Write(w, r, http.StatusOK, map[string]any{"status": "ready", "dependencies": map[string]string{"database": "ok"}})
}

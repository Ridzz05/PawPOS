package assistant

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestGroqChatCompleterSendsValidRequest(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("expected POST, got %s", r.Method)
		}
		if r.Header.Get("Authorization") != "Bearer test-groq-key" {
			t.Errorf("unexpected authorization header: %s", r.Header.Get("Authorization"))
		}
		if r.Header.Get("Content-Type") != "application/json" {
			t.Errorf("unexpected content type: %s", r.Header.Get("Content-Type"))
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{
			"id": "chatcmpl-123",
			"object": "chat.completion",
			"choices": [
				{
					"index": 0,
					"message": {
						"role": "assistant",
						"content": "Halo! Saya PawPOS AI Assistant siap membantu Anda."
					},
					"finish_reason": "stop"
				}
			],
			"model": "openai/gpt-oss-120b"
		}`))
	}))
	defer server.Close()

	completer := NewGroqChatCompleter("test-groq-key", "openai/gpt-oss-120b")
	completer.Endpoint = server.URL

	resp, err := completer.Complete(context.Background(), []ChatMessage{
		{Role: "user", Content: "Halo"},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp != "Halo! Saya PawPOS AI Assistant siap membantu Anda." {
		t.Errorf("unexpected response: %s", resp)
	}
}

func TestGroqChatCompleterHandlesAPIError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"error": {"message": "invalid model requested"}}`))
	}))
	defer server.Close()

	completer := NewGroqChatCompleter("test-groq-key", "openai/gpt-oss-120b")
	completer.Endpoint = server.URL

	_, err := completer.Complete(context.Background(), []ChatMessage{
		{Role: "user", Content: "Halo"},
	})
	if err == nil {
		t.Fatal("expected error, got nil")
	}
}

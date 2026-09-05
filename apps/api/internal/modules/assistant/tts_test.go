package assistant

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestElevenLabsTTSSynthesizeSuccess(t *testing.T) {
	expectedAudio := []byte("fake-audio-bytes-1234")
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("xi-api-key") != "test-api-key" {
			t.Errorf("expected xi-api-key header, got %s", r.Header.Get("xi-api-key"))
		}
		if r.Header.Get("Accept") != "audio/mpeg" {
			t.Errorf("expected Accept: audio/mpeg, got %s", r.Header.Get("Accept"))
		}
		if !strings.HasSuffix(r.URL.Path, "/test-voice-id") {
			t.Errorf("expected path to end with /test-voice-id, got %s", r.URL.Path)
		}

		w.Header().Set("Content-Type", "audio/mpeg")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(expectedAudio)
	}))
	defer server.Close()

	client := NewElevenLabsTTS("test-api-key", "default-voice", "eleven_multilingual_v2")
	client.SetBaseURL(server.URL)

	audio, err := client.Synthesize(context.Background(), "Halo PawPOS", "test-voice-id")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if string(audio) != string(expectedAudio) {
		t.Fatalf("expected audio %s, got %s", string(expectedAudio), string(audio))
	}
}

func TestElevenLabsTTSMissingAPIKey(t *testing.T) {
	client := NewElevenLabsTTS("", "default-voice", "eleven_multilingual_v2")
	_, err := client.Synthesize(context.Background(), "Halo PawPOS", "")
	if err == nil || !strings.Contains(err.Error(), "API key is not configured") {
		t.Fatalf("expected API key error, got %v", err)
	}
}

func TestElevenLabsTTSEmptyText(t *testing.T) {
	client := NewElevenLabsTTS("key", "default-voice", "eleven_multilingual_v2")
	_, err := client.Synthesize(context.Background(), "   ", "")
	if err == nil || !strings.Contains(err.Error(), "cannot be empty") {
		t.Fatalf("expected empty text error, got %v", err)
	}
}

func TestElevenLabsTTSErrorResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusPaymentRequired)
		_, _ = w.Write([]byte(`{"detail":{"message":"paid plan required"}}`))
	}))
	defer server.Close()

	client := NewElevenLabsTTS("test-api-key", "default-voice", "eleven_multilingual_v2")
	client.SetBaseURL(server.URL)

	_, err := client.Synthesize(context.Background(), "Halo PawPOS", "")
	if err == nil || !strings.Contains(err.Error(), "status 402") {
		t.Fatalf("expected 402 error, got %v", err)
	}
}

package assistant

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestGroqTranscriberSendsMultipartRequest(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/transcribe" {
			t.Errorf("request = %s %s", r.Method, r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer test-key" {
			t.Errorf("authorization = %q", r.Header.Get("Authorization"))
		}
		reader, err := r.MultipartReader()
		if err != nil {
			t.Fatal(err)
		}
		seenFile, seenModel := false, false
		for {
			part, nextErr := reader.NextPart()
			if nextErr == io.EOF {
				break
			}
			if nextErr != nil {
				t.Fatal(nextErr)
			}
			if part.FormName() == "file" {
				seenFile = true
				if part.FileName() != "voice.mp3" || part.Header.Get("Content-Type") != "audio/mpeg" {
					t.Errorf("file part = %q %q", part.FileName(), part.Header.Get("Content-Type"))
				}
			}
			if part.FormName() == "model" {
				seenModel = true
			}
		}
		if !seenFile || !seenModel {
			t.Errorf("multipart fields = file:%t model:%t", seenFile, seenModel)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"text":"hello operator"}`))
	}))
	defer server.Close()

	transcriber := NewGroqTranscriber("test-key", "whisper-large-v3-turbo")
	transcriber.Endpoint = server.URL + "/transcribe"
	result, err := transcriber.Transcribe(context.Background(), []byte("audio"), "voice.mp3", "audio/mpeg")
	if err != nil {
		t.Fatal(err)
	}
	if result.Text != "hello operator" || result.Provider != "groq" || result.Model != "whisper-large-v3-turbo" {
		t.Fatalf("result = %#v", result)
	}
}

func TestGroqTranscriberValidatesResponses(t *testing.T) {
	tests := []struct {
		name       string
		statusCode int
		body       string
		want       string
	}{
		{name: "provider error", statusCode: http.StatusBadGateway, body: `{"error":"provider details"}`, want: "status 502"},
		{name: "malformed json", statusCode: http.StatusOK, body: "not-json", want: "decode groq response"},
		{name: "missing text", statusCode: http.StatusOK, body: `{"model":"x"}`, want: "did not contain transcription text"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(test.statusCode)
				_, _ = w.Write([]byte(test.body))
			}))
			defer server.Close()
			transcriber := NewGroqTranscriber("secret-key", "test-model")
			transcriber.Endpoint = server.URL
			_, err := transcriber.Transcribe(context.Background(), []byte("audio"), "voice.mp3", "audio/mpeg")
			if err == nil || !strings.Contains(err.Error(), test.want) || strings.Contains(err.Error(), "secret-key") || strings.Contains(err.Error(), "provider details") {
				t.Fatalf("error = %v", err)
			}
		})
	}
}

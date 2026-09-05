package assistant

import (
	"bytes"
	"context"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"strings"
	"testing"

	"github.com/muhri/ai-operational-pos/apps/api/internal/platform/config"
)

type fakeTranscriber struct {
	called bool
}

func (f *fakeTranscriber) Transcribe(_ context.Context, _ []byte, _, _ string) (Transcription, error) {
	f.called = true
	return Transcription{Text: "take five items", Provider: "test", Model: "test-model"}, nil
}

func TestHandlerReturnsActionableErrorWhenDisabled(t *testing.T) {
	fake := &fakeTranscriber{}
	handler := NewHandler(config.Config{GroqAPIKey: "secret"}, fake)
	recorder := httptest.NewRecorder()
	handler.Transcribe(recorder, httptest.NewRequest(http.MethodPost, "/api/v1/assistant/transcriptions", nil))

	if recorder.Code != http.StatusServiceUnavailable || !strings.Contains(recorder.Body.String(), "ASSISTANT_DISABLED") || fake.called {
		t.Fatalf("response = %d %s, called = %t", recorder.Code, recorder.Body.String(), fake.called)
	}
	if strings.Contains(recorder.Body.String(), "secret") {
		t.Fatal("response exposed API key")
	}
}

func TestHandlerReturnsActionableErrorWhenKeyIsMissing(t *testing.T) {
	handler := NewHandler(config.Config{AIEnabled: true}, &fakeTranscriber{})
	recorder := httptest.NewRecorder()
	handler.Transcribe(recorder, httptest.NewRequest(http.MethodPost, "/api/v1/assistant/transcriptions", nil))

	if recorder.Code != http.StatusServiceUnavailable || !strings.Contains(recorder.Body.String(), "TRANSCRIPTION_NOT_CONFIGURED") {
		t.Fatalf("response = %d %s", recorder.Code, recorder.Body.String())
	}
}

func TestHandlerValidatesAudioAndDuration(t *testing.T) {
	tests := []struct {
		name        string
		filename    string
		contentType string
		duration    string
		wantCode    string
		wantStatus  int
	}{
		{name: "extension", filename: "voice.txt", contentType: "audio/wav", wantCode: "UNSUPPORTED_AUDIO", wantStatus: http.StatusUnsupportedMediaType},
		{name: "mime", filename: "voice.wav", contentType: "audio/mpeg", wantCode: "UNSUPPORTED_AUDIO", wantStatus: http.StatusUnsupportedMediaType},
		{name: "duration", filename: "voice.mp3", contentType: "audio/mpeg", duration: "3", wantCode: "AUDIO_TOO_LONG", wantStatus: http.StatusRequestEntityTooLarge},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			fake := &fakeTranscriber{}
			handler := NewHandler(config.Config{AIEnabled: true, GroqAPIKey: "secret", AIAudioMaxSeconds: 2}, fake)
			request := multipartRequest(t, test.filename, test.contentType, []byte("audio"), test.duration)
			recorder := httptest.NewRecorder()
			handler.Transcribe(recorder, request)
			if recorder.Code != test.wantStatus || !strings.Contains(recorder.Body.String(), test.wantCode) || fake.called {
				t.Fatalf("response = %d %s, called = %t", recorder.Code, recorder.Body.String(), fake.called)
			}
		})
	}
}

func TestHandlerRejectsWavDurationFromContainer(t *testing.T) {
	handler := NewHandler(config.Config{AIEnabled: true, GroqAPIKey: "secret", AIAudioMaxSeconds: 2}, &fakeTranscriber{})
	recorder := httptest.NewRecorder()
	handler.Transcribe(recorder, multipartRequest(t, "voice.wav", "audio/wav", wavFile(3000, 1000), ""))

	if recorder.Code != http.StatusRequestEntityTooLarge || !strings.Contains(recorder.Body.String(), "AUDIO_TOO_LONG") {
		t.Fatalf("response = %d %s", recorder.Code, recorder.Body.String())
	}
}

func TestHandlerReturnsSafeTranscriptionEnvelope(t *testing.T) {
	handler := NewHandler(config.Config{AIEnabled: true, GroqAPIKey: "secret", AIAudioMaxSeconds: 60}, &fakeTranscriber{})
	recorder := httptest.NewRecorder()
	handler.Transcribe(recorder, multipartRequest(t, "voice.mp3", "audio/mpeg", []byte("audio"), ""))

	var response struct {
		Data struct {
			Text     string `json:"text"`
			Provider string `json:"provider"`
			Model    string `json:"model"`
		} `json:"data"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&response); err != nil {
		t.Fatal(err)
	}
	if recorder.Code != http.StatusOK || response.Data.Text != "take five items" || response.Data.Provider != "test" || response.Data.Model != "test-model" || strings.Contains(recorder.Body.String(), "secret") {
		t.Fatalf("response = %d %s", recorder.Code, recorder.Body.String())
	}
}

func multipartRequest(t *testing.T, filename, contentType string, audio []byte, duration string) *http.Request {
	t.Helper()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	fileHeader := make(textproto.MIMEHeader)
	fileHeader.Set("Content-Disposition", fmt.Sprintf(`form-data; name="file"; filename="%s"`, filename))
	fileHeader.Set("Content-Type", contentType)
	file, err := writer.CreatePart(fileHeader)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := file.Write(audio); err != nil {
		t.Fatal(err)
	}
	if duration != "" {
		if err := writer.WriteField("duration_seconds", duration); err != nil {
			t.Fatal(err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest(http.MethodPost, "/api/v1/assistant/transcriptions", &body)
	request.Header.Set("Content-Type", writer.FormDataContentType())
	return request
}

func wavFile(dataSize, byteRate uint32) []byte {
	data := make([]byte, 44+dataSize)
	copy(data[0:4], "RIFF")
	binary.LittleEndian.PutUint32(data[4:8], uint32(len(data)-8))
	copy(data[8:12], "WAVE")
	copy(data[12:16], "fmt ")
	binary.LittleEndian.PutUint32(data[16:20], 16)
	binary.LittleEndian.PutUint16(data[20:22], 1)
	binary.LittleEndian.PutUint16(data[22:24], 1)
	binary.LittleEndian.PutUint32(data[24:28], 8000)
	binary.LittleEndian.PutUint32(data[28:32], byteRate)
	binary.LittleEndian.PutUint16(data[32:34], 1)
	binary.LittleEndian.PutUint16(data[34:36], 8)
	copy(data[36:40], "data")
	binary.LittleEndian.PutUint32(data[40:44], dataSize)
	return data
}

type fakeChatCompleter struct {
	called   bool
	messages []ChatMessage
	reply    string
}

func (f *fakeChatCompleter) Complete(_ context.Context, messages []ChatMessage) (string, error) {
	f.called = true
	f.messages = messages
	return f.reply, nil
}

type fakeContextProvider struct {
	sc StoreContext
}

func (f *fakeContextProvider) GetStoreContext(_ context.Context, _ string) (StoreContext, error) {
	return f.sc, nil
}

func TestHandlerChatValidatesEmptyMessage(t *testing.T) {
	handler := NewHandler(config.Config{AIEnabled: true})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/assistant/chat", strings.NewReader(`{"message": "   "}`))
	recorder := httptest.NewRecorder()
	handler.Chat(recorder, req)

	if recorder.Code != http.StatusBadRequest || !strings.Contains(recorder.Body.String(), "MESSAGE_REQUIRED") {
		t.Fatalf("expected 400 MESSAGE_REQUIRED, got %d: %s", recorder.Code, recorder.Body.String())
	}
}

func TestHandlerChatWithRAGFallback(t *testing.T) {
	handler := NewHandler(config.Config{AIEnabled: true, LLMModel: "openai/gpt-oss-120b"})
	handler.SetContextProvider(&fakeContextProvider{
		sc: StoreContext{
			TenantName: "PawPOS Pet Store",
			LowStockAlert: []ProductSummary{
				{SKU: "CAT-001", Name: "Whiskas Junior Ocean Fish", StockQty: 2, MinStock: 5},
			},
		},
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/assistant/chat", strings.NewReader(`{"message": "Apakah ada produk yang stoknya menipis?"}`))
	recorder := httptest.NewRecorder()
	handler.Chat(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", recorder.Code, recorder.Body.String())
	}

	var resp struct {
		Data struct {
			Reply    string `json:"reply"`
			Provider string `json:"provider"`
			Model    string `json:"model"`
		} `json:"data"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&resp); err != nil {
		t.Fatal(err)
	}

	if !strings.Contains(resp.Data.Reply, "Whiskas Junior Ocean Fish") || !strings.Contains(resp.Data.Reply, "2 unit") {
		t.Errorf("unexpected reply: %s", resp.Data.Reply)
	}
	if resp.Data.Model != "openai/gpt-oss-120b" {
		t.Errorf("unexpected model: %s", resp.Data.Model)
	}
}

func TestHandlerChatWithGroqCompleter(t *testing.T) {
	fake := &fakeChatCompleter{
		reply: "Berdasarkan data toko PawPOS, stok Whiskas tersisa 2 kaleng.",
	}
	handler := NewHandler(config.Config{
		AIEnabled:  true,
		GroqAPIKey: "test-groq-key",
		LLMModel:   "openai/gpt-oss-120b",
	})
	handler.SetChatCompleter(fake)
	handler.SetContextProvider(&fakeContextProvider{
		sc: StoreContext{
			TenantName: "PawPOS Store",
			Products: []ProductSummary{
				{SKU: "CAT-001", Name: "Whiskas", SellingPrice: 25000, StockQty: 2, MinStock: 5},
			},
		},
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/assistant/chat", strings.NewReader(`{"message": "Halo, sisa stok Whiskas berapa ya?"}`))
	recorder := httptest.NewRecorder()
	handler.Chat(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", recorder.Code, recorder.Body.String())
	}

	if !fake.called {
		t.Fatal("expected Groq chat completer to be called")
	}

	if len(fake.messages) < 2 {
		t.Fatalf("expected at least system prompt and user message, got %d messages", len(fake.messages))
	}
	if fake.messages[0].Role != "system" || !strings.Contains(fake.messages[0].Content, "PawPOS") {
		t.Errorf("system prompt missing or invalid: %s", fake.messages[0].Content)
	}
	if fake.messages[len(fake.messages)-1].Content != "Halo, sisa stok Whiskas berapa ya?" {
		t.Errorf("user message not passed correctly: %s", fake.messages[len(fake.messages)-1].Content)
	}
}

type fakeTTSClient struct {
	called  bool
	text    string
	voiceID string
	audio   []byte
	err     error
}

func (f *fakeTTSClient) Synthesize(_ context.Context, text, voiceID string) ([]byte, error) {
	f.called = true
	f.text = text
	f.voiceID = voiceID
	if f.err != nil {
		return nil, f.err
	}
	return f.audio, nil
}

func TestHandlerTextToSpeechSuccess(t *testing.T) {
	fakeTTS := &fakeTTSClient{
		audio: []byte("elevenlabs-test-audio-data"),
	}
	handler := NewHandler(config.Config{AIEnabled: true})
	handler.SetTTSClient(fakeTTS)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/assistant/tts", strings.NewReader(`{"text":"**Halo** kasir PawPOS!","voice_id":"custom-voice"}`))
	recorder := httptest.NewRecorder()
	handler.TextToSpeech(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", recorder.Code, recorder.Body.String())
	}
	if recorder.Header().Get("Content-Type") != "audio/mpeg" {
		t.Errorf("expected audio/mpeg Content-Type, got %s", recorder.Header().Get("Content-Type"))
	}
	if !fakeTTS.called {
		t.Fatal("expected TTS client to be called")
	}
	if fakeTTS.text != "Halo kasir PawPOS!" {
		t.Errorf("expected cleaned text without markdown, got %q", fakeTTS.text)
	}
	if fakeTTS.voiceID != "custom-voice" {
		t.Errorf("expected custom-voice, got %q", fakeTTS.voiceID)
	}
}

func TestHandlerTextToSpeechEmptyText(t *testing.T) {
	handler := NewHandler(config.Config{AIEnabled: true})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/assistant/tts", strings.NewReader(`{"text":"   "}`))
	recorder := httptest.NewRecorder()
	handler.TextToSpeech(recorder, req)

	if recorder.Code != http.StatusBadRequest || !strings.Contains(recorder.Body.String(), "TEXT_REQUIRED") {
		t.Fatalf("expected 400 TEXT_REQUIRED, got %d: %s", recorder.Code, recorder.Body.String())
	}
}

func TestHandlerTextToSpeechNotConfigured(t *testing.T) {
	handler := Handler{}
	req := httptest.NewRequest(http.MethodPost, "/api/v1/assistant/tts", strings.NewReader(`{"text":"Halo"}`))
	recorder := httptest.NewRecorder()
	handler.TextToSpeech(recorder, req)

	if recorder.Code != http.StatusServiceUnavailable || !strings.Contains(recorder.Body.String(), "TTS_NOT_AVAILABLE") {
		t.Fatalf("expected 503 TTS_NOT_AVAILABLE, got %d: %s", recorder.Code, recorder.Body.String())
	}
}


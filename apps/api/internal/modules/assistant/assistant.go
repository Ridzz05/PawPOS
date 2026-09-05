package assistant

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"math"
	"mime"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/muhri/ai-operational-pos/apps/api/internal/platform/config"
	"github.com/muhri/ai-operational-pos/apps/api/internal/platform/envelope"
	"github.com/muhri/ai-operational-pos/apps/api/internal/platform/tenantcontext"
)

const (
	maxAudioBytes     = 25 * 1024 * 1024
	maxMultipartBytes = maxAudioBytes + 64*1024
	defaultMaxSeconds = 60
)

var acceptedAudio = map[string]map[string]struct{}{
	".flac": {"audio/flac": {}},
	".m4a":  {"audio/mp4": {}, "audio/x-m4a": {}, "application/mp4": {}},
	".mp3":  {"audio/mpeg": {}, "audio/mp3": {}, "audio/x-mpeg": {}},
	".mp4":  {"audio/mp4": {}, "video/mp4": {}, "application/mp4": {}},
	".mpeg": {"audio/mpeg": {}, "audio/mp3": {}},
	".mpga": {"audio/mpeg": {}, "audio/mp3": {}},
	".ogg":  {"audio/ogg": {}, "application/ogg": {}},
	".wav":  {"audio/wav": {}, "audio/x-wav": {}, "audio/wave": {}},
	".webm": {"audio/webm": {}, "video/webm": {}},
}

type Transcriber interface {
	Transcribe(ctx context.Context, audio []byte, filename, contentType string) (Transcription, error)
}

type Transcription struct {
	Text     string `json:"text"`
	Provider string `json:"provider"`
	Model    string `json:"model"`
}

type ChatRequest struct {
	Message string        `json:"message"`
	History []ChatMessage `json:"history,omitempty"`
}

type ChatResponse struct {
	Reply    string                 `json:"reply"`
	Provider string                 `json:"provider"`
	Model    string                 `json:"model"`
	Context  map[string]interface{} `json:"context,omitempty"`
}

type TTSRequest struct {
	Text    string `json:"text"`
	VoiceID string `json:"voice_id,omitempty"`
}

type Handler struct {
	config      config.Config
	transcriber Transcriber
	completer   ChatCompleter
	contextProv StoreContextProvider
	ttsClient   TTSClient
}

func NewHandler(cfg config.Config, transcribers ...Transcriber) Handler {
	var transcriber Transcriber
	if len(transcribers) > 0 {
		transcriber = transcribers[0]
	}
	if transcriber == nil {
		transcriber = NewGroqTranscriber(cfg.GroqAPIKey, cfg.STTModel)
	}
	completer := NewGroqChatCompleter(cfg.GroqAPIKey, cfg.LLMModel)
	ttsClient := NewElevenLabsTTS(cfg.ElevenLabsAPIKey, cfg.ElevenLabsVoiceID, cfg.ElevenLabsModel)
	return Handler{config: cfg, transcriber: transcriber, completer: completer, ttsClient: ttsClient}
}

func (h *Handler) SetChatCompleter(c ChatCompleter) {
	h.completer = c
}

func (h *Handler) SetContextProvider(p StoreContextProvider) {
	h.contextProv = p
}

func (h *Handler) SetTTSClient(c TTSClient) {
	h.ttsClient = c
}

func (h Handler) TextToSpeech(w http.ResponseWriter, r *http.Request) {
	var req TTSRequest
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&req); err != nil {
		envelope.WriteError(w, r, http.StatusBadRequest, "INVALID_REQUEST", "Failed to parse text-to-speech request payload.", nil)
		return
	}

	cleanText := strings.TrimSpace(req.Text)
	if cleanText == "" {
		envelope.WriteError(w, r, http.StatusBadRequest, "TEXT_REQUIRED", "Text to synthesize cannot be empty.", nil)
		return
	}

	cleanText = cleanMarkdownForSpeech(cleanText)

	if h.ttsClient == nil {
		envelope.WriteError(w, r, http.StatusServiceUnavailable, "TTS_NOT_AVAILABLE", "Text-to-speech service is not configured.", nil)
		return
	}

	audioBytes, err := h.ttsClient.Synthesize(r.Context(), cleanText, req.VoiceID)
	if err != nil {
		envelope.WriteError(w, r, http.StatusBadGateway, "TTS_FAILED", "Failed to synthesize speech: "+err.Error(), nil)
		return
	}

	w.Header().Set("Content-Type", "audio/mpeg")
	w.Header().Set("Content-Length", strconv.Itoa(len(audioBytes)))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(audioBytes)
}

func cleanMarkdownForSpeech(text string) string {
	replacer := strings.NewReplacer(
		"*", "",
		"#", "",
		"_", "",
		"`", "",
		"|", "",
		"~", "",
	)
	return replacer.Replace(text)
}

func (h Handler) Chat(w http.ResponseWriter, r *http.Request) {
	var req ChatRequest
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&req); err != nil {
		envelope.WriteError(w, r, http.StatusBadRequest, "INVALID_REQUEST", "Failed to parse chat request payload.", nil)
		return
	}

	req.Message = strings.TrimSpace(req.Message)
	if req.Message == "" {
		envelope.WriteError(w, r, http.StatusBadRequest, "MESSAGE_REQUIRED", "Chat message cannot be empty.", nil)
		return
	}

	tenantID := tenantcontext.FromContext(r.Context())
	if tenantID == "" {
		tenantID = "default"
	}

	var sc StoreContext
	if h.contextProv != nil {
		var err error
		sc, err = h.contextProv.GetStoreContext(r.Context(), tenantID)
		if err != nil {
			sc = StoreContext{TenantID: tenantID, TenantName: "PawPOS Merchant"}
		}
	} else {
		sc = StoreContext{TenantID: tenantID, TenantName: "PawPOS Merchant"}
	}

	model := h.config.LLMModel
	if model == "" {
		model = "openai/gpt-oss-120b"
	}

	var reply string
	provider := "local-rag"
	if h.completer != nil && strings.TrimSpace(h.config.GroqAPIKey) != "" {
		systemPrompt := BuildSystemPrompt(sc)
		messages := make([]ChatMessage, 0, len(req.History)+2)
		messages = append(messages, ChatMessage{Role: "system", Content: systemPrompt})
		for _, hMsg := range req.History {
			if hMsg.Role == "user" || hMsg.Role == "assistant" {
				messages = append(messages, hMsg)
			}
		}
		messages = append(messages, ChatMessage{Role: "user", Content: req.Message})

		var err error
		reply, err = h.completer.Complete(r.Context(), messages)
		if err != nil {
			reply = LocalRAGFallback(req.Message, sc, model)
		} else {
			provider = "groq"
		}
	} else {
		reply = LocalRAGFallback(req.Message, sc, model)
	}

	reply = CleanAssistantReply(reply)

	resp := ChatResponse{
		Reply:    reply,
		Provider: provider,
		Model:    model,
		Context: map[string]interface{}{
			"tenant_name":     sc.TenantName,
			"products_count":  len(sc.Products),
			"low_stock_count": len(sc.LowStockAlert),
			"shift_active":    sc.ActiveShift != nil,
		},
	}

	envelope.Write(w, r, http.StatusOK, resp)
}

func (h Handler) Transcribe(w http.ResponseWriter, r *http.Request) {
	if !h.config.AIEnabled {
		envelope.WriteError(w, r, http.StatusServiceUnavailable, "ASSISTANT_DISABLED", "Voice transcription is disabled. Set AI_ENABLED=true to enable it; manual operation remains available.", map[string]string{"action": "enable AI_ENABLED when a transcription provider is configured"})
		return
	}
	if strings.TrimSpace(h.config.GroqAPIKey) == "" {
		envelope.WriteError(w, r, http.StatusServiceUnavailable, "TRANSCRIPTION_NOT_CONFIGURED", "Voice transcription is not configured. Set GROQ_API_KEY, or continue with manual operation.", map[string]string{"action": "configure GROQ_API_KEY and keep AI_ENABLED=true"})
		return
	}

	audio, filename, contentType, err := readAudio(r, maxSeconds(h.config.AIAudioMaxSeconds))
	if err != nil {
		writeAudioError(w, r, err)
		return
	}
	transcription, err := h.transcriber.Transcribe(r.Context(), audio, filename, contentType)
	if err != nil {
		envelope.WriteError(w, r, http.StatusBadGateway, "TRANSCRIPTION_PROVIDER_ERROR", "The transcription provider could not process the audio. Try again or continue with manual operation.", map[string]string{"action": "retry the upload or continue with manual operation"})
		return
	}
	if strings.TrimSpace(transcription.Text) == "" || strings.TrimSpace(transcription.Provider) == "" || strings.TrimSpace(transcription.Model) == "" {
		envelope.WriteError(w, r, http.StatusBadGateway, "INVALID_TRANSCRIPTION_RESPONSE", "The transcription provider returned an invalid response. Continue with manual operation.", nil)
		return
	}

	envelope.Write(w, r, http.StatusOK, transcription)
}

func readAudio(r *http.Request, maxSeconds int) ([]byte, string, string, error) {
	if r.ContentLength > maxMultipartBytes {
		return nil, "", "", audioError{code: "AUDIO_TOO_LARGE", status: http.StatusRequestEntityTooLarge, message: "The audio upload is too large. Record a shorter clip or use a smaller file."}
	}
	r.Body = http.MaxBytesReader(nil, r.Body, maxMultipartBytes)
	contentType, params, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || contentType != "multipart/form-data" {
		return nil, "", "", audioError{code: "INVALID_AUDIO_REQUEST", status: http.StatusBadRequest, message: "The request must be multipart/form-data with an audio file."}
	}
	boundary := params["boundary"]
	if boundary == "" {
		return nil, "", "", audioError{code: "INVALID_AUDIO_REQUEST", status: http.StatusBadRequest, message: "The multipart audio request is missing its boundary."}
	}
	reader := multipart.NewReader(r.Body, boundary)

	var audio []byte
	var filename string
	var fileType string
	var declaredSeconds *float64
	for {
		part, nextErr := reader.NextPart()
		if errors.Is(nextErr, io.EOF) {
			break
		}
		if nextErr != nil {
			if _, ok := nextErr.(*http.MaxBytesError); ok {
				return nil, "", "", audioError{code: "AUDIO_TOO_LARGE", status: http.StatusRequestEntityTooLarge, message: "The audio upload is too large. Record a shorter clip or use a smaller file."}
			}
			return nil, "", "", audioError{code: "INVALID_AUDIO_REQUEST", status: http.StatusBadRequest, message: "The multipart audio request is invalid."}
		}

		if part.FormName() == "duration_seconds" && part.FileName() == "" {
			value, readErr := io.ReadAll(io.LimitReader(part, 64))
			if readErr != nil {
				return nil, "", "", audioError{code: "INVALID_AUDIO_REQUEST", status: http.StatusBadRequest, message: "The duration_seconds field is invalid."}
			}
			seconds, parseErr := strconv.ParseFloat(strings.TrimSpace(string(value)), 64)
			if parseErr != nil || math.IsNaN(seconds) || math.IsInf(seconds, 0) || seconds < 0 {
				return nil, "", "", audioError{code: "INVALID_AUDIO_DURATION", status: http.StatusBadRequest, message: "duration_seconds must be a non-negative number."}
			}
			declaredSeconds = &seconds
			continue
		}
		if part.FileName() == "" || (part.FormName() != "file" && part.FormName() != "audio") {
			continue
		}
		if audio != nil {
			return nil, "", "", audioError{code: "INVALID_AUDIO_REQUEST", status: http.StatusBadRequest, message: "Send exactly one audio file in the file field."}
		}
		filename = filepath.Base(part.FileName())
		fileType = strings.ToLower(strings.TrimSpace(part.Header.Get("Content-Type")))
		var readErr error
		audio, readErr = io.ReadAll(io.LimitReader(part, maxAudioBytes+1))
		if readErr != nil {
			return nil, "", "", audioError{code: "INVALID_AUDIO_REQUEST", status: http.StatusBadRequest, message: "The audio file could not be read."}
		}
		if len(audio) > maxAudioBytes {
			return nil, "", "", audioError{code: "AUDIO_TOO_LARGE", status: http.StatusRequestEntityTooLarge, message: "The audio upload is too large. Record a shorter clip or use a smaller file."}
		}
	}

	if len(audio) == 0 {
		return nil, "", "", audioError{code: "AUDIO_REQUIRED", status: http.StatusBadRequest, message: "Attach an audio file in the file field."}
	}
	if err := validateAudio(filename, fileType); err != nil {
		return nil, "", "", err
	}
	if declaredSeconds != nil && *declaredSeconds > float64(maxSeconds) {
		return nil, "", "", audioError{code: "AUDIO_TOO_LONG", status: http.StatusRequestEntityTooLarge, message: "The audio clip is longer than the configured limit. Record a shorter clip."}
	}
	if duration, ok := wavDuration(audio); ok && duration > time.Duration(maxSeconds)*time.Second {
		return nil, "", "", audioError{code: "AUDIO_TOO_LONG", status: http.StatusRequestEntityTooLarge, message: "The audio clip is longer than the configured limit. Record a shorter clip."}
	}
	return audio, filename, fileType, nil
}

func validateAudio(filename, contentType string) error {
	extension := strings.ToLower(filepath.Ext(filename))
	if _, ok := acceptedAudio[extension]; !ok {
		return audioError{code: "UNSUPPORTED_AUDIO", status: http.StatusUnsupportedMediaType, message: "Use a supported audio file: flac, m4a, mp3, mp4, mpeg, mpga, ogg, wav, or webm."}
	}
	mediaType, _, err := mime.ParseMediaType(contentType)
	if err != nil {
		return audioError{code: "UNSUPPORTED_AUDIO", status: http.StatusUnsupportedMediaType, message: "The audio MIME type is invalid or unsupported."}
	}
	if _, ok := acceptedAudio[extension][strings.ToLower(mediaType)]; !ok {
		return audioError{code: "UNSUPPORTED_AUDIO", status: http.StatusUnsupportedMediaType, message: "The audio MIME type does not match its file extension."}
	}
	return nil
}

func wavDuration(data []byte) (time.Duration, bool) {
	if len(data) < 12 || string(data[:4]) != "RIFF" || string(data[8:12]) != "WAVE" {
		return 0, false
	}
	var byteRate uint32
	var dataSize uint32
	for offset := 12; offset+8 <= len(data); {
		chunkSize := uint32(data[offset+4]) | uint32(data[offset+5])<<8 | uint32(data[offset+6])<<16 | uint32(data[offset+7])<<24
		end := offset + 8 + int(chunkSize)
		if end > len(data) {
			break
		}
		switch string(data[offset : offset+4]) {
		case "fmt ":
			if chunkSize >= 12 && offset+20 <= len(data) {
				byteRate = uint32(data[offset+16]) | uint32(data[offset+17])<<8 | uint32(data[offset+18])<<16 | uint32(data[offset+19])<<24
			}
		case "data":
			dataSize = chunkSize
		}
		offset = end
		if chunkSize%2 == 1 {
			offset++
		}
	}
	if byteRate == 0 || dataSize == 0 {
		return 0, false
	}
	return time.Duration(float64(dataSize) / float64(byteRate) * float64(time.Second)), true
}

type audioError struct {
	code    string
	status  int
	message string
}

func (e audioError) Error() string { return e.message }

func writeAudioError(w http.ResponseWriter, r *http.Request, err error) {
	var validationErr audioError
	if !errors.As(err, &validationErr) {
		envelope.WriteError(w, r, http.StatusBadRequest, "INVALID_AUDIO_REQUEST", "The audio request is invalid.", nil)
		return
	}
	envelope.WriteError(w, r, validationErr.status, validationErr.code, validationErr.message, nil)
}

func maxSeconds(value int) int {
	if value <= 0 {
		return defaultMaxSeconds
	}
	return value
}

package assistant

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type TTSClient interface {
	Synthesize(ctx context.Context, text, voiceID string) ([]byte, error)
}

type ElevenLabsTTS struct {
	apiKey         string
	defaultVoiceID string
	defaultModel   string
	apiURL         string
	httpClient     *http.Client
}

type elevenLabsTTSRequest struct {
	Text          string                 `json:"text"`
	ModelID       string                 `json:"model_id"`
	VoiceSettings map[string]interface{} `json:"voice_settings,omitempty"`
}

func NewElevenLabsTTS(apiKey, defaultVoiceID, defaultModel string) *ElevenLabsTTS {
	if defaultVoiceID == "" {
		defaultVoiceID = "Xb7hH8MSUJpSbSDYk0k2"
	}
	if defaultModel == "" {
		defaultModel = "eleven_multilingual_v2"
	}
	return &ElevenLabsTTS{
		apiKey:         apiKey,
		defaultVoiceID: defaultVoiceID,
		defaultModel:   defaultModel,
		apiURL:         "https://api.elevenlabs.io/v1/text-to-speech",
		httpClient:     &http.Client{Timeout: 30 * time.Second},
	}
}

func (e *ElevenLabsTTS) SetBaseURL(url string) {
	e.apiURL = url
}

func (e *ElevenLabsTTS) SetHTTPClient(client *http.Client) {
	e.httpClient = client
}

func (e *ElevenLabsTTS) Synthesize(ctx context.Context, text, voiceID string) ([]byte, error) {
	if strings.TrimSpace(e.apiKey) == "" {
		return nil, errors.New("elevenlabs API key is not configured")
	}

	trimmedText := strings.TrimSpace(text)
	if trimmedText == "" {
		return nil, errors.New("text to synthesize cannot be empty")
	}

	targetVoiceID := strings.TrimSpace(voiceID)
	if targetVoiceID == "" {
		targetVoiceID = e.defaultVoiceID
	}

	payload := elevenLabsTTSRequest{
		Text:    trimmedText,
		ModelID: e.defaultModel,
		VoiceSettings: map[string]interface{}{
			"stability":        0.5,
			"similarity_boost": 0.75,
		},
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal elevenlabs request: %w", err)
	}

	url := fmt.Sprintf("%s/%s", strings.TrimRight(e.apiURL, "/"), targetVoiceID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create elevenlabs request: %w", err)
	}

	req.Header.Set("xi-api-key", e.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "audio/mpeg")

	resp, err := e.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("elevenlabs request failed: %w", err)
	}
	defer resp.Body.Close()

	audioBytes, err := io.ReadAll(io.LimitReader(resp.Body, 10*1024*1024))
	if err != nil {
		return nil, fmt.Errorf("failed to read elevenlabs response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("elevenlabs returned status %d: %s", resp.StatusCode, strings.TrimSpace(string(audioBytes)))
	}

	return audioBytes, nil
}

package assistant

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"path/filepath"
	"strings"
	"time"
)

const (
	groqTranscriptionEndpoint = "https://api.groq.com/openai/v1/audio/transcriptions"
	groqRequestTimeout        = 30 * time.Second
	maxProviderResponseBytes  = 1 << 20
)

type GroqTranscriber struct {
	APIKey   string
	Model    string
	Client   *http.Client
	Endpoint string
	Timeout  time.Duration
}

func NewGroqTranscriber(apiKey, model string) *GroqTranscriber {
	return &GroqTranscriber{
		APIKey:   apiKey,
		Model:    model,
		Client:   http.DefaultClient,
		Endpoint: groqTranscriptionEndpoint,
		Timeout:  groqRequestTimeout,
	}
}

func (g *GroqTranscriber) Transcribe(ctx context.Context, audio []byte, filename, contentType string) (Transcription, error) {
	if g == nil || strings.TrimSpace(g.APIKey) == "" || strings.TrimSpace(g.Model) == "" {
		return Transcription{}, fmt.Errorf("groq transcription is not configured")
	}

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	cleanFilename := strings.NewReplacer("\r", "", "\n", "", `\`, "", `"`, "").Replace(filepath.Base(filename))
	fileHeader := make(textproto.MIMEHeader)
	fileHeader.Set("Content-Disposition", fmt.Sprintf(`form-data; name="file"; filename="%s"`, cleanFilename))
	fileHeader.Set("Content-Type", contentType)
	file, err := writer.CreatePart(fileHeader)
	if err != nil {
		return Transcription{}, fmt.Errorf("create groq file part: %w", err)
	}
	if _, err := file.Write(audio); err != nil {
		return Transcription{}, fmt.Errorf("write groq file part: %w", err)
	}
	if err := writer.WriteField("model", g.Model); err != nil {
		return Transcription{}, fmt.Errorf("write groq model field: %w", err)
	}
	if err := writer.WriteField("response_format", "json"); err != nil {
		return Transcription{}, fmt.Errorf("write groq response format: %w", err)
	}
	if err := writer.Close(); err != nil {
		return Transcription{}, fmt.Errorf("close groq request: %w", err)
	}

	timeout := g.Timeout
	if timeout <= 0 {
		timeout = groqRequestTimeout
	}
	requestContext, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	request, err := http.NewRequestWithContext(requestContext, http.MethodPost, g.Endpoint, &body)
	if err != nil {
		return Transcription{}, fmt.Errorf("create groq request: %w", err)
	}
	request.Header.Set("Authorization", "Bearer "+g.APIKey)
	request.Header.Set("Content-Type", writer.FormDataContentType())

	client := g.Client
	if client == nil {
		client = http.DefaultClient
	}
	response, err := client.Do(request)
	if err != nil {
		return Transcription{}, fmt.Errorf("send groq request: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return Transcription{}, fmt.Errorf("groq transcription request failed with status %d", response.StatusCode)
	}

	var payload struct {
		Text string `json:"text"`
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, maxProviderResponseBytes)).Decode(&payload); err != nil {
		return Transcription{}, fmt.Errorf("decode groq response: %w", err)
	}
	if strings.TrimSpace(payload.Text) == "" {
		return Transcription{}, fmt.Errorf("groq response did not contain transcription text")
	}
	return Transcription{Text: payload.Text, Provider: "groq", Model: g.Model}, nil
}

const groqChatEndpoint = "https://api.groq.com/openai/v1/chat/completions"

type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ChatCompleter interface {
	Complete(ctx context.Context, messages []ChatMessage) (string, error)
}

type GroqChatCompleter struct {
	APIKey   string
	Model    string
	Client   *http.Client
	Endpoint string
	Timeout  time.Duration
}

func NewGroqChatCompleter(apiKey, model string) *GroqChatCompleter {
	if model == "" {
		model = "openai/gpt-oss-120b"
	}
	return &GroqChatCompleter{
		APIKey:   apiKey,
		Model:    model,
		Client:   http.DefaultClient,
		Endpoint: groqChatEndpoint,
		Timeout:  groqRequestTimeout,
	}
}

func (g *GroqChatCompleter) Complete(ctx context.Context, messages []ChatMessage) (string, error) {
	if g == nil || strings.TrimSpace(g.APIKey) == "" || strings.TrimSpace(g.Model) == "" {
		return "", fmt.Errorf("groq chat is not configured")
	}

	reqBody := struct {
		Model       string        `json:"model"`
		Messages    []ChatMessage `json:"messages"`
		Temperature float64       `json:"temperature"`
		MaxTokens   int           `json:"max_tokens"`
	}{
		Model:       g.Model,
		Messages:    messages,
		Temperature: 0.4,
		MaxTokens:   1024,
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("marshal groq chat request: %w", err)
	}

	timeout := g.Timeout
	if timeout <= 0 {
		timeout = groqRequestTimeout
	}
	requestContext, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	request, err := http.NewRequestWithContext(requestContext, http.MethodPost, g.Endpoint, bytes.NewReader(bodyBytes))
	if err != nil {
		return "", fmt.Errorf("create groq chat request: %w", err)
	}
	request.Header.Set("Authorization", "Bearer "+g.APIKey)
	request.Header.Set("Content-Type", "application/json")

	client := g.Client
	if client == nil {
		client = http.DefaultClient
	}
	response, err := client.Do(request)
	if err != nil {
		return "", fmt.Errorf("send groq chat request: %w", err)
	}
	defer response.Body.Close()

	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		respBytes, _ := io.ReadAll(io.LimitReader(response.Body, 1024))
		return "", fmt.Errorf("groq chat request failed with status %d: %s", response.StatusCode, string(respBytes))
	}

	var payload struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
		Error *struct {
			Message string `json:"message"`
		} `json:"error"`
	}

	if err := json.NewDecoder(io.LimitReader(response.Body, maxProviderResponseBytes)).Decode(&payload); err != nil {
		return "", fmt.Errorf("decode groq chat response: %w", err)
	}
	if payload.Error != nil && payload.Error.Message != "" {
		return "", fmt.Errorf("groq chat api error: %s", payload.Error.Message)
	}
	if len(payload.Choices) == 0 || strings.TrimSpace(payload.Choices[0].Message.Content) == "" {
		return "", fmt.Errorf("groq chat response did not contain content")
	}

	return payload.Choices[0].Message.Content, nil
}

package config

import (
	"testing"
	"time"
)

func TestLoadUsesEnvironmentAndDefaults(t *testing.T) {
	t.Setenv("API_ADDRESS", "127.0.0.1:9090")
	t.Setenv("DATABASE_URL", "postgres://example")
	t.Setenv("APP_ENV", "test")
	t.Setenv("LOG_LEVEL", "debug")
	t.Setenv("GROQ_API_KEY", "test-key")
	t.Setenv("STT_MODEL", "test-model")
	t.Setenv("LLM_MODEL", "openai/gpt-oss-120b")
	t.Setenv("AI_AUDIO_MAX_SECONDS", "90")
	t.Setenv("AI_ENABLED", "true")
	t.Setenv("ELEVENLABS_API_KEY", "test-eleven-key")
	t.Setenv("ELEVENLABS_VOICE_ID", "test-voice")
	t.Setenv("ELEVENLABS_MODEL", "eleven_multilingual_v2")
	t.Setenv("SESSION_TTL_HOURS", "24")

	got := Load()
	if got.Address != "127.0.0.1:9090" || got.DatabaseURL != "postgres://example" || got.Environment != "test" || got.LogLevel != "debug" {
		t.Fatalf("Load() = %#v", got)
	}
	if got.GroqAPIKey != "test-key" || got.STTModel != "test-model" || got.LLMModel != "openai/gpt-oss-120b" || got.AIAudioMaxSeconds != 90 || !got.AIEnabled || got.ElevenLabsAPIKey != "test-eleven-key" || got.ElevenLabsVoiceID != "test-voice" || got.ElevenLabsModel != "eleven_multilingual_v2" {
		t.Fatalf("AI config = %#v", got)
	}
	if got.ReadinessTimeout != 2*time.Second {
		t.Fatalf("ReadinessTimeout = %s", got.ReadinessTimeout)
	}
	if got.SessionTTLHours != 24 {
		t.Fatalf("SessionTTLHours = %d", got.SessionTTLHours)
	}
}

func TestLoadUsesSafeDefaults(t *testing.T) {
	for _, key := range []string{"API_ADDRESS", "DATABASE_URL", "APP_ENV", "LOG_LEVEL", "GROQ_API_KEY", "STT_MODEL", "LLM_MODEL", "AI_AUDIO_MAX_SECONDS", "AI_ENABLED", "ELEVENLABS_API_KEY", "ELEVENLABS_VOICE_ID", "ELEVENLABS_MODEL", "SESSION_TTL_HOURS"} {
		t.Setenv(key, "")
	}
	got := Load()
	if got.Address != ":8080" || got.Environment != "development" || got.LogLevel != "info" {
		t.Fatalf("Load() defaults = %#v", got)
	}
	if got.GroqAPIKey != "" || got.STTModel != "whisper-large-v3-turbo" || got.LLMModel != "openai/gpt-oss-120b" || got.AIAudioMaxSeconds != 60 || got.AIEnabled || got.ElevenLabsAPIKey != "" || got.ElevenLabsVoiceID != "Xb7hH8MSUJpSbSDYk0k2" || got.ElevenLabsModel != "eleven_multilingual_v2" || got.SessionTTLHours != 12 {
		t.Fatalf("AI defaults = %#v", got)
	}
}

func TestLoadUsesFallbacksForInvalidAIValues(t *testing.T) {
	t.Setenv("AI_AUDIO_MAX_SECONDS", "-1")
	t.Setenv("AI_ENABLED", "not-a-bool")
	got := Load()
	if got.AIAudioMaxSeconds != 60 || got.AIEnabled {
		t.Fatalf("invalid AI config = %#v", got)
	}
}

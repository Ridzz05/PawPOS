package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Address           string
	DatabaseURL       string
	Environment       string
	LogLevel          string
	ReadinessTimeout  time.Duration
	GroqAPIKey        string
	STTModel          string
	LLMModel          string
	AIAudioMaxSeconds int
	AIEnabled         bool
	ElevenLabsAPIKey  string
	ElevenLabsVoiceID string
	ElevenLabsModel   string
	WebDir            string
	SessionTTLHours   int
}

func Load() Config {
	loadDotEnv()
	return Config{
		Address:           value("API_ADDRESS", ":8080"),
		DatabaseURL:       value("DATABASE_URL", "postgres://pos:pos@localhost:5432/pos?sslmode=disable"),
		Environment:       value("APP_ENV", "development"),
		LogLevel:          value("LOG_LEVEL", "info"),
		ReadinessTimeout:  2 * time.Second,
		GroqAPIKey:        os.Getenv("GROQ_API_KEY"),
		STTModel:          value("STT_MODEL", "whisper-large-v3-turbo"),
		LLMModel:          value("LLM_MODEL", "openai/gpt-oss-120b"),
		AIAudioMaxSeconds: positiveInt("AI_AUDIO_MAX_SECONDS", 60),
		AIEnabled:         boolean("AI_ENABLED", false),
		ElevenLabsAPIKey:  os.Getenv("ELEVENLABS_API_KEY"),
		ElevenLabsVoiceID: value("ELEVENLABS_VOICE_ID", "Xb7hH8MSUJpSbSDYk0k2"),
		ElevenLabsModel:   value("ELEVENLABS_MODEL", "eleven_multilingual_v2"),
		WebDir:            value("WEB_DIR", ""),
		SessionTTLHours:   positiveInt("SESSION_TTL_HOURS", 12),
	}
}

func loadDotEnv() {
	paths := []string{".env", "../.env", "../../.env"}
	for _, p := range paths {
		data, err := os.ReadFile(p)
		if err != nil {
			continue
		}
		lines := strings.Split(string(data), "\n")
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			parts := strings.SplitN(line, "=", 2)
			if len(parts) == 2 {
				key := strings.TrimSpace(parts[0])
				val := strings.TrimSpace(parts[1])
				val = strings.Trim(val, `"'`)
				if _, exists := os.LookupEnv(key); !exists {
					_ = os.Setenv(key, val)
				}
			}
		}
		break
	}
}

func value(key, fallback string) string {
	if result := os.Getenv(key); result != "" {
		return result
	}
	return fallback
}

func positiveInt(key string, fallback int) int {
	result, err := strconv.Atoi(strings.TrimSpace(os.Getenv(key)))
	if err != nil || result <= 0 {
		return fallback
	}
	return result
}

func boolean(key string, fallback bool) bool {
	result, err := strconv.ParseBool(strings.TrimSpace(os.Getenv(key)))
	if err != nil {
		return fallback
	}
	return result
}

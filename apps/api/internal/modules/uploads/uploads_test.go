package uploads

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/muhri/ai-operational-pos/apps/api/internal/platform/envelope"
)

func TestUploadImageSuccess(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "pos-uploads-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	handler := NewHandler(tempDir)

	// Create multipart body with fake webp file
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile("file", "test-product.webp")
	if err != nil {
		t.Fatalf("create form file failed: %v", err)
	}

	// RIFF....WEBP header
	webpData := []byte("RIFF\x00\x00\x00\x00WEBPVP8 \x00\x00\x00\x00fake-webp-bytes")
	if _, err := part.Write(webpData); err != nil {
		t.Fatalf("write fake image failed: %v", err)
	}
	writer.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/v1/uploads", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	rec := httptest.NewRecorder()

	handler.UploadImage(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected status 201, got %d. Body: %s", rec.Code, rec.Body.String())
	}

	var resp envelope.Success[UploadResponse]
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("decode response failed: %v", err)
	}

	if resp.Data.URL == "" {
		t.Errorf("expected non-empty URL")
	}

	// Check file exists in tempDir
	savedFile := filepath.Join(tempDir, resp.Data.Filename)
	if _, err := os.Stat(savedFile); os.IsNotExist(err) {
		t.Errorf("saved file does not exist on disk: %s", savedFile)
	}
}

func TestUploadImageRejectsNonImage(t *testing.T) {
	tempDir, _ := os.MkdirTemp("", "pos-uploads-test-*")
	defer os.RemoveAll(tempDir)

	handler := NewHandler(tempDir)

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, _ := writer.CreateFormFile("file", "script.sh")
	part.Write([]byte("#!/bin/bash\necho hello"))
	writer.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/v1/uploads", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	rec := httptest.NewRecorder()

	handler.UploadImage(rec, req)

	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("expected status 422, got %d", rec.Code)
	}
}

func TestUploadImageMissingFileField(t *testing.T) {
	tempDir, _ := os.MkdirTemp("", "pos-uploads-test-*")
	defer os.RemoveAll(tempDir)

	handler := NewHandler(tempDir)

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	_ = writer.WriteField("other", "value")
	writer.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/v1/uploads", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	rec := httptest.NewRecorder()

	handler.UploadImage(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", rec.Code)
	}
}

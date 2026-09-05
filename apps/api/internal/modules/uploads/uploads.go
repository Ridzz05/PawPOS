package uploads

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/muhri/ai-operational-pos/apps/api/internal/platform/envelope"
)

type UploadResponse struct {
	URL         string `json:"url"`
	Filename    string `json:"filename"`
	Size        int64  `json:"size"`
	ContentType string `json:"content_type"`
}

var (
	ErrFileRequired     = errors.New("file parameter is required in multipart form")
	ErrFileTooLarge     = errors.New("file exceeds maximum allowed size of 10MB")
	ErrInvalidImageType = errors.New("invalid file format: only webp, png, jpeg images are allowed")
)

var allowedMimeTypes = map[string]string{
	"image/webp": ".webp",
	"image/png":  ".png",
	"image/jpeg": ".jpg",
	"image/jpg":  ".jpg",
}

type Handler struct {
	uploadDir string
}

func NewHandler(uploadDir string) *Handler {
	if strings.TrimSpace(uploadDir) == "" {
		uploadDir = "./uploads"
	}
	_ = os.MkdirAll(uploadDir, 0755)
	return &Handler{uploadDir: uploadDir}
}

func (h *Handler) UploadImage(w http.ResponseWriter, r *http.Request) {
	// 10 MB limit
	r.Body = http.MaxBytesReader(w, r.Body, 10<<20)
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		envelope.WriteError(w, r, http.StatusBadRequest, "FILE_TOO_LARGE", ErrFileTooLarge.Error(), nil)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		envelope.WriteError(w, r, http.StatusBadRequest, "FILE_REQUIRED", ErrFileRequired.Error(), nil)
		return
	}
	defer file.Close()

	// Read first 512 bytes to sniff content type
	buffer := make([]byte, 512)
	n, err := file.Read(buffer)
	if err != nil && err != io.EOF {
		envelope.WriteError(w, r, http.StatusInternalServerError, "READ_ERROR", "Failed to read file.", nil)
		return
	}

	detectedMime := http.DetectContentType(buffer[:n])
	headerMime := header.Header.Get("Content-Type")

	// Verify MIME type
	finalMime := detectedMime
	ext, ok := allowedMimeTypes[detectedMime]
	if !ok {
		ext, ok = allowedMimeTypes[headerMime]
		if !ok {
			envelope.WriteError(w, r, http.StatusUnprocessableEntity, "INVALID_FORMAT", ErrInvalidImageType.Error(), nil)
			return
		}
		finalMime = headerMime
	}

	// Rewind file pointer
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		envelope.WriteError(w, r, http.StatusInternalServerError, "SEEK_ERROR", "Failed to process file.", nil)
		return
	}

	randomBytes := make([]byte, 6)
	_, _ = rand.Read(randomBytes)
	randomSuffix := hex.EncodeToString(randomBytes)

	// If the file was sent as WebP or converted to WebP, preserve .webp
	origExt := strings.ToLower(filepath.Ext(header.Filename))
	if origExt == ".webp" {
		ext = ".webp"
	}

	filename := fmt.Sprintf("prod-%s-%s%s", time.Now().Format("20060102-150405"), randomSuffix, ext)
	dstPath := filepath.Join(h.uploadDir, filename)

	out, err := os.Create(dstPath)
	if err != nil {
		envelope.WriteError(w, r, http.StatusInternalServerError, "SAVE_ERROR", "Failed to save uploaded file.", nil)
		return
	}
	defer out.Close()

	written, err := io.Copy(out, file)
	if err != nil {
		envelope.WriteError(w, r, http.StatusInternalServerError, "SAVE_ERROR", "Failed to write uploaded file.", nil)
		return
	}

	res := UploadResponse{
		URL:         "/uploads/" + filename,
		Filename:    filename,
		Size:        written,
		ContentType: finalMime,
	}

	envelope.Write(w, r, http.StatusCreated, res)
}

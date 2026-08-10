package handlers

import (
	"bytes"
	"errors"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func buildMultipartUploadRequest(t *testing.T, fields map[string]string, fileField, fileName string, fileContent []byte) *http.Request {
	t.Helper()

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	for key, value := range fields {
		if err := writer.WriteField(key, value); err != nil {
			t.Fatalf("WriteField(%q): %v", key, err)
		}
	}

	if fileField != "" {
		part, err := writer.CreateFormFile(fileField, fileName)
		if err != nil {
			t.Fatalf("CreateFormFile: %v", err)
		}
		if _, err := part.Write(fileContent); err != nil {
			t.Fatalf("write file content: %v", err)
		}
	}

	if err := writer.Close(); err != nil {
		t.Fatalf("close multipart writer: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/upload", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	return req
}

func TestStreamMultipartUploadToFile(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	destPath := filepath.Join(dir, "upload.bin")
	content := []byte("streaming multipart payload")

	rec := httptest.NewRecorder()
	req := buildMultipartUploadRequest(t, map[string]string{
		"note": "hello",
	}, "file", "OfficeSetup.exe", content)

	fileName, fields, written, err := streamMultipartUploadToFile(rec, req, destPath, 1<<20)
	if err != nil {
		t.Fatalf("streamMultipartUploadToFile() err = %v", err)
	}
	if fileName != "OfficeSetup.exe" {
		t.Fatalf("fileName = %q, want OfficeSetup.exe", fileName)
	}
	if fields["note"] != "hello" {
		t.Fatalf("fields[note] = %q, want hello", fields["note"])
	}
	if written != int64(len(content)) {
		t.Fatalf("written = %d, want %d", written, len(content))
	}

	saved, err := os.ReadFile(destPath)
	if err != nil {
		t.Fatalf("ReadFile: %v", err)
	}
	if !bytes.Equal(saved, content) {
		t.Fatalf("saved content mismatch")
	}
}

func TestStreamMultipartUploadToFileRejectsOversizedPayload(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	destPath := filepath.Join(dir, "too-large.bin")
	rec := httptest.NewRecorder()
	largeContent := bytes.Repeat([]byte("a"), 4096)
	req := buildMultipartUploadRequest(t, map[string]string{"note": "x"}, "file", "big.bin", largeContent)

	_, _, _, err := streamMultipartUploadToFile(rec, req, destPath, 1024)
	if !errors.Is(err, errMultipartFileTooLarge) {
		t.Fatalf("streamMultipartUploadToFile() err = %v, want errMultipartFileTooLarge", err)
	}
}

func TestStreamMultipartUploadToFileRequiresFilePart(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	destPath := filepath.Join(dir, "missing.bin")
	rec := httptest.NewRecorder()
	req := buildMultipartUploadRequest(t, map[string]string{"only": "field"}, "", "", nil)

	_, _, _, err := streamMultipartUploadToFile(rec, req, destPath, 1<<20)
	if !errors.Is(err, errMultipartMissingFile) {
		t.Fatalf("streamMultipartUploadToFile() err = %v, want errMultipartMissingFile", err)
	}
}

func TestStreamMultipartUploadToFileAllowsFileBeforeFields(t *testing.T) {
	t.Parallel()

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	filePart, err := writer.CreateFormFile("file", "setup.msi")
	if err != nil {
		t.Fatalf("CreateFormFile: %v", err)
	}
	if _, err := filePart.Write([]byte("installer-bytes")); err != nil {
		t.Fatalf("write file: %v", err)
	}
	if err := writer.WriteField("appId", "12"); err != nil {
		t.Fatalf("WriteField: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close writer: %v", err)
	}

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/upload", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	destPath := filepath.Join(t.TempDir(), "setup.msi")
	fileName, fields, written, err := streamMultipartUploadToFile(rec, req, destPath, 1<<20)
	if err != nil {
		t.Fatalf("streamMultipartUploadToFile() err = %v", err)
	}
	if fileName != "setup.msi" || fields["appId"] != "12" || written != 15 {
		t.Fatalf("fileName=%q fields=%v written=%d", fileName, fields, written)
	}
}

func TestMultipartUploadErrorStatus(t *testing.T) {
	t.Parallel()

	status, message := multipartUploadErrorStatus(errMultipartFileTooLarge)
	if status != http.StatusRequestEntityTooLarge || message == "" {
		t.Fatalf("multipartUploadErrorStatus() = (%d, %q)", status, message)
	}
}

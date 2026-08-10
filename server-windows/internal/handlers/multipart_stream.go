package handlers

import (
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

const maxMultipartFieldBytes = 1 << 20 // 1 MiB — form fields only; file payload is streamed.

var (
	errMultipartMissingFile   = errors.New("missing file upload")
	errMultipartMultipleFiles = errors.New("multiple file uploads are not supported")
	errMultipartFileTooLarge  = errors.New("file exceeds upload size limit")
	errMultipartEmptyFile     = errors.New("empty file upload")
)

// streamedMultipartUpload reads multipart/form-data directly from the request body
// without ParseMultipartForm or FormFile, streaming the file part to destPath.
func streamMultipartUploadToFile(
	w http.ResponseWriter,
	r *http.Request,
	destPath string,
	maxFileBytes int64,
	extraWriters ...io.Writer,
) (fileName string, fields map[string]string, written int64, err error) {
	if maxFileBytes <= 0 {
		return "", nil, 0, fmt.Errorf("invalid upload size limit")
	}

	// Allow small multipart overhead (boundaries, field names) on top of the file payload.
	r.Body = http.MaxBytesReader(w, r.Body, maxFileBytes+(1<<20))

	reader, err := r.MultipartReader()
	if err != nil {
		return "", nil, 0, err
	}

	fields = make(map[string]string)
	var fileWritten bool

	for {
		part, partErr := reader.NextPart()
		if partErr == io.EOF {
			break
		}
		if partErr != nil {
			return fileName, fields, written, partErr
		}

		formName := part.FormName()
		if formName == "" {
			_ = part.Close()
			continue
		}

		partFileName := strings.TrimSpace(part.FileName())
		if partFileName != "" {
			if fileWritten {
				_ = part.Close()
				return fileName, fields, written, errMultipartMultipleFiles
			}
			fileWritten = true
			fileName = filepath.Base(partFileName)

			// Must consume the file part before the next NextPart() call; otherwise
			// mime/multipart discards any unread bytes in the current part.
			partWritten, streamErr := streamMultipartFilePart(part, destPath, maxFileBytes, extraWriters...)
			_ = part.Close()
			if streamErr != nil {
				return fileName, fields, partWritten, streamErr
			}
			written = partWritten
			continue
		}

		valueBytes, readErr := io.ReadAll(io.LimitReader(part, maxMultipartFieldBytes))
		_ = part.Close()
		if readErr != nil {
			return fileName, fields, written, readErr
		}
		fields[formName] = strings.TrimSpace(string(valueBytes))
	}

	if !fileWritten {
		return fileName, fields, written, errMultipartMissingFile
	}
	if fileName == "" || fileName == "." {
		return fileName, fields, written, fmt.Errorf("invalid file name")
	}

	return fileName, fields, written, nil
}

func streamMultipartFilePart(
	part *multipart.Part,
	destPath string,
	maxFileBytes int64,
	extraWriters ...io.Writer,
) (int64, error) {
	dest, createErr := os.Create(destPath)
	if createErr != nil {
		return 0, createErr
	}

	writers := make([]io.Writer, 0, 1+len(extraWriters))
	writers = append(writers, dest)
	writers = append(writers, extraWriters...)

	written, copyErr := io.Copy(io.MultiWriter(writers...), io.LimitReader(part, maxFileBytes+1))
	closeErr := dest.Close()
	if copyErr != nil {
		return written, copyErr
	}
	if closeErr != nil {
		return written, closeErr
	}
	if written == 0 {
		return written, errMultipartEmptyFile
	}
	if written > maxFileBytes {
		return written, errMultipartFileTooLarge
	}
	return written, nil
}

func multipartUploadErrorStatus(err error) (int, string) {
	switch {
	case errors.Is(err, errMultipartMissingFile):
		return http.StatusBadRequest, errMultipartMissingFile.Error()
	case errors.Is(err, errMultipartMultipleFiles):
		return http.StatusBadRequest, errMultipartMultipleFiles.Error()
	case errors.Is(err, errMultipartEmptyFile):
		return http.StatusBadRequest, errMultipartEmptyFile.Error()
	case errors.Is(err, errMultipartFileTooLarge):
		return http.StatusRequestEntityTooLarge, errMultipartFileTooLarge.Error()
	default:
		if err != nil && strings.Contains(err.Error(), "multipart:") {
			return http.StatusBadRequest, "invalid multipart upload"
		}
		if err != nil && strings.Contains(err.Error(), "request body too large") {
			return http.StatusRequestEntityTooLarge, errMultipartFileTooLarge.Error()
		}
		return http.StatusInternalServerError, ""
	}
}

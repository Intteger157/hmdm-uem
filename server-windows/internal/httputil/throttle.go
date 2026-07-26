package httputil

import (
	"context"
	"io"
	"os"

	"golang.org/x/time/rate"
)

const defaultFileDownloadBytesPerSec = 17 << 20 // ~17 MiB/s (between 15–20 MB/s)

// ThrottledReadSeeker wraps a file and limits read throughput for one HTTP connection.
type ThrottledReadSeeker struct {
	file    *os.File
	limiter *rate.Limiter
}

// NewThrottledReadSeeker opens path and applies a byte-per-second limit.
func NewThrottledReadSeeker(path string, bytesPerSec int) (*ThrottledReadSeeker, error) {
	if bytesPerSec <= 0 {
		bytesPerSec = defaultFileDownloadBytesPerSec
	}

	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}

	burst := 1 << 20
	if burst > bytesPerSec {
		burst = bytesPerSec
	}
	if burst < 64<<10 {
		burst = 64 << 10
	}

	return &ThrottledReadSeeker{
		file:    file,
		limiter: rate.NewLimiter(rate.Limit(bytesPerSec), burst),
	}, nil
}

// Close closes the underlying file.
func (t *ThrottledReadSeeker) Close() error {
	if t == nil || t.file == nil {
		return nil
	}
	return t.file.Close()
}

// Read throttles throughput before delegating to the underlying file.
func (t *ThrottledReadSeeker) Read(p []byte) (int, error) {
	if len(p) == 0 {
		return 0, nil
	}
	if err := t.limiter.WaitN(context.Background(), len(p)); err != nil {
		return 0, err
	}
	return t.file.Read(p)
}

// Seek delegates to the underlying file.
func (t *ThrottledReadSeeker) Seek(offset int64, whence int) (int64, error) {
	return t.file.Seek(offset, whence)
}

// ThrottledReader wraps any reader with a byte-per-second limit.
type ThrottledReader struct {
	reader  io.Reader
	limiter *rate.Limiter
}

// NewThrottledReader wraps reader with a byte-per-second limit.
func NewThrottledReader(reader io.Reader, bytesPerSec int) *ThrottledReader {
	if bytesPerSec <= 0 {
		bytesPerSec = defaultFileDownloadBytesPerSec
	}
	burst := 1 << 20
	if burst > bytesPerSec {
		burst = bytesPerSec
	}
	if burst < 64<<10 {
		burst = 64 << 10
	}
	return &ThrottledReader{
		reader:  reader,
		limiter: rate.NewLimiter(rate.Limit(bytesPerSec), burst),
	}
}

// Read throttles throughput before delegating to the underlying reader.
func (t *ThrottledReader) Read(p []byte) (int, error) {
	if len(p) == 0 {
		return 0, nil
	}
	if err := t.limiter.WaitN(context.Background(), len(p)); err != nil {
		return 0, err
	}
	return t.reader.Read(p)
}

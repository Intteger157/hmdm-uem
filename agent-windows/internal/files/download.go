//go:build windows

package files

import (
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/hmdm/agent-windows/internal/brand"
)

const fileDownloadTimeout = 3 * time.Hour

const skipDownloadLogMessage = "File already exists and size matches, skipping download"

func headRemoteContentLength(downloadURL string) (int64, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	request, err := http.NewRequestWithContext(ctx, http.MethodHead, downloadURL, nil)
	if err != nil {
		return 0, err
	}
	request.Header.Set("User-Agent", brand.UserAgent)

	response, err := fileDownloadHTTPClient().Do(request)
	if err != nil {
		return 0, err
	}
	defer response.Body.Close()
	io.Copy(io.Discard, response.Body)

	if response.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("HTTP %d", response.StatusCode)
	}
	if response.ContentLength <= 0 {
		return 0, fmt.Errorf("missing Content-Length")
	}
	return response.ContentLength, nil
}

func downloadFileResumable(downloadURL, destPath string) error {
	if err := os.MkdirAll(filepath.Dir(destPath), os.ModePerm); err != nil {
		return fmt.Errorf("create download directory: %w", err)
	}

	client := fileDownloadHTTPClient()

	var offset int64
	if info, err := os.Stat(destPath); err == nil {
		offset = info.Size()
	}

	for {
		restart, err := downloadFileResumableOnce(client, downloadURL, destPath, offset)
		if err != nil {
			return err
		}
		if !restart {
			return nil
		}
		offset = 0
	}
}

func downloadFileResumableOnce(client *http.Client, downloadURL, destPath string, offset int64) (restart bool, err error) {
	ctx, cancel := context.WithTimeout(context.Background(), fileDownloadTimeout)
	defer cancel()

	request, err := http.NewRequestWithContext(ctx, http.MethodGet, downloadURL, nil)
	if err != nil {
		return false, err
	}
	request.Header.Set("User-Agent", brand.UserAgent)
	if offset > 0 {
		request.Header.Set("Range", fmt.Sprintf("bytes=%d-", offset))
	}

	response, err := client.Do(request)
	if err != nil {
		return false, err
	}
	defer response.Body.Close()

	switch response.StatusCode {
	case http.StatusOK:
		if offset > 0 {
			if err := os.Truncate(destPath, 0); err != nil {
				return false, err
			}
			return true, nil
		}
	case http.StatusPartialContent:
		// Continue from current offset.
	case http.StatusRequestedRangeNotSatisfiable:
		if offset > 0 {
			return false, nil
		}
		return false, fmt.Errorf("HTTP %d", response.StatusCode)
	default:
		message := readLimitedHTTPErrorBody(response.Body)
		if message == "" {
			return false, fmt.Errorf("HTTP %d", response.StatusCode)
		}
		return false, fmt.Errorf("HTTP %d: %s", response.StatusCode, message)
	}

	file, err := os.OpenFile(destPath, os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return false, err
	}
	defer file.Close()

	if offset > 0 {
		if _, err := file.Seek(offset, io.SeekStart); err != nil {
			return false, err
		}
	} else if response.StatusCode == http.StatusOK {
		if err := file.Truncate(0); err != nil {
			return false, err
		}
	}

	written, err := io.Copy(file, response.Body)
	if err != nil {
		return false, err
	}
	if written == 0 && offset == 0 {
		return false, fmt.Errorf("downloaded file is empty")
	}
	return false, nil
}

func fileDownloadHTTPClient() *http.Client {
	return &http.Client{
		Timeout: 0,
		Transport: &http.Transport{
			Proxy: http.ProxyFromEnvironment,
			DialContext: (&net.Dialer{
				Timeout:   30 * time.Second,
				KeepAlive: 30 * time.Second,
			}).DialContext,
			TLSHandshakeTimeout:   30 * time.Second,
			ResponseHeaderTimeout: 2 * time.Minute,
			ExpectContinueTimeout: 1 * time.Second,
			MaxIdleConns:          10,
			IdleConnTimeout:       90 * time.Second,
		},
	}
}

func readLimitedHTTPErrorBody(body io.Reader) string {
	if body == nil {
		return ""
	}
	payload, _ := io.ReadAll(io.LimitReader(body, 4096))
	return strings.TrimSpace(string(payload))
}

func partialDownloadPath(cachePath string) string {
	return cachePath + ".part"
}

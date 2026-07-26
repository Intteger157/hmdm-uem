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
		ctx, cancel := context.WithTimeout(context.Background(), fileDownloadTimeout)

		request, err := http.NewRequestWithContext(ctx, http.MethodGet, downloadURL, nil)
		if err != nil {
			cancel()
			return err
		}
		request.Header.Set("User-Agent", brand.UserAgent)
		if offset > 0 {
			request.Header.Set("Range", fmt.Sprintf("bytes=%d-", offset))
		}

		response, err := client.Do(request)
		if err != nil {
			cancel()
			return err
		}

		switch response.StatusCode {
		case http.StatusOK:
			if offset > 0 {
				response.Body.Close()
				cancel()
				if err := os.Truncate(destPath, 0); err != nil {
					return err
				}
				offset = 0
				continue
			}
		case http.StatusPartialContent:
			// Continue from current offset.
		case http.StatusRequestedRangeNotSatisfiable:
			response.Body.Close()
			cancel()
			if offset > 0 {
				return nil
			}
			return fmt.Errorf("HTTP %d", response.StatusCode)
		default:
			message := readLimitedHTTPErrorBody(response.Body)
			response.Body.Close()
			cancel()
			if message == "" {
				return fmt.Errorf("HTTP %d", response.StatusCode)
			}
			return fmt.Errorf("HTTP %d: %s", response.StatusCode, message)
		}

		file, err := os.OpenFile(destPath, os.O_CREATE|os.O_WRONLY, 0o644)
		if err != nil {
			response.Body.Close()
			cancel()
			return err
		}
		if offset > 0 {
			if _, err := file.Seek(offset, io.SeekStart); err != nil {
				file.Close()
				response.Body.Close()
				cancel()
				return err
			}
		} else if response.StatusCode == http.StatusOK {
			if err := file.Truncate(0); err != nil {
				file.Close()
				response.Body.Close()
				cancel()
				return err
			}
		}

		written, copyErr := io.Copy(file, response.Body)
		closeBodyErr := response.Body.Close()
		closeFileErr := file.Close()
		cancel()
		if copyErr != nil {
			return copyErr
		}
		if closeBodyErr != nil {
			return closeBodyErr
		}
		if closeFileErr != nil {
			return closeFileErr
		}
		if written == 0 && offset == 0 {
			return fmt.Errorf("downloaded file is empty")
		}
		return nil
	}
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

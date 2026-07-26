//go:build windows

package files

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"

	"github.com/hmdm/agent-windows/internal/brand"
)

func downloadFileResumable(downloadURL, destPath string) error {
	client := &http.Client{Timeout: 0}

	var offset int64
	if info, err := os.Stat(destPath); err == nil {
		offset = info.Size()
	}

	for {
		request, err := http.NewRequest(http.MethodGet, downloadURL, nil)
		if err != nil {
			return err
		}
		request.Header.Set("User-Agent", brand.UserAgent)
		if offset > 0 {
			request.Header.Set("Range", fmt.Sprintf("bytes=%d-", offset))
		}

		response, err := client.Do(request)
		if err != nil {
			return err
		}

		switch response.StatusCode {
		case http.StatusOK:
			if offset > 0 {
				response.Body.Close()
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
			if offset > 0 {
				return nil
			}
			return fmt.Errorf("HTTP %d", response.StatusCode)
		default:
			body, _ := io.ReadAll(io.LimitReader(response.Body, 4096))
			response.Body.Close()
			message := strings.TrimSpace(string(body))
			if message == "" {
				return fmt.Errorf("HTTP %d", response.StatusCode)
			}
			return fmt.Errorf("HTTP %d: %s", response.StatusCode, message)
		}

		file, err := os.OpenFile(destPath, os.O_CREATE|os.O_WRONLY, 0o644)
		if err != nil {
			response.Body.Close()
			return err
		}
		if offset > 0 {
			if _, err := file.Seek(offset, io.SeekStart); err != nil {
				file.Close()
				response.Body.Close()
				return err
			}
		} else if response.StatusCode == http.StatusOK {
			if err := file.Truncate(0); err != nil {
				file.Close()
				response.Body.Close()
				return err
			}
		}

		written, copyErr := io.Copy(file, response.Body)
		closeBodyErr := response.Body.Close()
		closeFileErr := file.Close()
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

func partialDownloadPath(cachePath string) string {
	return cachePath + ".part"
}

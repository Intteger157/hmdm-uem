//go:build windows

package filexplorer

import (
	"fmt"
	"os"
)

func openUploadDestination(path string) (*os.File, error) {
	cleanPath, err := normalizeFilePath(path)
	if err != nil {
		return nil, err
	}

	file, err := os.Create(cleanPath)
	if err != nil {
		return nil, err
	}
	return file, nil
}

func writeUploadChunk(file *os.File, data []byte) error {
	if file == nil {
		return fmt.Errorf("upload file is not open")
	}
	if len(data) == 0 {
		return nil
	}
	_, err := file.Write(data)
	return err
}

func closeUploadDestination(file *os.File) error {
	if file == nil {
		return fmt.Errorf("upload file is not open")
	}
	return file.Close()
}

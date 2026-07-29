//go:build windows

package filexplorer

import (
	"encoding/json"
	"time"
)

const (
	ActionReadDir  = "read_dir"
	ActionDownload = "download"

	MessageTypeDirList       = "dir_list"
	MessageTypeDownloadStart = "download_start"
	MessageTypeDownloadEnd   = "download_end"
	MessageTypeError         = "error"

	downloadChunkSize = 64 * 1024
)

type incomingCommand struct {
	Action string `json:"action"`
	Path   string `json:"path"`
}

type dirListItem struct {
	Name    string `json:"name"`
	IsDir   bool   `json:"is_dir"`
	Size    int64  `json:"size"`
	ModTime string `json:"mod_time"`
}

type dirListMessage struct {
	Type  string        `json:"type"`
	Path  string        `json:"path"`
	Items []dirListItem `json:"items"`
}

type downloadStartMessage struct {
	Type     string `json:"type"`
	Filename string `json:"filename"`
	Size     int64  `json:"size"`
}

type downloadEndMessage struct {
	Type string `json:"type"`
}

type errorMessage struct {
	Type    string `json:"type"`
	Message string `json:"message"`
}

func encodeJSONMessage(value any) ([]byte, error) {
	return json.Marshal(value)
}

func formatModTime(modTime time.Time) string {
	if modTime.IsZero() {
		return ""
	}
	return modTime.UTC().Format(time.RFC3339)
}

func parseIncomingCommand(data []byte) (incomingCommand, error) {
	var cmd incomingCommand
	if err := json.Unmarshal(data, &cmd); err != nil {
		return incomingCommand{}, err
	}
	cmd.Action = trimCommandField(cmd.Action)
	cmd.Path = trimCommandField(cmd.Path)
	return cmd, nil
}

func trimCommandField(value string) string {
	// Preserve Windows paths; only trim surrounding whitespace.
	for len(value) > 0 && (value[0] == ' ' || value[0] == '\t' || value[0] == '\n' || value[0] == '\r') {
		value = value[1:]
	}
	for len(value) > 0 {
		last := value[len(value)-1]
		if last != ' ' && last != '\t' && last != '\n' && last != '\r' {
			break
		}
		value = value[:len(value)-1]
	}
	return value
}

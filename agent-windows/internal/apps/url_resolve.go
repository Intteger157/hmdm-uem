package apps

import (
	"fmt"
	"net/url"
	"strings"
)

// resolveDownloadURL turns relative storage paths into absolute HTTP(S) URLs using the MDM server base URL.
func resolveDownloadURL(baseURL, downloadURL string) (string, error) {
	trimmed := strings.TrimSpace(downloadURL)
	if trimmed == "" {
		return "", fmt.Errorf("empty download URL")
	}

	lower := strings.ToLower(trimmed)
	if strings.HasPrefix(lower, "http://") || strings.HasPrefix(lower, "https://") {
		return alignDownloadScheme(baseURL, trimmed), nil
	}

	serverBase := strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if serverBase == "" {
		return "", fmt.Errorf("missing server base URL")
	}

	parsedBase, err := url.Parse(serverBase)
	if err != nil {
		return "", fmt.Errorf("parse server base URL: %w", err)
	}
	if parsedBase.Scheme == "" || parsedBase.Host == "" {
		return "", fmt.Errorf("invalid server base URL: %q", serverBase)
	}

	if strings.HasPrefix(trimmed, "/") {
		origin := parsedBase.Scheme + "://" + parsedBase.Host
		return alignDownloadScheme(serverBase, origin+trimmed), nil
	}

	ref, err := url.Parse(trimmed)
	if err != nil {
		return "", fmt.Errorf("parse download URL: %w", err)
	}

	resolved := parsedBase.ResolveReference(ref).String()
	return alignDownloadScheme(serverBase, resolved), nil
}

func alignDownloadScheme(baseURL, downloadURL string) string {
	base, err := url.Parse(strings.TrimRight(strings.TrimSpace(baseURL), "/"))
	if err != nil || base.Scheme == "" || base.Host == "" {
		return downloadURL
	}

	target, err := url.Parse(strings.TrimSpace(downloadURL))
	if err != nil || target.Scheme == "" || target.Host == "" {
		return downloadURL
	}

	if strings.EqualFold(base.Scheme, "https") && strings.EqualFold(target.Scheme, "http") {
		if strings.EqualFold(base.Hostname(), target.Hostname()) {
			target.Scheme = "https"
			return target.String()
		}
	}

	return downloadURL
}

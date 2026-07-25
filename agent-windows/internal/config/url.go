package config

import (
	"net/url"
	"strings"
)

func normalizeServerURL(raw string) string {
	trimmed := strings.TrimRight(strings.TrimSpace(raw), "/")
	if trimmed == "" {
		return defaultServerURL
	}

	trimmed = fixURLSchemeTypos(trimmed)

	lower := strings.ToLower(trimmed)
	if strings.HasPrefix(lower, "http://") &&
		!strings.Contains(lower, "localhost") &&
		!strings.Contains(lower, "127.0.0.1") {
		return "https://" + strings.TrimPrefix(trimmed, "http://")
	}

	if _, err := url.Parse(trimmed); err != nil {
		if fixed := tryFixMalformedScheme(trimmed); fixed != trimmed {
			if _, err := url.Parse(fixed); err == nil {
				return fixed
			}
		}
	}

	return trimmed
}

func fixURLSchemeTypos(raw string) string {
	replacements := []struct{ from, to string }{
		{"httpы://", "https://"},
		{"HTTPЫ://", "https://"},
		{"httpsы://", "https://"},
		{"HTTPSЫ://", "https://"},
		{"httр://", "http://"},
		{"HTTР://", "http://"},
		{"httрs://", "https://"},
		{"HTTРS://", "https://"},
	}
	for _, item := range replacements {
		if strings.HasPrefix(raw, item.from) {
			return item.to + strings.TrimPrefix(raw, item.from)
		}
	}
	return raw
}

func tryFixMalformedScheme(raw string) string {
	if idx := strings.Index(raw, "://"); idx > 0 {
		scheme := raw[:idx]
		rest := raw[idx:]
		if strings.Contains(scheme, "ы") || strings.Contains(scheme, "р") {
			return "https" + rest
		}
	}
	return raw
}

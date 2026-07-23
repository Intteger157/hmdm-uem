package handlers

import (
	"net/url"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

func buildPublicURL(c *gin.Context, publicPath string) string {
	if base := strings.TrimSpace(os.Getenv("PUBLIC_BASE_URL")); base != "" {
		return strings.TrimRight(base, "/") + publicPath
	}

	scheme := preferredPublicScheme(c)
	host := publicRequestHost(c)
	return scheme + "://" + host + publicPath
}

func preferredPublicScheme(c *gin.Context) string {
	if proto := strings.TrimSpace(os.Getenv("PUBLIC_PROTOCOL")); proto != "" {
		proto = strings.TrimSuffix(strings.ToLower(proto), "://")
		if proto == "http" || proto == "https" {
			return proto
		}
	}

	if forwarded := strings.TrimSpace(c.GetHeader("X-Forwarded-Proto")); forwarded != "" {
		forwarded = strings.ToLower(strings.Split(forwarded, ",")[0])
		forwarded = strings.TrimSpace(forwarded)
		if forwarded == "http" || forwarded == "https" {
			return forwarded
		}
	}

	if c.Request.TLS != nil {
		return "https"
	}

	if isPublicHostname(publicRequestHost(c)) {
		return "https"
	}

	return "http"
}

func publicRequestHost(c *gin.Context) string {
	host := strings.TrimSpace(c.GetHeader("X-Forwarded-Host"))
	if host != "" {
		return strings.TrimSpace(strings.Split(host, ",")[0])
	}
	return strings.TrimSpace(c.Request.Host)
}

func isPublicHostname(host string) bool {
	host = strings.ToLower(strings.TrimSpace(host))
	if host == "" {
		return false
	}
	if strings.Contains(host, "localhost") || strings.HasPrefix(host, "127.0.0.1") {
		return false
	}
	if strings.Contains(host, ":") {
		host = strings.Split(host, ":")[0]
	}
	return strings.Contains(host, ".")
}

func normalizeDownloadURL(raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ""
	}

	parsed, err := url.Parse(trimmed)
	if err != nil || parsed.Host == "" {
		return trimmed
	}

	if strings.EqualFold(parsed.Scheme, "http") && isPublicHostname(parsed.Host) {
		parsed.Scheme = "https"
		return parsed.String()
	}

	return trimmed
}

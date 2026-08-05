package auth

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

const oauthStateCookie = "sso_oauth_state"

// IssueOAuthState stores a CSRF state value in an HttpOnly cookie.
func IssueOAuthState(c *gin.Context) (string, error) {
	state, err := randomState()
	if err != nil {
		return "", err
	}

	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(oauthStateCookie, state, 600, "/", "", cookieSecure(c), true)
	return state, nil
}

// ValidateOAuthState compares the callback state with the cookie and clears it.
func ValidateOAuthState(c *gin.Context, state string) bool {
	state = strings.TrimSpace(state)
	if state == "" {
		return false
	}

	cookie, err := c.Cookie(oauthStateCookie)
	if err != nil || strings.TrimSpace(cookie) == "" {
		return false
	}

	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(oauthStateCookie, "", -1, "/", "", cookieSecure(c), true)
	return cookie == state
}

func randomState() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("generate oauth state: %w", err)
	}
	return hex.EncodeToString(buf), nil
}

const ssoJWTCookie = "singularity_sso_jwt"

// SetSSOJWTCookie stores the minted console JWT for the SPA login handoff.
func SetSSOJWTCookie(c *gin.Context, jwt string) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(ssoJWTCookie, jwt, 120, "/", "", cookieSecure(c), false)
}

func cookieSecure(c *gin.Context) bool {
	if proto := strings.ToLower(strings.TrimSpace(c.GetHeader("X-Forwarded-Proto"))); proto != "" {
		return proto == "https"
	}
	return c.Request.TLS != nil
}

// PublicBaseURL resolves the external origin for OAuth redirect URIs.
func PublicBaseURL(c *gin.Context) string {
	if configured := strings.TrimSpace(os.Getenv("PUBLIC_BASE_URL")); configured != "" {
		return strings.TrimRight(configured, "/")
	}

	scheme := "https"
	if proto := strings.ToLower(strings.TrimSpace(c.GetHeader("X-Forwarded-Proto"))); proto != "" {
		scheme = proto
	} else if c.Request.TLS == nil {
		scheme = "http"
	}

	host := strings.TrimSpace(c.GetHeader("X-Forwarded-Host"))
	if host == "" {
		host = c.Request.Host
	}

	return scheme + "://" + host
}

// MicrosoftOAuthCallbackPath is the public callback path reachable via /rest/windows/ on
// gateways that do not yet proxy /api/auth/ to Go.
const MicrosoftOAuthCallbackPath = "/rest/windows/public/auth/callback/microsoft"

// MicrosoftRedirectURI returns the callback URL registered in Entra ID.
func MicrosoftRedirectURI(c *gin.Context) string {
	if configured := strings.TrimSpace(os.Getenv("OAUTH_CALLBACK_PATH")); configured != "" {
		if strings.HasPrefix(configured, "http://") || strings.HasPrefix(configured, "https://") {
			return strings.TrimRight(configured, "/")
		}
		return PublicBaseURL(c) + configured
	}
	return PublicBaseURL(c) + MicrosoftOAuthCallbackPath
}

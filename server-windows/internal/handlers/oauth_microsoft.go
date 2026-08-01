package handlers

import (
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/hmdm/server-windows/internal/auth"
	"github.com/hmdm/server-windows/internal/db"
	"github.com/hmdm/server-windows/internal/models"
	"gorm.io/gorm"
)

const (
	loginPath                = "/login"
	ssoSuccessQuery          = "sso=success"
	ssoErrorUserNotFound     = "user_not_found"
	ssoErrorInvalidState     = "invalid_state"
	ssoErrorProvider         = "provider_error"
	ssoErrorNotConfigured    = "sso_not_configured"
)

// StartMicrosoftOAuth redirects the browser to Entra ID when SSO is enabled.
func (h *WindowsHandler) StartMicrosoftOAuth(c *gin.Context) {
	settings, err := loadActiveEntraSettings()
	if err != nil {
		if errors.Is(err, errEntraSSODisabled) {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "microsoft SSO is disabled"})
			return
		}
		log.Printf("[oauth-microsoft] load settings failed: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "failed to load SSO settings"})
		return
	}

	state, err := auth.IssueOAuthState(c)
	if err != nil {
		log.Printf("[oauth-microsoft] issue state failed: %v", err)
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "failed to start microsoft sign-in"})
		return
	}

	redirectURI := auth.MicrosoftRedirectURI(c)
	authorizeURL := auth.BuildMicrosoftAuthorizeURL(
		settings.TenantID,
		settings.ClientID,
		redirectURI,
		state,
	)

	c.Redirect(http.StatusFound, authorizeURL)
}

// MicrosoftOAuthCallback completes the Entra authorization code flow.
func (h *WindowsHandler) MicrosoftOAuthCallback(c *gin.Context) {
	if oauthError := strings.TrimSpace(c.Query("error")); oauthError != "" {
		log.Printf("[oauth-microsoft] provider error: %s %s", oauthError, c.Query("error_description"))
		redirectLoginError(c, ssoErrorProvider)
		return
	}

	state := c.Query("state")
	if !auth.ValidateOAuthState(c, state) {
		redirectLoginError(c, ssoErrorInvalidState)
		return
	}

	code := strings.TrimSpace(c.Query("code"))
	if code == "" {
		redirectLoginError(c, ssoErrorProvider)
		return
	}

	settings, err := loadActiveEntraSettings()
	if err != nil {
		if errors.Is(err, errEntraSSODisabled) {
			redirectLoginError(c, ssoErrorNotConfigured)
			return
		}
		log.Printf("[oauth-microsoft] load settings failed: %v", err)
		redirectLoginError(c, ssoErrorProvider)
		return
	}

	redirectURI := auth.MicrosoftRedirectURI(c)
	tokenResponse, err := auth.ExchangeMicrosoftAuthorizationCode(
		nil,
		settings.TenantID,
		settings.ClientID,
		settings.ClientSecret,
		redirectURI,
		code,
	)
	if err != nil {
		log.Printf("[oauth-microsoft] token exchange failed: %v", err)
		redirectLoginError(c, ssoErrorProvider)
		return
	}

	email, err := auth.FetchMicrosoftProfileEmail(nil, tokenResponse.AccessToken)
	if err != nil {
		log.Printf("[oauth-microsoft] profile lookup failed: %v", err)
		redirectLoginError(c, ssoErrorProvider)
		return
	}

	user, err := findConsoleUserByEmailOrLogin(email)
	if err != nil {
		if errors.Is(err, errConsoleUserNotFound) {
			redirectLoginError(c, ssoErrorUserNotFound)
			return
		}
		log.Printf("[oauth-microsoft] user lookup failed: %v", err)
		redirectLoginError(c, ssoErrorProvider)
		return
	}

	authToken, err := ensureConsoleAuthToken(&user)
	if err != nil {
		log.Printf("[oauth-microsoft] auth token ensure failed: %v", err)
		redirectLoginError(c, ssoErrorProvider)
		return
	}

	jwtSecret := strings.TrimSpace(h.jwtSecret)
	if jwtSecret == "" {
		jwtSecret = strings.TrimSpace(os.Getenv("JWT_SECRET"))
	}
	if jwtSecret == "" {
		log.Printf("[oauth-microsoft] JWT_SECRET is not configured")
		redirectLoginError(c, ssoErrorProvider)
		return
	}

	token, err := auth.MintConsoleJWT(jwtSecret, user.Login, authToken, false)
	if err != nil {
		log.Printf("[oauth-microsoft] mint jwt failed: %v", err)
		redirectLoginError(c, ssoErrorProvider)
		return
	}

	auth.SetSSOJWTCookie(c, token)
	c.Redirect(http.StatusFound, loginPath+"?"+ssoSuccessQuery)
}

var (
	errEntraSSODisabled   = errors.New("entra sso is disabled")
	errConsoleUserNotFound = errors.New("console user not found")
)

func loadActiveEntraSettings() (*models.SSOSettings, error) {
	settings, err := getOrCreateSSOSettings()
	if err != nil {
		return nil, err
	}
	if !isEntraSsoConfigured(settings) {
		return nil, errEntraSSODisabled
	}
	return settings, nil
}

func findConsoleUserByEmailOrLogin(identifier string) (models.User, error) {
	var user models.User
	identifier = strings.TrimSpace(identifier)
	if identifier == "" {
		return user, errConsoleUserNotFound
	}

	err := db.DB.Where("LOWER(email) = LOWER(?)", identifier).First(&user).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		err = db.DB.Where("LOWER(login) = LOWER(?)", identifier).First(&user).Error
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return user, errConsoleUserNotFound
	}
	if err != nil {
		return user, fmt.Errorf("lookup console user: %w", err)
	}
	if user.UserRoleID == nil {
		return user, fmt.Errorf("console user %q has no role assigned", user.Login)
	}

	return user, nil
}

func ensureConsoleAuthToken(user *models.User) (string, error) {
	if user == nil {
		return "", fmt.Errorf("user is nil")
	}

	current := ""
	if user.AuthToken != nil {
		current = strings.TrimSpace(*user.AuthToken)
	}
	if current != "" {
		return current, nil
	}

	generated, err := auth.GenerateAuthToken()
	if err != nil {
		return "", err
	}

	if err := db.DB.Model(&models.User{}).
		Where("id = ?", user.ID).
		Update("authtoken", generated).Error; err != nil {
		return "", fmt.Errorf("persist auth token: %w", err)
	}

	user.AuthToken = &generated
	return generated, nil
}

func redirectLoginError(c *gin.Context, code string) {
	target := loginPath + "?" + url.Values{"error": {code}}.Encode()
	c.Redirect(http.StatusFound, target)
}

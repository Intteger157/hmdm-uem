package auth

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	microsoftAuthorizeURLTemplate = "https://login.microsoftonline.com/%s/oauth2/v2.0/authorize"
	microsoftTokenURLTemplate     = "https://login.microsoftonline.com/%s/oauth2/v2.0/token"
	microsoftGraphMeURL           = "https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName"
)

type microsoftTokenResponse struct {
	AccessToken string `json:"access_token"`
	IDToken     string `json:"id_token"`
	TokenType   string `json:"token_type"`
	ExpiresIn   int    `json:"expires_in"`
}

type microsoftGraphProfile struct {
	Mail              string `json:"mail"`
	UserPrincipalName string `json:"userPrincipalName"`
}

// BuildMicrosoftAuthorizeURL constructs the Entra authorize redirect URL.
func BuildMicrosoftAuthorizeURL(tenantID, clientID, redirectURI, state string) string {
	query := url.Values{}
	query.Set("client_id", clientID)
	query.Set("response_type", "code")
	query.Set("redirect_uri", redirectURI)
	query.Set("response_mode", "query")
	query.Set("scope", "openid profile email")
	query.Set("state", state)

	endpoint := fmt.Sprintf(microsoftAuthorizeURLTemplate, url.PathEscape(strings.TrimSpace(tenantID)))
	return endpoint + "?" + query.Encode()
}

// ExchangeMicrosoftAuthorizationCode trades the OAuth code for tokens.
func ExchangeMicrosoftAuthorizationCode(
	client *http.Client,
	tenantID, clientID, clientSecret, redirectURI, code string,
) (*microsoftTokenResponse, error) {
	if client == nil {
		client = &http.Client{Timeout: 15 * time.Second}
	}

	form := url.Values{}
	form.Set("client_id", clientID)
	form.Set("client_secret", clientSecret)
	form.Set("grant_type", "authorization_code")
	form.Set("code", code)
	form.Set("redirect_uri", redirectURI)

	endpoint := fmt.Sprintf(microsoftTokenURLTemplate, url.PathEscape(strings.TrimSpace(tenantID)))
	request, err := http.NewRequest(http.MethodPost, endpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, fmt.Errorf("build token request: %w", err)
	}
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	response, err := client.Do(request)
	if err != nil {
		return nil, fmt.Errorf("exchange authorization code: %w", err)
	}
	defer response.Body.Close()

	body, err := io.ReadAll(io.LimitReader(response.Body, 1<<20))
	if err != nil {
		return nil, fmt.Errorf("read token response: %w", err)
	}

	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("token endpoint returned %d: %s", response.StatusCode, strings.TrimSpace(string(body)))
	}

	var payload microsoftTokenResponse
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("decode token response: %w", err)
	}
	if strings.TrimSpace(payload.AccessToken) == "" {
		return nil, fmt.Errorf("token response missing access_token")
	}

	return &payload, nil
}

// FetchMicrosoftProfileEmail resolves the signed-in user's email via Microsoft Graph.
func FetchMicrosoftProfileEmail(client *http.Client, accessToken string) (string, error) {
	if client == nil {
		client = &http.Client{Timeout: 15 * time.Second}
	}

	request, err := http.NewRequest(http.MethodGet, microsoftGraphMeURL, nil)
	if err != nil {
		return "", fmt.Errorf("build graph request: %w", err)
	}
	request.Header.Set("Authorization", "Bearer "+accessToken)

	response, err := client.Do(request)
	if err != nil {
		return "", fmt.Errorf("fetch microsoft profile: %w", err)
	}
	defer response.Body.Close()

	body, err := io.ReadAll(io.LimitReader(response.Body, 1<<20))
	if err != nil {
		return "", fmt.Errorf("read graph response: %w", err)
	}

	if response.StatusCode != http.StatusOK {
		return "", fmt.Errorf("graph returned %d: %s", response.StatusCode, strings.TrimSpace(string(body)))
	}

	var profile microsoftGraphProfile
	if err := json.Unmarshal(body, &profile); err != nil {
		return "", fmt.Errorf("decode graph response: %w", err)
	}

	email := strings.TrimSpace(profile.Mail)
	if email == "" {
		email = strings.TrimSpace(profile.UserPrincipalName)
	}
	if email == "" {
		return "", fmt.Errorf("microsoft profile did not include an email address")
	}

	return email, nil
}

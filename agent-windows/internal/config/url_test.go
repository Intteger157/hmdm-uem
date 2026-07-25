package config

import "testing"

func TestNormalizeServerURLFixesCyrillicTypo(t *testing.T) {
	got := normalizeServerURL("httpы://test-dev-mdm.intteger.uk")
	want := "https://test-dev-mdm.intteger.uk"
	if got != want {
		t.Fatalf("normalizeServerURL() = %q, want %q", got, want)
	}
}

func TestNormalizeServerURLUpgradesHTTP(t *testing.T) {
	got := normalizeServerURL("http://mdm.example.com")
	want := "https://mdm.example.com"
	if got != want {
		t.Fatalf("normalizeServerURL() = %q, want %q", got, want)
	}
}

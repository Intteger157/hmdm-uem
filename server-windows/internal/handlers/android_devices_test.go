package handlers

import (
	"testing"
)

func TestBuildAndroidDeviceListResponseIncludesQrCodeKey(t *testing.T) {
	configID := uint(7)
	configName := "Default config"
	qrCodeKey := "abc123qr"
	description := "realme"

	rows := []androidDeviceSearchRow{
		{
			ID:              1,
			Number:          "realme",
			Description:     &description,
			ConfigurationID: &configID,
			ConfigName:      &configName,
			ConfigQrCodeKey: &qrCodeKey,
		},
	}

	response := buildAndroidDeviceListResponse(rows)

	config, ok := response.Configurations["7"]
	if !ok {
		t.Fatal("configuration 7 missing from response")
	}
	if config.QrCodeKey != qrCodeKey {
		t.Fatalf("QrCodeKey = %q, want %q", config.QrCodeKey, qrCodeKey)
	}
}

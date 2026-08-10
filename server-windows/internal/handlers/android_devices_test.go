package handlers

import (
	"encoding/json"
	"testing"
)

func TestBuildAndroidDeviceListResponseIncludesQrCodeKey(t *testing.T) {
	configID := uint(7)
	configName := "Default config"
	qrCodeKey := "abc123qr"
	description := "realme"
	infoJSON := []byte(`{"model":"A35","permissions":[1,1,1]}`)

	rows := []androidDeviceSearchRow{
		{
			ID:              1,
			Number:          "realme",
			Description:     &description,
			ConfigurationID: &configID,
			ConfigName:      &configName,
			ConfigQrCodeKey: &qrCodeKey,
			InfoJSON:        infoJSON,
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

	if len(response.Devices.Items) != 1 {
		t.Fatalf("items = %d, want 1", len(response.Devices.Items))
	}

	var info map[string]any
	if err := json.Unmarshal(response.Devices.Items[0].Info, &info); err != nil {
		t.Fatalf("unmarshal device info: %v", err)
	}
	permissions, ok := info["permissions"].([]any)
	if !ok || len(permissions) != 3 {
		t.Fatalf("permissions missing from device info: %#v", info["permissions"])
	}
}

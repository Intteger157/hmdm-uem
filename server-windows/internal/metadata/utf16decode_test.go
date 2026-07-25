package metadata

import (
	"testing"
	"unicode/utf16"
)

func TestDecodeUTF16LEBytesTelegramProductName(t *testing.T) {
	t.Parallel()

	raw := utf16LEBytes(utf16.Encode([]rune("Telegram Desktop")))
	got := decodeUTF16LEBytes(raw)
	if got != "Telegram Desktop" {
		t.Fatalf("decodeUTF16LEBytes() = %q, want Telegram Desktop", got)
	}
}

func TestSanitizeMetadataStringTrimsNullTerminator(t *testing.T) {
	t.Parallel()

	got := sanitizeMetadataString("Telegram\x00\x00")
	if got != "Telegram" {
		t.Fatalf("sanitizeMetadataString() = %q, want Telegram", got)
	}
}

func TestReadUTF16ValueAfterKey(t *testing.T) {
	t.Parallel()

	key := utf16LEBytes(utf16.Encode([]rune("ProductName")))
	value := utf16LEBytes(utf16.Encode([]rune("Telegram Desktop")))
	data := append(append(key, 0, 0), value...)
	data = append(data, 0, 0)

	got := readUTF16ValueAfterKey(data, len(key))
	if got != "Telegram Desktop" {
		t.Fatalf("readUTF16ValueAfterKey() = %q, want Telegram Desktop", got)
	}
}

func TestScanStringPropertyReadsUTF16Value(t *testing.T) {
	t.Parallel()

	key := utf16LEBytes(utf16.Encode([]rune("ProductName")))
	value := utf16LEBytes(utf16.Encode([]rune("Telegram Desktop")))
	data := append(append(key, 0, 0), value...)
	data = append(data, 0, 0)

	got := scanStringProperty(data, "ProductName")
	if got != "Telegram Desktop" {
		t.Fatalf("scanStringProperty() = %q, want Telegram Desktop", got)
	}
}

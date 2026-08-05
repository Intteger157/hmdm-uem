package auth

import "testing"

func TestHashPasswordFromMD5MatchesJavaAdminDefault(t *testing.T) {
	// Java default admin password "admin" -> MD5 -> SHA1+salt
	const adminMD5 = "21232F297A57A5A743894A0E4A801FC3"
	got := HashPasswordFromMD5(adminMD5)
	const want = "349242D38ED8667B5C11D2412EBEA4636BD3CA3A"
	if got != want {
		t.Fatalf("HashPasswordFromMD5() = %q, want %q", got, want)
	}
}

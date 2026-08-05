package auth

import (
	"crypto/sha1"
	"encoding/hex"
	"strings"
)

const consolePasswordSalt = "5YdSYHyg2U"

// HashPasswordFromMD5 matches Java PasswordUtil.getHashFromMd5 for console users.
func HashPasswordFromMD5(md5Upper string) string {
	md5Upper = strings.TrimSpace(md5Upper)
	sum := sha1.Sum([]byte(md5Upper + consolePasswordSalt))
	return strings.ToUpper(hex.EncodeToString(sum[:]))
}

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const LOWER = 'abcdefghijklmnopqrstuvwxyz'
const DIGITS = '0123456789'
const ALPHABET = UPPER + LOWER + DIGITS

const DEFAULT_ENROLLMENT_SECRET_LENGTH = 16

function randomInt(max: number): number {
  if (max <= 0) {
    return 0
  }

  const buffer = new Uint32Array(1)
  crypto.getRandomValues(buffer)
  return buffer[0] % max
}

function shuffleChars(chars: string[]): void {
  for (let index = chars.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1)
    ;[chars[index], chars[swapIndex]] = [chars[swapIndex], chars[index]]
  }
}

/** Generates a random enrollment secret using letters and digits (no symbols). */
export function generateEnrollmentSecret(length = DEFAULT_ENROLLMENT_SECRET_LENGTH): string {
  if (length < 3) {
    throw new Error('enrollment secret length must be at least 3')
  }

  const chars = [
    UPPER[randomInt(UPPER.length)],
    LOWER[randomInt(LOWER.length)],
    DIGITS[randomInt(DIGITS.length)],
  ]

  for (let index = chars.length; index < length; index += 1) {
    chars.push(ALPHABET[randomInt(ALPHABET.length)])
  }

  shuffleChars(chars)
  return chars.join('')
}

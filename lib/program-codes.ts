import { randomBytes } from "crypto"

const ALPHANUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
const DEFAULT_LENGTH = 8

/**
 * Generate a short alphanumeric code (e.g. for teamIdCode, playerCode, parentCode).
 * Default 8 characters, URL-safe and unique enough for retry loops.
 */
export function generateProgramCode(length: number = DEFAULT_LENGTH): string {
  const bytes = randomBytes(length)
  let result = ""
  for (let i = 0; i < length; i++) {
    result += ALPHANUM[bytes[i]! % ALPHANUM.length]
  }
  return result
}

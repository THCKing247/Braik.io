/**
 * Normalize phone to E.164-style for Twilio/SMS.
 * US/Canada: 10 or 11 digits -> +1XXXXXXXXXX.
 * Other: preserve leading + and digits when present.
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.length === 0) return ""

  const trimmed = phone.trim()
  const hadPlus = trimmed.startsWith("+")

  // US/Canada: 10 digits -> +1, 11 digits starting with 1 -> +1
  if (digits.length === 10 && /^[2-9]/.test(digits)) {
    return `+1${digits}`
  }
  if (digits.length === 11 && digits.startsWith("1") && /^1[2-9]/.test(digits)) {
    return `+${digits}`
  }

  if (hadPlus) return `+${digits}`
  return digits
}

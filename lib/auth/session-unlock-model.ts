/**
 * Conceptual model for client session entry (password, cookies, future biometric).
 * Use these types in native shells — no runtime logic here.
 */

/** How the user most recently established (or re-established) an app session on this device. */
export type SessionEstablishmentMode =
  | "password"
  | "remembered_http_cookies"
  | "native_biometric_unlock"
  | "unknown"

/** Future: gate shown before trusting httpOnly session on a cold native launch. */
export type SessionUnlockUiPhase =
  | "checking_session"
  | "biometric_prompt"
  | "password_fallback"
  | "ready"

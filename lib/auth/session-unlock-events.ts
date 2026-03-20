/**
 * Dispatched after native biometric (or other shell) unlock restores a session
 * so the web layer can refetch `/api/auth/session`.
 */
export const NATIVE_SESSION_UNLOCK_EVENT = "braik:native-session-unlocked"

export function dispatchNativeSessionUnlocked(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(NATIVE_SESSION_UNLOCK_EVENT))
}

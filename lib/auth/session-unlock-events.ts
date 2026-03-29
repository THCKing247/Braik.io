/**
 * Dispatched after native biometric (or other shell) unlock restores a session
 * so the web layer can refetch the client session query (`supabase.auth.getSession()` merge).
 */
export const NATIVE_SESSION_UNLOCK_EVENT = "braik:native-session-unlocked"

export function dispatchNativeSessionUnlocked(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(NATIVE_SESSION_UNLOCK_EVENT))
}

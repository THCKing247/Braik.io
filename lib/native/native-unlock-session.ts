/**
 * Per–app-launch flag: user passed biometric (or chose password path) this cold start.
 * sessionStorage clears on Android process death — aligns with “next app open” biometric.
 */

const KEY = "braik_bio_unlocked_launch"

export function markNativeBiometricUnlockedThisLaunch(): void {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(KEY, "1")
  } catch {
    /* ignore */
  }
}

export function hasNativeBiometricUnlockedThisLaunch(): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.sessionStorage.getItem(KEY) === "1"
  } catch {
    return false
  }
}

export function clearNativeBiometricUnlockLaunchFlag(): void {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

/**
 * Extension points for Capacitor / native app shells.
 *
 * - Password login + httpOnly cookies remain the source of truth on web.
 * - Biometric unlock is a **convenience gate** to release locally secured session
 *   material on native (e.g. tokens in Keychain) — not a replacement for Supabase auth.
 *
 * Register handlers once at native startup via `registerNativeBiometricBridge`.
 * On web, all checks return false / prompts no-op until handlers are registered.
 */

import { dispatchNativeSessionUnlocked } from "@/lib/auth/session-unlock-events"

export type BiometricPromptReason = "app_launch" | "resume" | "settings_test"

export type BiometricUnlockResult =
  | { ok: true }
  | { ok: false; cancelled?: boolean; error?: string; fallbackToPassword: true }

export type NativeBiometricBridge = {
  /** Hardware + OS support (e.g. Face ID / fingerprint available). */
  isBiometricHardwareAvailable: () => Promise<boolean>
  /** User has enrolled biometrics on device. */
  isBiometricEnrolled: () => Promise<boolean>
  /**
   * Show system biometric prompt; on success native code should restore session
   * (e.g. inject cookies / call Supabase restore) then call `notifyNativeSessionUnlocked()`.
   */
  promptBiometricUnlock: (reason: BiometricPromptReason) => Promise<BiometricUnlockResult>
}

let bridge: NativeBiometricBridge | null = null

export function registerNativeBiometricBridge(next: NativeBiometricBridge | null): void {
  bridge = next
}

export function isNativeBiometricBridgeRegistered(): boolean {
  return bridge != null
}

export async function getBiometricHardwareAvailable(): Promise<boolean> {
  if (!bridge) return false
  try {
    return await bridge.isBiometricHardwareAvailable()
  } catch {
    return false
  }
}

export async function getBiometricEnrolled(): Promise<boolean> {
  if (!bridge) return false
  try {
    return await bridge.isBiometricEnrolled()
  } catch {
    return false
  }
}

export async function promptBiometricUnlock(
  reason: BiometricPromptReason
): Promise<BiometricUnlockResult> {
  if (!bridge) {
    return { ok: false, error: "not_supported", fallbackToPassword: true }
  }
  return bridge.promptBiometricUnlock(reason)
}

/** Call from native after biometric success and cookies/session are restored. */
export function notifyNativeSessionUnlocked(): void {
  dispatchNativeSessionUnlocked()
}

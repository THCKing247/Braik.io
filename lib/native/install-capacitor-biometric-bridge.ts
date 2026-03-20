import { registerNativeBiometricBridge } from "@/lib/auth/native-biometric-bridge"
import type { BiometricPromptReason, BiometricUnlockResult } from "@/lib/auth/native-biometric-bridge"

/**
 * Wires `@aparajita/capacitor-biometric-auth` into `native-biometric-bridge`.
 * Call once from the client after Capacitor is available.
 */
export async function installCapacitorBiometricBridge(): Promise<void> {
  if (typeof window === "undefined") return

  const { Capacitor } = await import("@capacitor/core")
  if (!Capacitor.isNativePlatform()) return

  const { BiometricAuth, BiometryType, BiometryError, BiometryErrorType } = await import(
    "@aparajita/capacitor-biometric-auth"
  )

  registerNativeBiometricBridge({
    async isBiometricHardwareAvailable() {
      const r = await BiometricAuth.checkBiometry()
      return r.biometryType !== BiometryType.none || r.biometryTypes.length > 0
    },

    async isBiometricEnrolled() {
      const r = await BiometricAuth.checkBiometry()
      return r.isAvailable
    },

    async promptBiometricUnlock(reason: BiometricPromptReason): Promise<BiometricUnlockResult> {
      const reasonText =
        reason === "app_launch"
          ? "Unlock Braik"
          : reason === "settings_test"
            ? "Verify it’s you"
            : "Unlock Braik"

      try {
        await BiometricAuth.authenticate({
          reason: reasonText,
          cancelTitle: "Use password",
          allowDeviceCredential: false,
        })
        return { ok: true }
      } catch (e) {
        if (e instanceof BiometryError) {
          if (
            e.code === BiometryErrorType.userCancel ||
            e.code === BiometryErrorType.systemCancel ||
            e.code === BiometryErrorType.appCancel
          ) {
            return { ok: false, cancelled: true, fallbackToPassword: true }
          }
        }
        const message = e instanceof Error ? e.message : "biometric_failed"
        return { ok: false, error: message, fallbackToPassword: true }
      }
    },
  })
}

"use client"

import { Fingerprint } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { useNativeSessionUnlock } from "@/lib/hooks/use-native-session-unlock"
import { promptBiometricUnlock } from "@/lib/auth/native-biometric-bridge"

/**
 * Shown in the native app or when `NEXT_PUBLIC_BRAIK_SHOW_BIOMETRIC_SETTINGS=1`.
 * Preference uses Capacitor Preferences on device (localStorage fallback on web).
 */
export function BiometricUnlockSettingsCard() {
  const {
    nativeBridgeActive,
    biometricEligible,
    biometricUnlockPreferred,
    setBiometricUnlockPreferred,
    refreshCapabilities,
  } = useNativeSessionUnlock()

  return (
    <Card className="border border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 uppercase text-xs font-bold tracking-wide text-muted-foreground">
          <Fingerprint className="h-4 w-4" aria-hidden />
          App unlock (biometric)
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          When using the Braik mobile app, you can unlock with Face ID or fingerprint instead of typing your
          password every launch. Password sign-in always remains available.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!nativeBridgeActive && (
          <p className="text-sm text-muted-foreground">
            Biometric unlock appears here in the native app when your device supports it. On the web, sessions
            stay signed in using secure cookies when you choose &quot;Keep me signed in&quot;.
          </p>
        )}

        {nativeBridgeActive && !biometricEligible && (
          <p className="text-sm text-muted-foreground">
            Set up Face ID or fingerprint on this device to enable quick unlock for Braik.
          </p>
        )}

        {nativeBridgeActive && biometricEligible && (
          <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
            <Checkbox
              id="braik-biometric-opt-in"
              checked={biometricUnlockPreferred}
              onCheckedChange={(c) => void setBiometricUnlockPreferred(Boolean(c))}
              className="mt-0.5"
            />
            <div className="space-y-1">
              <Label htmlFor="braik-biometric-opt-in" className="cursor-pointer text-sm font-medium leading-snug">
                Use Face ID / fingerprint to open Braik
              </Label>
              <p className="text-xs text-muted-foreground">
                You&apos;ll still use your password if biometrics fail or you sign out.
              </p>
            </div>
          </div>
        )}

        {nativeBridgeActive && biometricEligible && biometricUnlockPreferred && (
          <button
            type="button"
            onClick={async () => {
              await promptBiometricUnlock("settings_test")
              await refreshCapabilities()
            }}
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Test biometric prompt
          </button>
        )}
      </CardContent>
    </Card>
  )
}

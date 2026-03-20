"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getBiometricEnrolled, getBiometricHardwareAvailable } from "@/lib/auth/native-biometric-bridge"
import { isNativeAppSync } from "@/lib/native/app-environment"
import {
  getBiometricPostLoginPromptDone,
  getNativeBiometricUnlockEnabled,
  setBiometricPostLoginPromptDone,
  setNativeBiometricUnlockEnabled,
} from "@/lib/native/native-biometric-prefs"

/**
 * One-time offer after password sign-in (Capacitor only): enable biometric quick unlock.
 */
export function BiometricEnablePrompt() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    void (async () => {
      if (!isNativeAppSync()) return
      if (await getBiometricPostLoginPromptDone()) return
      if (await getNativeBiometricUnlockEnabled()) {
        await setBiometricPostLoginPromptDone(true)
        return
      }
      const hw = await getBiometricHardwareAvailable()
      const en = await getBiometricEnrolled()
      if (!hw || !en) {
        await setBiometricPostLoginPromptDone(true)
        return
      }
      setOpen(true)
    })()
  }, [])

  const dismiss = async () => {
    await setBiometricPostLoginPromptDone(true)
    setOpen(false)
  }

  const enable = async () => {
    await setNativeBiometricUnlockEnabled(true)
    await setBiometricPostLoginPromptDone(true)
    setOpen(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) void dismiss()
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-athletic uppercase tracking-tight">
            Use fingerprint next time?
          </DialogTitle>
          <DialogDescription>
            Unlock Braik with your fingerprint or face when you open the app. You can always sign in with your
            password if biometrics fail.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col gap-2 sm:flex-col">
          <Button type="button" className="w-full" onClick={() => void enable()}>
            Enable quick unlock
          </Button>
          <Button type="button" variant="outline" className="w-full" onClick={() => void dismiss()}>
            Not now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

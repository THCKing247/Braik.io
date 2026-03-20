"use client"

import { useCallback, useEffect, useState } from "react"
import {
  getBiometricEnrolled,
  getBiometricHardwareAvailable,
  isNativeBiometricBridgeRegistered,
} from "@/lib/auth/native-biometric-bridge"
import {
  getNativeBiometricUnlockEnabled,
  setNativeBiometricUnlockEnabled,
} from "@/lib/native/native-biometric-prefs"

/**
 * Biometric quick-unlock state for Capacitor (bridge registered) and settings UI.
 */
export function useNativeSessionUnlock() {
  const [nativeBridgeActive, setNativeBridgeActive] = useState(false)
  const [hardwareAvailable, setHardwareAvailable] = useState(false)
  const [enrolled, setEnrolled] = useState(false)
  const [preference, setPreference] = useState(false)

  const refreshCapabilities = useCallback(async () => {
    setNativeBridgeActive(isNativeBiometricBridgeRegistered())
    const pref = await getNativeBiometricUnlockEnabled()
    setPreference(pref)
    const [hw, en] = await Promise.all([getBiometricHardwareAvailable(), getBiometricEnrolled()])
    setHardwareAvailable(hw)
    setEnrolled(en)
  }, [])

  useEffect(() => {
    void refreshCapabilities()
  }, [refreshCapabilities])

  const setBiometricUnlockPreferred = useCallback(
    async (enabled: boolean) => {
      await setNativeBiometricUnlockEnabled(enabled)
      setPreference(enabled)
    },
    []
  )

  return {
    /** True in Capacitor after `installCapacitorBiometricBridge` runs. */
    nativeBridgeActive,
    biometricHardwareAvailable: hardwareAvailable,
    biometricEnrolled: enrolled,
    biometricUnlockPreferred: preference,
    setBiometricUnlockPreferred,
    biometricEligible: nativeBridgeActive && hardwareAvailable && enrolled,
    refreshCapabilities,
  }
}

"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useSession } from "@/lib/auth/client-auth"
import { getResumeOrDefaultAppPath } from "@/lib/navigation/last-visited-route"
import { installCapacitorBiometricBridge } from "@/lib/native/install-capacitor-biometric-bridge"
import { getNativeBiometricUnlockEnabled } from "@/lib/native/native-biometric-prefs"
import {
  isNativeMarketingSurface,
  nativeRouteRequiresAppUnlock,
} from "@/lib/native/native-capacitor-routes"
import { hasNativeBiometricUnlockedThisLaunch } from "@/lib/native/native-unlock-session"

/**
 * Capacitor-only: sets `window.__BRAIK_IS_NATIVE_APP__`, steers away from marketing,
 * installs biometric bridge, shows splash on marketing, and **blocks all non-public routes**
 * until app unlock (biometric or password fallback on `/native-unlock`) when biometric is enabled.
 */
export function NativeAppBootstrap() {
  const pathname = usePathname() ?? ""
  const router = useRouter()
  const { status, data } = useSession()
  const routingRef = useRef(false)
  const [blockProtectedUntilUnlock, setBlockProtectedUntilUnlock] = useState(false)

  let isNative = false
  if (typeof window !== "undefined") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
      const { Capacitor } = require("@capacitor/core") as typeof import("@capacitor/core")
      isNative = Capacitor.isNativePlatform()
      window.__BRAIK_IS_NATIVE_APP__ = isNative
    } catch {
      window.__BRAIK_IS_NATIVE_APP__ = false
      isNative = false
    }
  }

  useEffect(() => {
    if (!isNative) return
    void installCapacitorBiometricBridge()
  }, [isNative])

  useEffect(() => {
    if (!isNative) return
    if (routingRef.current) return
    if (status === "loading") return
    if (!isNativeMarketingSurface(pathname)) return

    routingRef.current = true
    const go = async () => {
      try {
        if (status === "unauthenticated") {
          router.replace("/login")
          return
        }

        const bio = await getNativeBiometricUnlockEnabled()
        if (bio && !hasNativeBiometricUnlockedThisLaunch()) {
          router.replace("/native-unlock")
          return
        }

        router.replace(getResumeOrDefaultAppPath(data?.user?.role, data?.user?.defaultAppPath))
      } finally {
        routingRef.current = false
      }
    }
    void go()
  }, [isNative, pathname, status, data, router])

  /** Any protected (non-public) route: force unlock first when biometric gate is on. */
  useEffect(() => {
    if (!isNative) return
    if (status !== "authenticated") return
    if (!nativeRouteRequiresAppUnlock(pathname)) return

    void (async () => {
      const bio = await getNativeBiometricUnlockEnabled()
      if (!bio || hasNativeBiometricUnlockedThisLaunch()) return
      router.replace("/native-unlock")
    })()
  }, [isNative, pathname, status, router])

  /** Opaque overlay so dashboard (or any protected page) never flashes before redirect. */
  useEffect(() => {
    if (!isNative) {
      setBlockProtectedUntilUnlock(false)
      return
    }
    if (status !== "authenticated") {
      setBlockProtectedUntilUnlock(false)
      return
    }
    if (!nativeRouteRequiresAppUnlock(pathname)) {
      setBlockProtectedUntilUnlock(false)
      return
    }

    let cancelled = false
    void (async () => {
      const bio = await getNativeBiometricUnlockEnabled()
      if (cancelled) return
      setBlockProtectedUntilUnlock(Boolean(bio && !hasNativeBiometricUnlockedThisLaunch()))
    })()

    return () => {
      cancelled = true
    }
  }, [isNative, pathname, status])

  if (!isNative) return null

  if (blockProtectedUntilUnlock) {
    return (
      <div
        className="fixed inset-0 z-[450] flex flex-col items-center justify-center bg-[#0B1220] px-6"
        style={{
          paddingTop: "max(2rem, env(safe-area-inset-top))",
          paddingBottom: "max(2rem, env(safe-area-inset-bottom))",
        }}
        role="presentation"
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background:
              "radial-gradient(ellipse 120% 80% at 50% -20%, rgba(59,130,246,0.22), transparent 55%), radial-gradient(ellipse 90% 60% at 100% 100%, rgba(15,23,42,0.9), #0B1220)",
          }}
          aria-hidden
        />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="flex h-12 w-[168px] items-center justify-center">
            <img
              src="/braik-logo.png"
              alt="Braik"
              className="h-auto w-full max-h-11 object-contain brightness-0 invert"
            />
          </div>
          <div className="h-10 w-10 animate-pulse rounded-full bg-white/15" aria-hidden />
          <p className="text-sm font-medium text-slate-400">Unlock required…</p>
        </div>
      </div>
    )
  }

  if (!isNativeMarketingSurface(pathname)) return null

  return (
    <div
      className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-[#0B1220] px-6"
      style={{
        paddingTop: "max(2rem, env(safe-area-inset-top))",
        paddingBottom: "max(2rem, env(safe-area-inset-bottom))",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            "radial-gradient(ellipse 120% 80% at 50% -20%, rgba(59,130,246,0.22), transparent 55%), radial-gradient(ellipse 90% 60% at 100% 100%, rgba(15,23,42,0.9), #0B1220)",
        }}
        aria-hidden
      />
      <div className="relative z-10 flex flex-col items-center gap-4">
        <div className="flex h-12 w-[168px] items-center justify-center">
          <img
            src="/braik-logo.png"
            alt="Braik"
            className="h-auto w-full max-h-11 object-contain brightness-0 invert"
          />
        </div>
        <div className="h-10 w-10 animate-pulse rounded-full bg-white/15" aria-hidden />
        <p className="text-sm font-medium text-slate-400">Starting Braik…</p>
      </div>
    </div>
  )
}

"use client"

import { useEffect, useRef } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useSession } from "@/lib/auth/client-auth"
import { getResumeOrDefaultAppPath } from "@/lib/navigation/last-visited-route"
import { installCapacitorBiometricBridge } from "@/lib/native/install-capacitor-biometric-bridge"
import { getNativeBiometricUnlockEnabled } from "@/lib/native/native-biometric-prefs"
import { hasNativeBiometricUnlockedThisLaunch } from "@/lib/native/native-unlock-session"

const MARKETING_EXACT = new Set([
  "/",
  "/features",
  "/pricing",
  "/about",
  "/why-braik",
  "/faq",
  "/terms",
  "/privacy",
  "/acceptable-use",
  "/ai-transparency",
])

function isNativeMarketingSurface(pathname: string): boolean {
  if (pathname.startsWith("/recruiting")) return false
  if (MARKETING_EXACT.has(pathname)) return true
  if (pathname.startsWith("/features/") || pathname.startsWith("/pricing/")) return true
  return false
}

function isAppShellPath(pathname: string): boolean {
  if (pathname.startsWith("/dashboard")) return true
  if (pathname.startsWith("/admin")) return true
  if (pathname.startsWith("/onboarding")) return true
  if (pathname.startsWith("/join")) return true
  if (pathname.startsWith("/signup")) return true
  if (pathname.startsWith("/invite")) return true
  return false
}

/**
 * Capacitor-only: sets `window.__BRAIK_IS_NATIVE_APP__`, steers away from marketing,
 * installs biometric bridge, and shows a splash over marketing until routing settles.
 */
export function NativeAppBootstrap() {
  const pathname = usePathname() ?? ""
  const router = useRouter()
  const { status, data } = useSession()
  const routingRef = useRef(false)

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

        router.replace(getResumeOrDefaultAppPath(data?.user?.role))
      } finally {
        routingRef.current = false
      }
    }
    void go()
  }, [isNative, pathname, status, data, router])

  useEffect(() => {
    if (!isNative) return
    if (status !== "authenticated") return
    if (pathname === "/native-unlock" || pathname === "/login") return
    if (!isAppShellPath(pathname)) return

    void (async () => {
      const bio = await getNativeBiometricUnlockEnabled()
      if (!bio || hasNativeBiometricUnlockedThisLaunch()) return
      router.replace("/native-unlock")
    })()
  }, [isNative, pathname, status, router])

  if (!isNative) return null

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

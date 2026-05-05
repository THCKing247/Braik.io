"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { SiteHeader } from "@/components/marketing/site-header"
import { SiteFooter } from "@/components/marketing/site-footer"
import { HeroLoginForm } from "@/components/marketing/hero-login-form"
import { useSession } from "@/lib/auth/client-auth"
import {
  MobileAppEntryLoading,
  MobileAppLoginScreen,
} from "@/components/auth/mobile-app-login-screen"
import { isNativeAppSync } from "@/lib/native/app-environment"
import { useMinWidthLg } from "@/lib/hooks/use-min-width-lg"
import { getDefaultAppPathForRole } from "@/lib/auth/default-app-path-for-role"

/** Same rules as `HeroLoginForm` — safe in-app paths only. */
function normalizeCallbackUrl(value: string | null): string | undefined {
  if (!value || !value.startsWith("/")) {
    return undefined
  }
  if (value.startsWith("//")) {
    return undefined
  }
  if (value === "/admin/login") {
    return "/admin/overview"
  }
  return value
}

export default function LoginPage() {
  const router = useRouter()
  const { data, status } = useSession()
  const searchParams = useSearchParams()
  const callbackUrl = useMemo(
    () => normalizeCallbackUrl(searchParams.get("callbackUrl")),
    [searchParams]
  )
  /** Only bounce back to the app when middleware sent the user here to sign in before a protected route. */
  const hasAuthRedirectTarget = Boolean(callbackUrl)
  const isLgUp = useMinWidthLg()
  const [nativeClient, setNativeClient] = useState(false)
  const hasRedirected = useRef(false)

  useEffect(() => {
    setNativeClient(isNativeAppSync())
  }, [])

  /**
   * Avoid the old login-page server-session verification waterfall. Middleware/cookies already gate
   * protected routes; this client handoff should only use the hydrated client seed when it exists.
   */
  useEffect(() => {
    if (!hasAuthRedirectTarget) return
    if (hasRedirected.current) return
    if (status !== "authenticated" || !data?.user?.id) return

    hasRedirected.current = true
    const destination = callbackUrl ?? data.user.defaultAppPath ?? getDefaultAppPathForRole(data.user.role)
    router.replace(destination)
  }, [status, data?.user, callbackUrl, hasAuthRedirectTarget, router])

  const useNativeLoginChrome = nativeClient
  const useMobileWebLoginChrome = !nativeClient && !isLgUp
  const showMobileLogin = !hasAuthRedirectTarget || status !== "authenticated"

  return (
    <>
      {(useNativeLoginChrome || useMobileWebLoginChrome) && (
        <div className={useNativeLoginChrome ? "min-h-screen" : "lg:hidden"}>
          {showMobileLogin ? (
            <MobileAppLoginScreen />
          ) : (
            <MobileAppEntryLoading message="Opening your workspace…" />
          )}
        </div>
      )}

      {!useNativeLoginChrome && (
        <div className="hidden min-h-screen flex-col bg-white lg:flex">
          <SiteHeader />

          <section className="flex flex-1 items-center justify-center bg-gradient-to-b from-[#F8FAFC] to-white px-4 py-16 md:py-24">
            <div className="w-full max-w-md space-y-6">
              <div className="space-y-2 text-center">
                <h1 className="font-athletic text-4xl font-bold uppercase tracking-tight text-[#212529] md:text-5xl">
                  Welcome back
                </h1>
                <p className="text-base text-[#495057]">Sign in to your Braik account</p>
              </div>

              <HeroLoginForm />

              <div className="text-center">
                <Link
                  href="/forgot-password"
                  className="text-sm text-[#6c757d] transition-colors hover:text-[#3B82F6]"
                >
                  Forgot your password?
                </Link>
              </div>

              <div className="border-t border-[#E5E7EB] pt-5 text-center space-y-3">
                <p className="text-xs text-[#9CA3AF]">
                  <Link href="/privacy" className="text-[#6c757d] hover:text-[#3B82F6] hover:underline">
                    Privacy Policy
                  </Link>
                  <span className="mx-2">·</span>
                  <Link href="/terms" className="text-[#6c757d] hover:text-[#3B82F6] hover:underline">
                    Terms of Service
                  </Link>
                </p>
                <div className="mt-4 border-t border-[#E5E7EB] pt-3">
                  <Link
                    href="/admin/login"
                    className="inline-flex items-center justify-center rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-2 text-sm font-medium text-[#495057] transition-colors hover:border-[#DEE2E6] hover:bg-[#E9ECEF]"
                  >
                    Admin login
                  </Link>
                </div>
              </div>
            </div>
          </section>

          <SiteFooter />
        </div>
      )}
    </>
  )
}

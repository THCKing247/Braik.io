"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { SiteHeader } from "@/components/marketing/site-header"
import { SiteFooter } from "@/components/marketing/site-footer"
import { HeroLoginForm } from "@/components/marketing/hero-login-form"
import { useSession } from "@/lib/auth/client-auth"
import { getResumeOrDefaultAppPath } from "@/lib/navigation/last-visited-route"
import {
  MobileAppEntryLoading,
  MobileAppLoginScreen,
} from "@/components/auth/mobile-app-login-screen"
import { isNativeAppSync } from "@/lib/native/app-environment"
import { getNativeBiometricUnlockEnabled } from "@/lib/native/native-biometric-prefs"
import { hasNativeBiometricUnlockedThisLaunch } from "@/lib/native/native-unlock-session"
import { useMinWidthLg } from "@/lib/hooks/use-min-width-lg"

export default function LoginPage() {
  const router = useRouter()
  const { data, status } = useSession()
  const didRedirect = useRef(false)
  const isLgUp = useMinWidthLg()
  const [nativeClient, setNativeClient] = useState(false)

  useEffect(() => {
    setNativeClient(isNativeAppSync())
  }, [])

  const useNativeLoginChrome = nativeClient
  const useMobileWebLoginChrome = !nativeClient && !isLgUp

  useEffect(() => {
    if (status !== "authenticated" || !data?.user) return
    if (didRedirect.current) return
    didRedirect.current = true
    void (async () => {
      if (
        isNativeAppSync() &&
        (await getNativeBiometricUnlockEnabled()) &&
        !hasNativeBiometricUnlockedThisLaunch()
      ) {
        router.replace("/native-unlock")
        return
      }
      router.replace(getResumeOrDefaultAppPath(data.user.role))
    })()
  }, [router, status, data?.user])

  return (
    <>
      {(useNativeLoginChrome || useMobileWebLoginChrome) && (
        <div className={useNativeLoginChrome ? "min-h-screen" : "lg:hidden"}>
          {status === "unauthenticated" ? (
            <MobileAppLoginScreen />
          ) : (
            <MobileAppEntryLoading
              message={status === "authenticated" ? "Opening your workspace…" : "Loading…"}
            />
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

              <div className="border-t border-[#E5E7EB] pt-5 text-center">
                <p className="text-sm text-[#6c757d]">
                  Don&apos;t have an account?{" "}
                  <Link href="/signup/role" className="font-medium text-[#3B82F6] hover:underline">
                    Get started free
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

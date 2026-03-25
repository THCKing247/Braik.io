"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "@/lib/auth/client-auth"
import { getResumeOrDefaultAppPath } from "@/lib/navigation/last-visited-route"
import {
  MobileAppEntryLoading,
  MobileAppLoginScreen,
} from "@/components/auth/mobile-app-login-screen"

const MOBILE_TABLET_MAX_WIDTH = 1023

/**
 * Mobile/tablet only (&lt; 1024px). Shown inside `lg:hidden` on `/`.
 * Unauthenticated: premium sign-in-first screen (no extra redirect).
 * Authenticated: redirect into the app.
 * Viewport is checked in an effect so the same tree on desktop never redirects.
 */
export function MobileRootRedirect() {
  const router = useRouter()
  const { data, status } = useSession()
  const didRun = useRef(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (window.innerWidth > MOBILE_TABLET_MAX_WIDTH) return
    if (status === "loading") return
    if (status !== "authenticated" || !data?.user) return
    if (didRun.current) return
    didRun.current = true
    router.replace(getResumeOrDefaultAppPath(data.user.role, data.user.defaultAppPath))
  }, [router, status, data?.user])

  if (status === "unauthenticated") {
    return <MobileAppLoginScreen />
  }

  return (
    <MobileAppEntryLoading
      message={status === "authenticated" ? "Opening your workspace…" : "Loading…"}
    />
  )
}

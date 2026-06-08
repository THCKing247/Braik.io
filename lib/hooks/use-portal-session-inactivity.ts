"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { signOut } from "@/lib/auth/client-auth"
import {
  BRAIK_PORTAL_SESSION_IDLE_BEFORE_WARNING_MS,
  BRAIK_PORTAL_SESSION_KEEPALIVE_MS,
  BRAIK_PORTAL_SESSION_WARNING_MS,
} from "@/lib/auth/session-inactivity-policy"
import { supabaseClient } from "@/src/lib/supabaseClient"

type SessionPolicy = {
  idleLogoutEnabled: boolean
}

async function fetchSessionPolicy(): Promise<SessionPolicy> {
  try {
    const res = await fetch("/api/auth/session", { credentials: "include" })
    if (!res.ok) return { idleLogoutEnabled: false }
    const data = (await res.json()) as { user?: { id?: string }; idleLogoutEnabled?: boolean }
    if (!data.user?.id) return { idleLogoutEnabled: false }
    return { idleLogoutEnabled: data.idleLogoutEnabled !== false }
  } catch {
    return { idleLogoutEnabled: true }
  }
}

async function refreshPortalSessionCookies(): Promise<void> {
  await fetch("/api/auth/session", { credentials: "include" }).catch(() => null)
  await supabaseClient.auth.refreshSession().catch(() => null)
}

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  "mousedown",
  "mousemove",
  "keydown",
  "touchstart",
  "scroll",
  "wheel",
  "pointerdown",
]

/**
 * Tracks portal inactivity: 58 min idle → 2 min warning → sign out.
 * Activity resets the idle timer and periodically refreshes httpOnly session cookies
 * so active users are not logged out at the 1-hour access token boundary.
 */
export function usePortalSessionInactivity(enabled: boolean) {
  const [warningOpen, setWarningOpen] = useState(false)
  const [secondsRemaining, setSecondsRemaining] = useState(
    Math.ceil(BRAIK_PORTAL_SESSION_WARNING_MS / 1000)
  )

  const idleLogoutEnabledRef = useRef(true)
  const warningOpenRef = useRef(false)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastKeepaliveRef = useRef(Date.now())
  const signingOutRef = useRef(false)

  warningOpenRef.current = warningOpen

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current)
      idleTimerRef.current = null
    }
  }, [])

  const clearWarningTimers = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current)
      countdownTimerRef.current = null
    }
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current)
      logoutTimerRef.current = null
    }
  }, [])

  const performLogout = useCallback(async () => {
    if (signingOutRef.current) return
    signingOutRef.current = true
    clearIdleTimer()
    clearWarningTimers()
    setWarningOpen(false)
    await signOut({ callbackUrl: "/login?reason=session-timeout" })
  }, [clearIdleTimer, clearWarningTimers])

  const startWarningCountdown = useCallback(() => {
    if (!idleLogoutEnabledRef.current || warningOpenRef.current) return

    clearIdleTimer()
    clearWarningTimers()
    setSecondsRemaining(Math.ceil(BRAIK_PORTAL_SESSION_WARNING_MS / 1000))
    setWarningOpen(true)

    countdownTimerRef.current = setInterval(() => {
      setSecondsRemaining((prev) => Math.max(0, prev - 1))
    }, 1000)

    logoutTimerRef.current = setTimeout(() => {
      void performLogout()
    }, BRAIK_PORTAL_SESSION_WARNING_MS)
  }, [clearIdleTimer, clearWarningTimers, performLogout])

  const scheduleIdleWarning = useCallback(() => {
    if (!idleLogoutEnabledRef.current) return
    clearIdleTimer()
    idleTimerRef.current = setTimeout(startWarningCountdown, BRAIK_PORTAL_SESSION_IDLE_BEFORE_WARNING_MS)
  }, [clearIdleTimer, startWarningCountdown])

  const dismissWarningAndExtend = useCallback(() => {
    clearWarningTimers()
    setWarningOpen(false)
    setSecondsRemaining(Math.ceil(BRAIK_PORTAL_SESSION_WARNING_MS / 1000))
    lastKeepaliveRef.current = Date.now()
    void refreshPortalSessionCookies()
    scheduleIdleWarning()
  }, [clearWarningTimers, scheduleIdleWarning])

  const onActivity = useCallback(() => {
    if (!enabled) return

    if (idleLogoutEnabledRef.current && !warningOpenRef.current) {
      scheduleIdleWarning()
    }

    const now = Date.now()
    if (now - lastKeepaliveRef.current >= BRAIK_PORTAL_SESSION_KEEPALIVE_MS) {
      lastKeepaliveRef.current = now
      void refreshPortalSessionCookies()
    }
  }, [enabled, scheduleIdleWarning])

  useEffect(() => {
    if (!enabled) {
      clearIdleTimer()
      clearWarningTimers()
      setWarningOpen(false)
      return
    }

    let cancelled = false

    void fetchSessionPolicy().then((policy) => {
      if (cancelled) return
      idleLogoutEnabledRef.current = policy.idleLogoutEnabled
      if (policy.idleLogoutEnabled) {
        scheduleIdleWarning()
      } else {
        clearIdleTimer()
      }
    })

    onActivity()

    const onAct = () => onActivity()
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, onAct, { passive: true }))

    const onVis = () => {
      if (!document.hidden) onActivity()
    }
    document.addEventListener("visibilitychange", onVis)
    window.addEventListener("focus", onActivity)

    return () => {
      cancelled = true
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, onAct))
      document.removeEventListener("visibilitychange", onVis)
      window.removeEventListener("focus", onActivity)
      clearIdleTimer()
      clearWarningTimers()
    }
  }, [enabled, onActivity, scheduleIdleWarning, clearIdleTimer, clearWarningTimers])

  return {
    warningOpen,
    secondsRemaining,
    dismissWarningAndExtend,
    performLogout,
  }
}

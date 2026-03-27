"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/** Tab visible + recent activity. */
export const NOTIFICATIONS_POLL_INTERVAL_MS = 45_000

/** Tab visible but user idle — fewer round-trips on poor networks. */
export const NOTIFICATIONS_POLL_INTERVAL_IDLE_MS = 120_000

const DEFAULT_USER_IDLE_MS = 120_000

/**
 * When false, skip notification polling (tab hidden or no recent user activity).
 */
export function useNotificationsPollingActive(idleMs: number = DEFAULT_USER_IDLE_MS): boolean {
  const [hidden, setHidden] = useState(() =>
    typeof document !== "undefined" ? document.hidden : false
  )
  const [inactive, setInactive] = useState(false)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const bumpActivity = useCallback(() => {
    setInactive(false)
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    idleTimerRef.current = setTimeout(() => setInactive(true), idleMs)
  }, [idleMs])

  useEffect(() => {
    const onVis = () => {
      setHidden(document.hidden)
      if (!document.hidden) bumpActivity()
    }
    document.addEventListener("visibilitychange", onVis)

    const events: (keyof WindowEventMap)[] = ["mousedown", "keydown", "touchstart", "scroll", "wheel"]
    const onAct = () => bumpActivity()
    events.forEach((e) => window.addEventListener(e, onAct, { passive: true }))
    bumpActivity()

    return () => {
      document.removeEventListener("visibilitychange", onVis)
      events.forEach((e) => window.removeEventListener(e, onAct))
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }
  }, [bumpActivity])

  return !hidden && !inactive
}

/**
 * Poll interval when the tab is visible: faster after recent activity, slower when idle.
 * When the tab is hidden, `useNotificationsPollingActive()` is false — clear the interval instead of relying on this value.
 */
export function useNotificationPollIntervalMs(): number {
  const active = useNotificationsPollingActive()
  return active ? NOTIFICATIONS_POLL_INTERVAL_MS : NOTIFICATIONS_POLL_INTERVAL_IDLE_MS
}

const FOREGROUND_DEBOUNCE_MS = 300

/**
 * Runs when the document becomes visible or the window regains focus (debounced).
 */
export function useOnDocumentForeground(callback: () => void, enabled: boolean) {
  const cbRef = useRef(callback)
  cbRef.current = callback
  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!enabled) return

    const run = () => {
      if (tRef.current) clearTimeout(tRef.current)
      tRef.current = setTimeout(() => {
        if (document.visibilityState === "visible") cbRef.current()
      }, FOREGROUND_DEBOUNCE_MS)
    }

    const onVis = () => {
      if (!document.hidden) run()
    }

    document.addEventListener("visibilitychange", onVis)
    window.addEventListener("focus", run)

    return () => {
      document.removeEventListener("visibilitychange", onVis)
      window.removeEventListener("focus", run)
      if (tRef.current) clearTimeout(tRef.current)
    }
  }, [enabled])
}

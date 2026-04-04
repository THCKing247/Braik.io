"use client"

import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  BRAIK_CALENDAR_EVENTS_CHANGED_EVENT,
  invalidateTeamCalendarQueries,
} from "@/lib/calendar/calendar-events-client"

/**
 * Listens for Coach B calendar mutations so React Query–backed views (e.g. /dashboard/.../calendar)
 * refetch immediately instead of waiting for staleTime (5m).
 */
export function CalendarEventsInvalidateBridge() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const onChanged = (ev: Event) => {
      const detail = (ev as CustomEvent<{ teamId?: string }>).detail
      const tid = typeof detail?.teamId === "string" ? detail.teamId.trim() : ""
      if (!tid) return
      void Promise.resolve(invalidateTeamCalendarQueries(queryClient, tid)).then(() => {
        if (process.env.NODE_ENV === "development") {
          console.log("[Coach B calendar] React Query calendar-events invalidated", { teamId: tid })
        }
      })
    }
    window.addEventListener(BRAIK_CALENDAR_EVENTS_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(BRAIK_CALENDAR_EVENTS_CHANGED_EVENT, onChanged)
  }, [queryClient])

  return null
}

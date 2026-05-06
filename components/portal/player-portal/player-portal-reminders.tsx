"use client"

import { useEffect, useState } from "react"
import { Bell, Loader2 } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { usePlayerPortal } from "@/components/portal/player-portal/player-portal-context"
import { braikPlayerTheme } from "@/components/portal/portal-brand-tokens"

type NotifRow = {
  id: string
  title: string
  body?: string | null
  createdAt?: string
  read?: boolean
}

export function PlayerPortalReminders() {
  const { teamId } = usePlayerPortal()
  const [items, setItems] = useState<NotifRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const tid = teamId.trim()
    if (!tid) {
      setItems([])
      setLoading(false)
      return
    }
    setLoading(true)
    fetch(`/api/notifications?teamId=${encodeURIComponent(tid)}&limit=30&unreadOnly=false&preview=1`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { notifications?: NotifRow[] } | null) => {
        if (!cancelled) setItems(Array.isArray(j?.notifications) ? j!.notifications! : [])
      })
      .catch(() => {
        if (!cancelled) setItems([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [teamId])

  return (
    <div className={`rounded-2xl border p-5 shadow-xl ${braikPlayerTheme.surface}`}>
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#F85808] to-[#D83808] text-[#F8F8F8] shadow-md">
          <Bell className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <h2 className={`text-lg font-bold ${braikPlayerTheme.textWarm}`}>Reminders</h2>
          <p className={`text-xs ${braikPlayerTheme.textMuted}`}>Recent alerts for your account</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-10 w-10 animate-spin text-[#F85808]" aria-hidden />
        </div>
      ) : items.length === 0 ? (
        <p className={`rounded-xl border border-dashed border-[#2a3152] bg-[#10265f] px-4 py-10 text-center text-sm ${braikPlayerTheme.textMuted}`}>
          You&apos;re all caught up — no reminders right now.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id} className="rounded-xl border border-[#2a3152] bg-[#10265f] px-4 py-3">
              <p className={`font-semibold ${braikPlayerTheme.textWarm}`}>{n.title}</p>
              {n.body ? <p className={`mt-1 text-sm line-clamp-3 ${braikPlayerTheme.textSecondary}`}>{n.body}</p> : null}
              {n.createdAt ? (
                <p className={`mt-2 text-[11px] font-medium uppercase tracking-wide ${braikPlayerTheme.textMuted}`}>
                  {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                  {!n.read ? " · Unread" : ""}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

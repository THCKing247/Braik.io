"use client"

import { useEffect, useState } from "react"
import { Bell, Loader2 } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { usePlayerPortal } from "@/components/portal/player-portal/player-portal-context"

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
    <div className="rounded-2xl border border-white/40 bg-white p-5 shadow-xl">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-lime-500 to-green-700 text-white shadow-md">
          <Bell className="h-5 w-5" aria-hidden />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-900">Reminders</h2>
          <p className="text-xs text-slate-500">Recent alerts for your account</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-500" aria-hidden />
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
          You&apos;re all caught up — no reminders right now.
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <p className="font-semibold text-slate-900">{n.title}</p>
              {n.body ? <p className="mt-1 text-sm text-slate-600 line-clamp-3">{n.body}</p> : null}
              {n.createdAt ? (
                <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">
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

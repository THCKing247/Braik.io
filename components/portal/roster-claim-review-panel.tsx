"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { fetchWithTimeout } from "@/lib/api-client/fetch-with-timeout"

type Row = {
  id: string
  first_name: string
  last_name: string
  jersey_number: number | null
  position_group: string | null
  graduation_year: number | null
  user_id: string | null
  email: string | null
  claim_status: string | null
  self_registered?: boolean | null
  created_source?: string | null
  claimed_at?: string | null
}

type Hint = { pendingId: string; rosterId: string; label: string }

export function RosterClaimReviewPanel({ teamId, canEdit }: { teamId: string; canEdit: boolean }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [unclaimed, setUnclaimed] = useState<Row[]>([])
  const [pendingReview, setPendingReview] = useState<Row[]>([])
  const [claimed, setClaimed] = useState<Row[]>([])
  const [hints, setHints] = useState<Hint[]>([])
  const [busy, setBusy] = useState(false)
  const [linkPendingId, setLinkPendingId] = useState("")
  const [linkRosterId, setLinkRosterId] = useState("")

  const load = useCallback(async () => {
    if (!teamId || !canEdit) return
    setLoading(true)
    setError("")
    try {
      const res = await fetchWithTimeout(`/api/roster/claim-review?teamId=${encodeURIComponent(teamId)}`, {
        credentials: "include",
      })
      const data = (await res.json()) as {
        error?: string
        unclaimed?: Row[]
        pendingReview?: Row[]
        claimed?: Row[]
        duplicateHints?: Hint[]
      }
      if (!res.ok) {
        setError(data.error ?? "Failed to load")
        setLoading(false)
        return
      }
      setUnclaimed(data.unclaimed ?? [])
      setPendingReview(data.pendingReview ?? [])
      setClaimed(data.claimed ?? [])
      setHints(data.duplicateHints ?? [])
    } catch {
      setError("Could not load roster review data.")
    }
    setLoading(false)
  }, [teamId, canEdit])

  useEffect(() => {
    void load()
  }, [load])

  const postAction = async (body: Record<string, unknown>) => {
    setBusy(true)
    setError("")
    try {
      const res = await fetchWithTimeout("/api/roster/claim-review", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, ...body }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        setError(data.error ?? "Action failed")
        setBusy(false)
        return
      }
      await load()
    } catch {
      setError("Network error")
    }
    setBusy(false)
  }

  if (!canEdit) {
    return (
      <p className="text-sm" style={{ color: "rgb(var(--muted))" }}>
        You don&apos;t have permission to manage roster claims.
      </p>
    )
  }

  if (loading) {
    return <div className="text-sm" style={{ color: "rgb(var(--muted))" }}>Loading roster review…</div>
  }

  return (
    <div className="space-y-8 min-w-0">
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      ) : null}

      {hints.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold mb-1">Possible duplicates</p>
          <ul className="list-disc pl-5 space-y-1">
            {hints.map((h) => (
              <li key={`${h.pendingId}-${h.rosterId}`}>{h.label}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <section className="space-y-3">
        <h3 className="text-lg font-semibold" style={{ color: "rgb(var(--text))" }}>
          Pending review (self-signup)
        </h3>
        {pendingReview.length === 0 ? (
          <p className="text-sm" style={{ color: "rgb(var(--muted))" }}>
            No players waiting for approval.
          </p>
        ) : (
          <ul className="space-y-2">
            {pendingReview.map((p) => (
              <li
                key={p.id}
                className="flex flex-col gap-2 rounded-xl border p-4 md:flex-row md:items-center md:justify-between"
                style={{ borderColor: "rgb(var(--border))", background: "rgb(var(--card))" }}
              >
                <div>
                  <div className="font-medium" style={{ color: "rgb(var(--text))" }}>
                    {p.first_name} {p.last_name}
                  </div>
                  <div className="text-xs" style={{ color: "rgb(var(--muted))" }}>
                    {p.email ?? "No email"} · {p.jersey_number != null ? `#${p.jersey_number}` : "No #"} · Self-registered
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    onClick={() => void postAction({ action: "approve", playerId: p.id })}
                  >
                    Approve
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void postAction({ action: "dismiss", playerId: p.id })}
                  >
                    Dismiss
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold" style={{ color: "rgb(var(--text))" }}>
          Unclaimed coach / import roster spots
        </h3>
        {unclaimed.length === 0 ? (
          <p className="text-sm" style={{ color: "rgb(var(--muted))" }}>
            All coach roster rows are linked or inactive.
          </p>
        ) : (
          <ul className="space-y-2">
            {unclaimed.map((p) => (
              <li
                key={p.id}
                className="rounded-xl border p-4 flex flex-col gap-1 md:flex-row md:items-center md:justify-between"
                style={{ borderColor: "rgb(var(--border))", background: "rgb(var(--card))" }}
              >
                <div>
                  <div className="font-medium" style={{ color: "rgb(var(--text))" }}>
                    {p.first_name} {p.last_name}
                  </div>
                  <div className="text-xs" style={{ color: "rgb(var(--muted))" }}>
                    {p.jersey_number != null ? `#${p.jersey_number}` : "No #"} · {p.position_group ?? "—"} ·{" "}
                    {p.created_source ?? "coach"}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {pendingReview.length > 0 && unclaimed.length > 0 ? (
        <section className="rounded-xl border border-dashed p-4 space-y-3" style={{ borderColor: "rgb(var(--border))" }}>
          <p className="text-sm font-medium" style={{ color: "rgb(var(--text))" }}>
            Link self-signup to an existing roster row
          </p>
          <p className="text-xs" style={{ color: "rgb(var(--muted))" }}>
            Resolves duplicate lines by moving the account onto the coach-created roster spot.
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            <select
              className="rounded-md border px-2 py-2 text-sm bg-background"
              value={linkPendingId}
              onChange={(e) => setLinkPendingId(e.target.value)}
              style={{ borderColor: "rgb(var(--border))" }}
            >
              <option value="">Select pending signup…</option>
              {pendingReview.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.first_name} {p.last_name}
                </option>
              ))}
            </select>
            <select
              className="rounded-md border px-2 py-2 text-sm bg-background"
              value={linkRosterId}
              onChange={(e) => setLinkRosterId(e.target.value)}
              style={{ borderColor: "rgb(var(--border))" }}
            >
              <option value="">Select unclaimed roster row…</option>
              {unclaimed.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.first_name} {p.last_name}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={!linkPendingId || !linkRosterId || busy}
            onClick={() => void postAction({ action: "link", pendingPlayerId: linkPendingId, rosterPlayerId: linkRosterId })}
          >
            Link accounts
          </Button>
        </section>
      ) : null}

      <section className="space-y-3">
        <h3 className="text-lg font-semibold" style={{ color: "rgb(var(--text))" }}>
          Linked players
        </h3>
        {claimed.length === 0 ? (
          <p className="text-sm" style={{ color: "rgb(var(--muted))" }}>
            No claimed roster rows yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {claimed.slice(0, 40).map((p) => (
              <li
                key={p.id}
                className="rounded-xl border px-4 py-2 text-sm flex justify-between gap-2"
                style={{ borderColor: "rgb(var(--border))" }}
              >
                <span>
                  {p.first_name} {p.last_name}
                </span>
                <span style={{ color: "rgb(var(--muted))" }}>{p.email ?? "linked"}</span>
              </li>
            ))}
            {claimed.length > 40 ? (
              <p className="text-xs" style={{ color: "rgb(var(--muted))" }}>
                Showing 40 of {claimed.length} — see the main roster for the full list.
              </p>
            ) : null}
          </ul>
        )}
      </section>
    </div>
  )
}

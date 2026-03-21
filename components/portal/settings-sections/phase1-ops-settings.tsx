"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface Phase1Summary {
  roster: {
    scope: string
    limit: number | null
    programId: string | null
    activePlayerCount: number
  }
  billingLifecycleEnforced: boolean
  recentAudit: Array<{
    action_type: string | null
    target_type: string | null
    target_id: string | null
    created_at: string
  }>
}

export function Phase1OpsSettings({ teamId }: { teamId: string }) {
  const [data, setData] = useState<Phase1Summary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/teams/${teamId}/phase1-summary`)
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error((json as { error?: string }).error || "Failed to load")
        }
        if (!cancelled) setData(json as Phase1Summary)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (teamId) void load()
    return () => {
      cancelled = true
    }
  }, [teamId])

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading program status…</p>
  }
  if (error) {
    return <p className="text-sm text-destructive">{error}</p>
  }
  if (!data) {
    return null
  }

  const lim = data.roster.limit
  const scopeLabel =
    data.roster.scope === "program"
      ? "Program-wide cap"
      : data.roster.scope === "team"
        ? "Team cap"
        : "No cap configured"

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Program & limits</h2>
        <p className="text-sm mt-1 text-muted-foreground">
          Roster enforcement, billing mode, and recent audit events for this team.
        </p>
      </div>

      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="text-lg">Roster</CardTitle>
          <CardDescription>{scopeLabel}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-foreground">
          <p>
            <span className="text-muted-foreground">Active players: </span>
            <strong>{data.roster.activePlayerCount}</strong>
            {lim != null ? (
              <>
                {" "}
                / <strong>{lim}</strong> allowed
              </>
            ) : (
              <span className="text-muted-foreground"> (no limit set)</span>
            )}
          </p>
          {data.roster.programId && (
            <p className="text-muted-foreground text-xs">Program ID: {data.roster.programId}</p>
          )}
        </CardContent>
      </Card>

      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="text-lg">Billing enforcement</CardTitle>
          <CardDescription>Season lifecycle / read-only gating (separate from roster counts)</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-foreground">
          <p>
            {data.billingLifecycleEnforced ? (
              <span className="text-amber-700 font-medium">Enforced — non-payment can lock features per policy.</span>
            ) : (
              <span className="text-muted-foreground">
                Not enforced (development / pre-launch). Flip in code when Stripe is ready.
              </span>
            )}
          </p>
        </CardContent>
      </Card>

      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="text-lg">Recent audit (team-scoped)</CardTitle>
          <CardDescription>Moderation and other logged actions with a team id. Older rows may be missing.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.recentAudit.length === 0 ? (
            <p className="text-sm text-muted-foreground">No team-scoped audit entries yet.</p>
          ) : (
            <ul className="space-y-2 max-h-64 overflow-y-auto text-sm">
              {data.recentAudit.map((a, i) => (
                <li key={`${a.created_at}-${i}`} className="border-b border-border pb-2 last:border-0">
                  <span className="font-medium">{a.action_type ?? "—"}</span>
                  {a.target_type && (
                    <span className="text-muted-foreground">
                      {" "}
                      · {a.target_type} {a.target_id ? `#${a.target_id.slice(0, 8)}…` : ""}
                    </span>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {a.created_at ? new Date(a.created_at).toLocaleString() : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

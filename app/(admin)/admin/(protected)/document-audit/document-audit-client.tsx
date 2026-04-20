"use client"

import { useCallback, useEffect, useState } from "react"
import { adminUi } from "@/lib/admin/admin-ui"
import { cn } from "@/lib/utils"

type Entry = {
  id: string
  documentId: string
  createdAt: string
  actorProfileId: string
  actorName: string | null
  actorRole: string | null
  action: string
  accessMethod: string | null
  ipAddress: string | null
  userAgent: string | null
  metadata: unknown
  teamId: string | null
  playerId: string | null
  documentName: string | null
}

export function DocumentAuditClient() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [action, setAction] = useState("")
  const [teamId, setTeamId] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const p = new URLSearchParams()
    if (action) p.set("action", action)
    if (teamId.trim()) p.set("teamId", teamId.trim())
    p.set("limit", "200")
    try {
      const res = await fetch(`/api/admin/document-audit?${p.toString()}`, { credentials: "include", cache: "no-store" })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error((d as { error?: string }).error ?? "Failed to load")
      }
      const data = await res.json()
      setEntries(Array.isArray(data.entries) ? data.entries : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load")
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [action, teamId])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className={cn(adminUi.label, "flex flex-col gap-1")}>
          Action
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className={cn(adminUi.select, "mt-0 min-w-[160px]")}
          >
            <option value="">All</option>
            <option value="upload">upload</option>
            <option value="view">view</option>
            <option value="download">download</option>
            <option value="delete">delete</option>
            <option value="signed_url_generated">signed_url_generated</option>
            <option value="bulk_export">bulk_export</option>
          </select>
        </label>
        <label className={cn(adminUi.label, "flex flex-col gap-1")}>
          Team ID
          <input
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            placeholder="optional filter"
            className={cn(adminUi.input, "mt-0 w-72")}
          />
        </label>
        <button type="button" onClick={() => void load()} className={adminUi.btnPrimary}>
          Refresh
        </button>
      </div>

      {loading && <p className="text-sm text-admin-muted">Loading…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && !error && (
        <div className={adminUi.tableWrap}>
          <table className={cn(adminUi.table, "min-w-full")}>
            <thead className={adminUi.thead}>
              <tr>
                <th className={adminUi.th}>Time</th>
                <th className={adminUi.th}>Actor</th>
                <th className={adminUi.th}>Role</th>
                <th className={adminUi.th}>Action</th>
                <th className={adminUi.th}>Document</th>
                <th className={adminUi.th}>Method</th>
                <th className={adminUi.th}>IP</th>
                <th className={adminUi.th}>Metadata</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className={adminUi.tbodyRow}>
                  <td className={cn(adminUi.td, "whitespace-nowrap text-admin-secondary")}>
                    {new Date(e.createdAt).toLocaleString()}
                  </td>
                  <td className={cn(adminUi.td, "max-w-[140px] truncate")} title={e.actorProfileId}>
                    {e.actorName ?? e.actorProfileId.slice(0, 8) + "…"}
                  </td>
                  <td className={adminUi.td}>{e.actorRole ?? "—"}</td>
                  <td className={cn(adminUi.td, "font-mono text-xs")}>{e.action}</td>
                  <td className={cn(adminUi.td, "max-w-[200px] truncate")} title={e.documentName ?? ""}>
                    {e.documentName ?? e.documentId.slice(0, 8) + "…"}
                  </td>
                  <td className={adminUi.td}>{e.accessMethod ?? "—"}</td>
                  <td className={cn(adminUi.td, "font-mono text-xs")}>{e.ipAddress ?? "—"}</td>
                  <td
                    className={cn(adminUi.td, "max-w-xs truncate font-mono text-xs text-admin-muted")}
                    title={JSON.stringify(e.metadata)}
                  >
                    {JSON.stringify(e.metadata)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {entries.length === 0 && (
            <p className="p-6 text-center text-sm text-admin-muted">No entries match filters.</p>
          )}
        </div>
      )}
    </div>
  )
}

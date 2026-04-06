"use client"

import { useCallback, useEffect, useState } from "react"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { adminUi } from "@/lib/admin/admin-ui"
import { cn } from "@/lib/utils"

type LogRow = {
  id: string
  actorId: string
  actorEmail: string | null
  actorName: string | null
  action: string
  targetType: string | null
  targetId: string | null
  metadata: unknown
  createdAt: string
}

export function AdminAuditClient() {
  const [logs, setLogs] = useState<LogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionFilter, setActionFilter] = useState("")
  const [targetTypeFilter, setTargetTypeFilter] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const p = new URLSearchParams()
      if (actionFilter.trim()) p.set("action", actionFilter.trim())
      if (targetTypeFilter.trim()) p.set("targetType", targetTypeFilter.trim())
      const res = await fetch(`/api/admin/audit-logs?${p.toString()}`, { credentials: "include", cache: "no-store" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `Failed (${res.status})`)
      setLogs(Array.isArray(data.logs) ? data.logs : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load")
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [actionFilter, targetTypeFilter])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Audit log"
        description="Platform audit entries from Supabase (audit_logs). Newest first."
      />

      <div className="flex flex-wrap items-end gap-3">
        <label className={cn(adminUi.label, "flex flex-col gap-1")}>
          Action contains
          <input
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            placeholder="e.g. admin_"
            className={cn(adminUi.toolbarInput, "min-w-[180px]")}
          />
        </label>
        <label className={cn(adminUi.label, "flex flex-col gap-1")}>
          Target type
          <input
            value={targetTypeFilter}
            onChange={(e) => setTargetTypeFilter(e.target.value)}
            placeholder="optional"
            className={cn(adminUi.toolbarInput, "min-w-[160px]")}
          />
        </label>
        <button type="button" onClick={() => void load()} className={adminUi.btnPrimarySm}>
          Apply filters
        </button>
      </div>

      {loading && <p className="text-sm font-medium text-slate-400">Loading…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && !error && (
        <div className={adminUi.tableWrap}>
          <table className={cn(adminUi.table, "min-w-[960px]")}>
            <thead className={adminUi.thead}>
              <tr>
                <th className={adminUi.th}>Time</th>
                <th className={adminUi.th}>Actor</th>
                <th className={adminUi.th}>Action</th>
                <th className={adminUi.th}>Target</th>
                <th className={adminUi.th}>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((row) => (
                <tr key={row.id} className={adminUi.tbodyRow}>
                  <td className={cn(adminUi.td, "whitespace-nowrap text-slate-200")}>
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  <td className={adminUi.td}>
                    <div className="font-medium text-white">{row.actorEmail ?? row.actorId}</div>
                    {row.actorName ? <div className="text-xs text-slate-400">{row.actorName}</div> : null}
                    <div className="font-mono text-[10px] text-slate-500">{row.actorId}</div>
                  </td>
                  <td className={cn(adminUi.td, "font-mono text-xs")}>{row.action}</td>
                  <td className={adminUi.td}>
                    <div className="text-slate-200">{row.targetType ?? "—"}</div>
                    {row.targetId ? (
                      <div className="font-mono text-xs text-slate-400 break-all">{row.targetId}</div>
                    ) : null}
                  </td>
                  <td className={cn(adminUi.td, "max-w-md font-mono text-[11px] text-slate-400")}>
                    {row.metadata != null ? JSON.stringify(row.metadata) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {logs.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm font-medium text-slate-400">No audit entries found.</p>
          ) : null}
        </div>
      )}
    </div>
  )
}

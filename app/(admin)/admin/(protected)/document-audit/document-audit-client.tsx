"use client"

import { useCallback, useEffect, useState } from "react"

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
      const res = await fetch(`/api/admin/document-audit?${p.toString()}`)
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
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          Action
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="rounded-md border border-white/[0.1] bg-admin-input px-3 py-2 text-sm text-zinc-100 [&>option]:bg-admin-input"
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
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          Team ID
          <input
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            placeholder="optional filter"
            className="w-72 rounded-md border border-white/[0.1] bg-admin-input px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500"
          />
        </label>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500"
        >
          Refresh
        </button>
      </div>

      {loading && <p className="text-sm text-zinc-400">Loading…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && !error && (
        <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-admin-card shadow-admin-card">
          <table className="min-w-full text-left text-sm text-zinc-200">
            <thead className="bg-admin-nested text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Actor</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Action</th>
                <th className="px-3 py-2">Document</th>
                <th className="px-3 py-2">Method</th>
                <th className="px-3 py-2">IP</th>
                <th className="px-3 py-2">Metadata</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-t border-white/[0.08]">
                  <td className="whitespace-nowrap px-3 py-2 text-zinc-300">
                    {new Date(e.createdAt).toLocaleString()}
                  </td>
                  <td className="max-w-[140px] truncate px-3 py-2" title={e.actorProfileId}>
                    {e.actorName ?? e.actorProfileId.slice(0, 8) + "…"}
                  </td>
                  <td className="px-3 py-2">{e.actorRole ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{e.action}</td>
                  <td className="max-w-[200px] truncate px-3 py-2" title={e.documentName ?? ""}>
                    {e.documentName ?? e.documentId.slice(0, 8) + "…"}
                  </td>
                  <td className="px-3 py-2">{e.accessMethod ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{e.ipAddress ?? "—"}</td>
                  <td className="max-w-xs truncate px-3 py-2 font-mono text-xs text-zinc-500" title={JSON.stringify(e.metadata)}>
                    {JSON.stringify(e.metadata)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {entries.length === 0 && (
            <p className="p-6 text-center text-sm text-zinc-500">No entries match filters.</p>
          )}
        </div>
      )}
    </div>
  )
}

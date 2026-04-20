"use client"

import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import { adminChip, adminUi } from "@/lib/admin/admin-ui"
import { cn } from "@/lib/utils"

const TABLE_KEYS = [
  "users",
  "teams",
  "subscriptions",
  "audit_logs",
  "agent_actions",
  "creations",
] as const

type TableKey = (typeof TABLE_KEYS)[number]

type AuditApiRow = {
  id: string
  action_type: string
  actor_id: string
  target_type: string | null
  target_id: string | null
  metadata_json: unknown
  created_at: string
  team_id: string | null
}

type ApiOk = {
  ok: true
  mode: string
  browseWindowApplied?: boolean
  parsed?: unknown
  inspectId?: string
  primaryEntity?: { source_table: string; record: Record<string, unknown> } | null
  entityHits: unknown[]
  auditLogs: { rows: AuditApiRow[]; total: number }
  agentActions: { rows: Record<string, unknown>[]; total: number }
  creations?: {
    users: Record<string, unknown>[]
    teams: Record<string, unknown>[]
    errors?: string[]
  }
}

function CopyText({ label, text }: { label: string; text: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      className={cn(adminUi.btnSecondarySm, "font-mono")}
      title={label}
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setDone(true)
          setTimeout(() => setDone(false), 1400)
        })
      }}
    >
      {done ? "Copied" : label}
    </button>
  )
}

function IdCell({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="text-admin-muted">—</span>
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="break-all font-mono text-[11px] leading-snug text-admin-primary">{value}</span>
      <CopyText label="Copy id" text={value} />
    </div>
  )
}

export function AdminDevConsoleClient() {
  const [capsOk, setCapsOk] = useState<boolean | null>(null)

  const [globalQ, setGlobalQ] = useState("")
  const [actionTypeFilter, setActionTypeFilter] = useState("")
  const [startIso, setStartIso] = useState("")
  const [endIso, setEndIso] = useState("")
  const [tablesOn, setTablesOn] = useState<Record<TableKey, boolean>>(() =>
    TABLE_KEYS.reduce((acc, k) => {
      acc[k] = true
      return acc
    }, {} as Record<TableKey, boolean>)
  )

  const [inspectId, setInspectId] = useState<string | null>(null)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ApiOk | null>(null)
  const [expandedAudit, setExpandedAudit] = useState<Set<string>>(() => new Set())

  type FetchOverrides = Partial<{ inspectId: string | null; offset: number }>

  const tablesParam = useMemo(() => {
    const keys = TABLE_KEYS.filter((k) => tablesOn[k])
    if (keys.length === TABLE_KEYS.length) return ""
    return keys.join(",")
  }, [tablesOn])

  const fetchDevConsole = useCallback(
    async (overrides?: FetchOverrides) => {
      setLoading(true)
      setError(null)
      try {
        const effectiveInspect =
          overrides?.inspectId !== undefined ? overrides.inspectId : inspectId
        const effectiveOffset = overrides?.offset !== undefined ? overrides.offset : offset

        const p = new URLSearchParams()
        if (effectiveInspect) {
          p.set("inspect", effectiveInspect)
        } else if (globalQ.trim()) {
          p.set("q", globalQ.trim())
        }
        if (actionTypeFilter.trim()) p.set("actionType", actionTypeFilter.trim())
        if (tablesParam) p.set("tables", tablesParam)
        if (startIso.trim()) {
          const t = new Date(startIso.trim())
          if (!Number.isNaN(t.getTime())) p.set("start", t.toISOString())
        }
        if (endIso.trim()) {
          const t = new Date(endIso.trim())
          if (!Number.isNaN(t.getTime())) p.set("end", t.toISOString())
        }
        p.set("offset", String(effectiveOffset))
        p.set("limit", "50")

        const res = await fetch(`/api/admin/dev-console?${p.toString()}`, {
          credentials: "include",
          cache: "no-store",
        })
        const json = (await res.json()) as ApiOk | { ok: false; error?: string }
        if (!res.ok) {
          throw new Error(!json.ok && json.error ? json.error : `Request failed (${res.status})`)
        }
        if (!json.ok) throw new Error("Invalid response")
        setData(json)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load")
        setData(null)
      } finally {
        setLoading(false)
      }
    },
    [
      inspectId,
      offset,
      globalQ,
      actionTypeFilter,
      tablesParam,
      startIso,
      endIso,
    ]
  )

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch("/api/admin/platform-role-access", { credentials: "include", cache: "no-store" })
        const j = res.ok ? await res.json() : {}
        if (!cancelled) setCapsOk(Boolean(j.canUseDevConsole))
      } catch {
        if (!cancelled) setCapsOk(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    void fetchDevConsole()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial probe only; explicit actions call fetchDevConsole directly
  }, [])

  function toggleAuditExpand(id: string) {
    setExpandedAudit((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function applySearch() {
    setInspectId(null)
    setOffset(0)
    void fetchDevConsole({ inspectId: null, offset: 0 })
  }

  function openInspect(id: string) {
    const nid = id.toLowerCase()
    setInspectId(nid)
    setGlobalQ("")
    setOffset(0)
    void fetchDevConsole({ inspectId: nid, offset: 0 })
  }

  function clearInspect() {
    setInspectId(null)
    void fetchDevConsole({ inspectId: null, offset: 0 })
  }

  const auditRows = data?.auditLogs?.rows ?? []
  const auditTotal = data?.auditLogs?.total ?? 0
  const agentRows = data?.agentActions?.rows ?? []
  const agentTotal = data?.agentActions?.total ?? 0

  if (capsOk === false) {
    return (
      <div className="space-y-4">
        <AdminPageHeader title="Developer console" description="Internal tooling for Braik operators." />
        <div className={adminUi.noticeMuted}>
          You need a legacy admin account or the{" "}
          <span className="font-mono text-admin-primary">platform_admin</span> platform role to use this console.
        </div>
        <Link href="/admin/overview" className={adminUi.link}>
          Back to overview
        </Link>
      </div>
    )
  }

  if (capsOk === null) {
    return <p className="text-sm font-medium text-admin-secondary">Checking access…</p>
  }

  return (
    <div className="flex min-h-0 flex-col gap-4 lg:flex-row lg:gap-6">
      <div className={cn(adminUi.panel, adminUi.panelPadding, "lg:w-[min(26rem,100%)] lg:shrink-0")}>
        <AdminPageHeader
          title="Developer console"
          description="Search by UUID or time. Indexed reads only — no arbitrary SQL."
        />

        <div className="mt-4 space-y-3">
          <label className={cn(adminUi.label, "flex flex-col gap-1")}>
            Global search
            <textarea
              value={globalQ}
              onChange={(e) => setGlobalQ(e.target.value)}
              placeholder={
                "UUID, partial UUID (8+ hex chars), ISO time, date range (2026-04-01 .. 2026-04-02), or leave empty for browse"
              }
              rows={3}
              disabled={Boolean(inspectId)}
              className={cn(adminUi.toolbarInput, "min-h-[72px] font-mono text-[12px]")}
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <button type="button" className={adminUi.btnPrimarySm} onClick={() => applySearch()} disabled={Boolean(inspectId)}>
              Run query
            </button>
            <button
              type="button"
              className={adminUi.btnSecondarySm}
              onClick={() => {
                setGlobalQ("")
                setInspectId(null)
                setOffset(0)
                setStartIso("")
                setEndIso("")
                setActionTypeFilter("")
                void fetchDevConsole({ inspectId: null, offset: 0 })
              }}
            >
              Reset
            </button>
          </div>

          <div className="border-t border-admin-border pt-3">
            <p className={adminUi.sectionTitle}>Filters</p>
            <div className="mt-2 grid gap-2">
              <label className={cn(adminUi.label, "flex flex-col gap-1")}>
                audit_logs.action_type
                <input
                  value={actionTypeFilter}
                  onChange={(e) => setActionTypeFilter(e.target.value)}
                  className={cn(adminUi.toolbarInput, "font-mono")}
                  placeholder="exact match"
                />
              </label>
              <label className={cn(adminUi.label, "flex flex-col gap-1")}>
                Start (ISO or local datetime)
                <input
                  value={startIso}
                  onChange={(e) => setStartIso(e.target.value)}
                  className={cn(adminUi.toolbarInput, "font-mono")}
                  placeholder="2026-04-01T00:00:00Z"
                />
              </label>
              <label className={cn(adminUi.label, "flex flex-col gap-1")}>
                End (ISO or local datetime)
                <input
                  value={endIso}
                  onChange={(e) => setEndIso(e.target.value)}
                  className={cn(adminUi.toolbarInput, "font-mono")}
                  placeholder="optional"
                />
              </label>
            </div>
          </div>

          <div className="border-t border-admin-border pt-3">
            <p className={adminUi.sectionTitle}>Tables</p>
            <div className="mt-2 grid gap-2">
              {TABLE_KEYS.map((k) => (
                <label key={k} className={adminUi.formCheckRow}>
                  <input
                    type="checkbox"
                    checked={tablesOn[k]}
                    onChange={(e) => setTablesOn((prev) => ({ ...prev, [k]: e.target.checked }))}
                  />
                  <span className="font-mono text-xs text-admin-primary">{k}</span>
                </label>
              ))}
            </div>
          </div>

          {inspectId ? (
            <div className={cn(adminUi.noticeInfo, "flex flex-wrap items-center justify-between gap-2")}>
              <span className="text-xs font-medium">
                Inspector: <span className="font-mono">{inspectId}</span>
              </span>
              <button type="button" className={adminUi.btnSecondarySm} onClick={() => clearInspect()}>
                Close inspector
              </button>
            </div>
          ) : null}

          {loading && <p className="text-xs font-medium text-admin-muted">Loading…</p>}
          {error && <p className="text-xs font-medium text-red-600">{error}</p>}
          {data?.browseWindowApplied ? (
            <p className={cn(adminUi.noticeMuted, "text-xs")}>Default window: last 30 days (no explicit range sent).</p>
          ) : null}
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
        <div className={cn(adminUi.panel, adminUi.panelPadding)}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={adminUi.sectionTitle}>Results</p>
            {data?.mode ? (
              <span className={cn(adminChip.neutral, "font-mono text-[10px] uppercase tracking-wide")}>
                mode: {data.mode}
              </span>
            ) : null}
          </div>

          {data?.entityHits && data.entityHits.length > 0 ? (
            <div className="mt-3 overflow-auto rounded-md border border-admin-border">
              <table className={cn(adminUi.table, "min-w-[520px]")}>
                <thead className={adminUi.thead}>
                  <tr>
                    <th className={adminUi.th}>Entity</th>
                    <th className={adminUi.th}>Summary</th>
                    <th className={adminUi.th} />
                  </tr>
                </thead>
                <tbody>
                  {data.entityHits.map((hit, idx) => {
                    const h = hit as {
                      source_table?: string
                      matched_column?: string
                      record_id?: string
                      entity_id?: string
                      label?: string
                      created_at?: string | null
                      record?: Record<string, unknown>
                      summary?: Record<string, unknown>
                    }
                    const id = String(h.record_id ?? h.entity_id ?? "")
                    const summary = h.summary ?? h.record ?? {}
                    return (
                      <tr key={`${id}-${idx}`} className={adminUi.tbodyRow}>
                        <td className={cn(adminUi.td, "font-mono text-xs")}>
                          <div>
                            {h.source_table ?? "—"}
                            {h.matched_column ? (
                              <span className="text-admin-muted">.{h.matched_column}</span>
                            ) : null}
                          </div>
                          {h.label ? (
                            <div className="mb-0.5 text-[11px] font-medium text-admin-secondary">{h.label}</div>
                          ) : null}
                          <IdCell value={id} />
                        </td>
                        <td className={cn(adminUi.td, "max-w-md font-mono text-[11px] text-admin-secondary")}>
                          {JSON.stringify(summary)}
                        </td>
                        <td className={cn(adminUi.td, "whitespace-nowrap")}>
                          <button type="button" className={adminUi.actionPill} onClick={() => openInspect(id)}>
                            Inspect
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={cn(adminUi.sectionSubtitle, "mt-2")}>No entity hits for this query.</p>
          )}
        </div>

        <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-5">
          <div className={cn(adminUi.panel, adminUi.panelPadding, "flex min-h-[320px] min-w-0 flex-col xl:col-span-3")}>
            <p className={adminUi.sectionTitle}>Audit log explorer</p>
            <div className={cn(adminUi.tableWrap, "mt-2 max-h-[min(52vh,560px)] flex-1")}>
              <table className={cn(adminUi.table, "min-w-[760px]")}>
                <thead className={adminUi.thead}>
                  <tr>
                    <th className={cn(adminUi.th, "w-8")} />
                    <th className={adminUi.th}>action_type</th>
                    <th className={adminUi.th}>actor_id</th>
                    <th className={adminUi.th}>target_type</th>
                    <th className={adminUi.th}>target_id</th>
                    <th className={adminUi.th}>created_at</th>
                  </tr>
                </thead>
                <tbody>
                  {auditRows.map((row) => {
                    const open = expandedAudit.has(row.id)
                    return (
                      <Fragment key={row.id}>
                        <tr className={adminUi.tbodyRow}>
                          <td className={adminUi.td}>
                            <button
                              type="button"
                              className={adminUi.tableActionBtn}
                              aria-expanded={open}
                              onClick={() => toggleAuditExpand(row.id)}
                            >
                              {open ? "−" : "+"}
                            </button>
                          </td>
                          <td className={cn(adminUi.td, "font-mono text-[11px]")}>{row.action_type}</td>
                          <td className={adminUi.td}>
                            <button
                              type="button"
                              className="text-left font-mono text-[11px] text-orange-700 underline-offset-2 hover:underline"
                              onClick={() => openInspect(row.actor_id)}
                            >
                              {row.actor_id}
                            </button>
                          </td>
                          <td className={cn(adminUi.td, "text-xs")}>{row.target_type ?? "—"}</td>
                          <td className={adminUi.td}>
                            {row.target_id ? (
                              <button
                                type="button"
                                className="text-left font-mono text-[11px] text-orange-700 underline-offset-2 hover:underline"
                                onClick={() => openInspect(row.target_id as string)}
                              >
                                {row.target_id}
                              </button>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className={cn(adminUi.td, "whitespace-nowrap font-mono text-[11px] text-admin-secondary")}>
                            {new Date(row.created_at).toISOString()}
                          </td>
                        </tr>
                        {open ? (
                          <tr className={adminUi.tbodyRow}>
                            <td className={adminUi.td} colSpan={6}>
                              <pre className={cn(adminUi.nestedRow, "max-h-48 overflow-auto font-mono text-[11px] text-admin-secondary")}>
                                {JSON.stringify(row.metadata_json ?? null, null, 2)}
                              </pre>
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-admin-secondary">
              <span>
                Showing {auditRows.length} of {auditTotal} (page offset {offset})
              </span>
              <span className="flex gap-2">
                <button
                  type="button"
                  className={adminUi.btnSecondarySm}
                  disabled={offset === 0 || loading}
                  onClick={() => {
                    const next = Math.max(0, offset - 50)
                    setOffset(next)
                    void fetchDevConsole({ offset: next })
                  }}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className={adminUi.btnSecondarySm}
                  disabled={loading || offset + auditRows.length >= auditTotal}
                  onClick={() => {
                    const next = offset + 50
                    setOffset(next)
                    void fetchDevConsole({ offset: next })
                  }}
                >
                  Next
                </button>
              </span>
            </div>
          </div>

          <div className={cn(adminUi.panel, adminUi.panelPadding, "flex min-h-[320px] flex-col xl:col-span-2")}>
            <div className="flex items-center justify-between gap-2">
              <p className={adminUi.sectionTitle}>Entity inspector</p>
              {inspectId ? <CopyText label="Copy UUID" text={inspectId} /> : null}
            </div>

            {data?.mode === "inspect" && data.primaryEntity?.record ? (
              <pre className={cn(adminUi.nestedRow, "mt-2 max-h-[min(40vh,420px)] flex-1 overflow-auto font-mono text-[11px]")}>
                {JSON.stringify(
                  {
                    source_table: data.primaryEntity.source_table,
                    ...data.primaryEntity.record,
                  },
                  null,
                  2
                )}
              </pre>
            ) : inspectId ? (
              <p className={cn(adminUi.sectionSubtitle, "mt-2")}>
                UUID not found as user, team, or subscription — audit and agent rows may still apply.
              </p>
            ) : (
              <p className={cn(adminUi.sectionSubtitle, "mt-2")}>
                Click <span className="font-semibold text-admin-primary">Inspect</span> on an entity hit or an audit id.
              </p>
            )}

            <div className="mt-4 border-t border-admin-border pt-3">
              <p className={cn(adminUi.sectionSubtitle, "mb-2")}>Agent actions ({agentTotal})</p>
              <div className={cn(adminUi.tableWrap, "max-h-[min(28vh,320px)]")}>
                <table className={cn(adminUi.table, "min-w-[520px]")}>
                  <thead className={adminUi.thead}>
                    <tr>
                      <th className={adminUi.th}>action_type</th>
                      <th className={adminUi.th}>user_id</th>
                      <th className={adminUi.th}>team_id</th>
                      <th className={adminUi.th}>executed_at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentRows.map((r) => (
                      <tr key={String(r.id)} className={adminUi.tbodyRow}>
                        <td className={cn(adminUi.td, "font-mono text-[11px]")}>{String(r.action_type ?? "")}</td>
                        <td className={adminUi.td}>
                          <button
                            type="button"
                            className="font-mono text-[11px] text-orange-700 underline-offset-2 hover:underline"
                            onClick={() => openInspect(String(r.user_id ?? ""))}
                          >
                            {String(r.user_id ?? "")}
                          </button>
                        </td>
                        <td className={adminUi.td}>
                          <button
                            type="button"
                            className="font-mono text-[11px] text-orange-700 underline-offset-2 hover:underline"
                            onClick={() => openInspect(String(r.team_id ?? ""))}
                          >
                            {String(r.team_id ?? "")}
                          </button>
                        </td>
                        <td className={cn(adminUi.td, "whitespace-nowrap font-mono text-[11px] text-admin-secondary")}>
                          {r.executed_at ? new Date(String(r.executed_at)).toISOString() : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {data?.creations && (data.creations.users?.length || data.creations.teams?.length) ? (
          <div className={cn(adminUi.panel, adminUi.panelPadding)}>
            <p className={adminUi.sectionTitle}>Recent creations (range)</p>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <div>
                <p className={adminUi.sectionSubtitle}>Users</p>
                <pre className={cn(adminUi.nestedRow, "mt-1 max-h-40 overflow-auto font-mono text-[11px]")}>
                  {JSON.stringify(data.creations.users ?? [], null, 2)}
                </pre>
              </div>
              <div>
                <p className={adminUi.sectionSubtitle}>Teams</p>
                <pre className={cn(adminUi.nestedRow, "mt-1 max-h-40 overflow-auto font-mono text-[11px]")}>
                  {JSON.stringify(data.creations.teams ?? [], null, 2)}
                </pre>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

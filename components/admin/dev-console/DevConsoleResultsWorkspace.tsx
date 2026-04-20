"use client"

import { Fragment, useEffect, useState } from "react"
import { adminUi } from "@/lib/admin/admin-ui"
import { cn } from "@/lib/utils"
import { DevConsoleCopyButton } from "./DevConsoleCopyButton"
import type { DevModel } from "@/lib/admin/dev-console-schema"

const panel = "rounded-xl border border-neutral-200 bg-white shadow-sm"

type AuditRow = {
  id: string
  action_type: string
  actor_id: string
  target_type: string | null
  target_id: string | null
  metadata_json: unknown
  created_at: string
}

export function DevConsoleResultsWorkspace(props: {
  loading: boolean
  error: string | null
  humanSummary: string
  requestId?: string
  failedScopes?: { scope: string; error_code: string; safe_message: string }[]
  warnings?: { message: string; scope?: string; code?: string }[]
  /** Legacy GET modes */
  legacyMode?: string
  browseWindowApplied?: boolean
  entityHits: unknown[]
  auditLogs: { rows: AuditRow[]; total: number }
  agentActions: { rows: Record<string, unknown>[]; total: number }
  creations?: { users: unknown[]; teams: unknown[] }
  /** Structured POST */
  structured?: {
    model: DevModel
    columns: string[]
    rows: Record<string, unknown>[]
    total: number
    humanSummary: string
  } | null
  offset: number
  onOffsetChange: (o: number) => void
  onOpenInspect: (uuid: string) => void
  onToggleAuditExpand?: (id: string) => void
  expandedAuditIds?: Set<string>
}) {
  const [selStructuredIdx, setSelStructuredIdx] = useState<number | null>(null)

  useEffect(() => {
    setSelStructuredIdx(null)
  }, [props.structured])

  const auditRows = props.auditLogs.rows
  const auditTotal = props.auditLogs.total

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
      <div className={cn(panel, "px-4 py-3")}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Results</p>
            {props.requestId ? (
              <p className="font-mono text-[10px] text-neutral-400">
                Request <span className="text-neutral-600">{props.requestId}</span>
              </p>
            ) : null}
            {props.failedScopes && props.failedScopes.length > 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-950">
                <p className="font-semibold">Some scopes did not load</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5">
                  {props.failedScopes.map((f, i) => (
                    <li key={`${f.scope}-${i}`}>
                      <span className="font-mono">{f.scope}</span> ({f.error_code}): {f.safe_message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {props.warnings && props.warnings.length > 0 ? (
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-[11px] text-neutral-800">
                {props.warnings.map((w, i) => (
                  <p key={i}>{w.scope ? `[${w.scope}] ` : ""}{w.message}</p>
                ))}
              </div>
            ) : null}
            <p className="text-sm font-medium leading-snug text-neutral-800">{props.humanSummary}</p>
            {props.browseWindowApplied ? (
              <p className="text-[11px] text-neutral-500">Default time window: last 30 days.</p>
            ) : null}
            {props.legacyMode ? (
              <span className="inline-block rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 font-mono text-[10px] text-neutral-600">
                {props.legacyMode}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {props.loading ? (
        <div className={cn(panel, "flex min-h-[200px] items-center justify-center py-16 text-sm font-medium text-neutral-500")}>
          Loading…
        </div>
      ) : null}

      {!props.loading && props.error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-900">{props.error}</div>
      ) : null}

      {!props.loading && !props.error && props.structured ? (
        <StructuredTable
          structured={props.structured}
          selectedIndex={selStructuredIdx}
          onSelectIndex={setSelStructuredIdx}
          onExportCsv={() => {
            const st = props.structured
            if (!st) return
            exportCsv(st.columns, st.rows)
          }}
        />
      ) : null}

      {!props.loading && !props.error && !props.structured ? (
        <>
          {!props.entityHits?.length &&
          !auditRows.length &&
          !(props.agentActions.rows ?? []).length &&
          !(props.creations?.users?.length || props.creations?.teams?.length) ? (
            <div className={cn(panel, adminUi.emptyState)}>
              <p className="font-semibold text-neutral-800">Nothing matched</p>
              <p className="mt-2 max-w-md text-[13px] leading-relaxed text-neutral-600">
                Try a user email, paste a UUID from logs, widen the date range, or switch to Advanced mode to browse a
                table with filters.
              </p>
            </div>
          ) : null}

          {props.entityHits && props.entityHits.length > 0 ? (
            <EntityHitsTable hits={props.entityHits} onInspect={props.onOpenInspect} />
          ) : null}

          {auditRows.length > 0 ? (
            <AuditTable
              rows={auditRows}
              total={auditTotal}
              offset={props.offset}
              onOffsetChange={props.onOffsetChange}
              onInspect={props.onOpenInspect}
              expanded={props.expandedAuditIds ?? new Set()}
              onToggleExpand={props.onToggleAuditExpand ?? (() => undefined)}
            />
          ) : null}

          {(props.agentActions.rows ?? []).length > 0 ? (
            <AgentTable rows={props.agentActions.rows} onInspect={props.onOpenInspect} />
          ) : null}

          {props.creations && (props.creations.users?.length || props.creations.teams?.length) ? (
            <CreationsPanel creations={props.creations} />
          ) : null}
        </>
      ) : null}

      {props.structured && selStructuredIdx != null && props.structured.rows[selStructuredIdx] ? (
        <div className={cn(panel, "p-4")}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-neutral-800">Selected row</p>
            <button type="button" className={adminUi.btnSecondarySm} onClick={() => setSelStructuredIdx(null)}>
              Clear
            </button>
          </div>
          <pre className="mt-2 max-h-48 overflow-auto rounded-lg border border-neutral-100 bg-neutral-50 p-2 font-mono text-[11px] text-neutral-800">
            {JSON.stringify(props.structured.rows[selStructuredIdx], null, 2)}
          </pre>
          {props.structured.columns.includes("id") ? (
            <div className="mt-2">
              <DevConsoleCopyButton
                text={String(props.structured.rows[selStructuredIdx].id ?? "")}
                label="Copy id"
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function StructuredTable(props: {
  structured: {
    model: DevModel
    columns: string[]
    rows: Record<string, unknown>[]
    total: number
    humanSummary: string
  }
  selectedIndex: number | null
  onSelectIndex: (i: number | null) => void
  onExportCsv: () => void
}) {
  const { columns, rows } = props.structured
  return (
    <div className={cn(panel, "overflow-hidden")}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-3 py-2">
        <p className="text-xs font-semibold text-neutral-800">
          {props.structured.model} <span className="text-neutral-500">({rows.length} of {props.structured.total})</span>
        </p>
        <button type="button" className={adminUi.btnSecondarySm} onClick={props.onExportCsv}>
          Export CSV
        </button>
      </div>
      <div className="max-h-[min(56vh,640px)] overflow-auto">
        <table className={cn(adminUi.table, "min-w-full")}>
          <thead className={cn(adminUi.thead, "sticky top-0 z-10 bg-white")}>
            <tr>
              {columns.map((c) => (
                <th key={c} className={adminUi.th}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className={cn(
                  adminUi.tbodyRow,
                  props.selectedIndex === i ? "bg-orange-50/80" : ""
                )}
                onClick={() => props.onSelectIndex(i)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") props.onSelectIndex(i)
                }}
                tabIndex={0}
                role="button"
              >
                {columns.map((col) => (
                  <td key={col} className={cn(adminUi.td, col.includes("id") || col.includes("at") ? "font-mono text-[11px]" : "text-[12px]")}>
                    {formatCell(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function formatCell(v: unknown): string {
  if (v == null) return "—"
  if (typeof v === "object") return JSON.stringify(v)
  return String(v)
}

function exportCsv(columns: string[], rows: Record<string, unknown>[]) {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`
  const head = columns.map(esc).join(",")
  const body = rows
    .map((r) => columns.map((c) => esc(formatCell(r[c]))).join(","))
    .join("\n")
  const blob = new Blob([`${head}\n${body}`], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `braik-dev-console-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function EntityHitsTable({ hits, onInspect }: { hits: unknown[]; onInspect: (id: string) => void }) {
  return (
    <div className={panel}>
      <p className="border-b border-neutral-100 px-3 py-2 text-xs font-semibold text-neutral-800">Matching entities</p>
      <div className="overflow-auto">
        <table className={adminUi.table}>
          <thead className={adminUi.thead}>
            <tr>
              <th className={adminUi.th}>Type</th>
              <th className={adminUi.th}>Matched</th>
              <th className={adminUi.th}>Label</th>
              <th className={adminUi.th}>Id</th>
              <th className={adminUi.th} />
            </tr>
          </thead>
          <tbody>
            {hits.map((hit, idx) => {
              const h = hit as Record<string, unknown>
              const id = String(h.record_id ?? h.entity_id ?? "")
              const matched = String(h.matched_column ?? h.matched_field ?? "")
              return (
                <tr key={`${id}-${idx}`} className={adminUi.tbodyRow}>
                  <td className={cn(adminUi.td, "text-xs font-medium")}>{String(h.source_table ?? "")}</td>
                  <td className={cn(adminUi.td, "font-mono text-[10px] text-neutral-500")}>{matched || "—"}</td>
                  <td className={cn(adminUi.td, "text-xs text-neutral-600")}>{String(h.label ?? "")}</td>
                  <td className={cn(adminUi.td, "font-mono text-[11px]")}>{id}</td>
                  <td className={adminUi.td}>
                    <button type="button" className={adminUi.actionPill} onClick={() => onInspect(id)}>
                      Open
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AuditTable(props: {
  rows: AuditRow[]
  total: number
  offset: number
  onOffsetChange: (o: number) => void
  onInspect: (id: string) => void
  expanded: Set<string>
  onToggleExpand: (id: string) => void
}) {
  return (
    <div className={panel}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 px-3 py-2">
        <p className="text-xs font-semibold text-neutral-800">Audit log</p>
        <span className="text-[11px] text-neutral-500">
          {props.rows.length} of {props.total} (offset {props.offset})
        </span>
      </div>
      <div className="max-h-[min(48vh,520px)] overflow-auto">
        <table className={cn(adminUi.table, "min-w-[760px]")}>
          <thead className={cn(adminUi.thead, "sticky top-0 z-10 bg-white")}>
            <tr>
              <th className={cn(adminUi.th, "w-8")} />
              <th className={adminUi.th}>action_type</th>
              <th className={adminUi.th}>actor_id</th>
              <th className={adminUi.th}>target_id</th>
              <th className={adminUi.th}>created_at</th>
            </tr>
          </thead>
          <tbody>
            {props.rows.map((row) => {
              const open = props.expanded.has(row.id)
              return (
                <Fragment key={row.id}>
                  <tr className={adminUi.tbodyRow}>
                    <td className={adminUi.td}>
                      <button type="button" className={adminUi.tableActionBtn} onClick={() => props.onToggleExpand(row.id)}>
                        {open ? "−" : "+"}
                      </button>
                    </td>
                    <td className={cn(adminUi.td, "font-mono text-[11px]")}>{row.action_type}</td>
                    <td className={adminUi.td}>
                      <button
                        type="button"
                        className="font-mono text-[11px] text-orange-700 underline-offset-2 hover:underline"
                        onClick={() => props.onInspect(row.actor_id)}
                      >
                        {row.actor_id}
                      </button>
                    </td>
                    <td className={adminUi.td}>
                      {row.target_id ? (
                        <button
                          type="button"
                          className="break-all text-left font-mono text-[11px] text-orange-700 underline-offset-2 hover:underline"
                          onClick={() => props.onInspect(String(row.target_id))}
                        >
                          {String(row.target_id)}
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={cn(adminUi.td, "whitespace-nowrap font-mono text-[11px] text-neutral-500")}>
                      {new Date(row.created_at).toISOString()}
                    </td>
                  </tr>
                  {open ? (
                    <tr className={adminUi.tbodyRow}>
                      <td colSpan={5} className={adminUi.td}>
                        <pre className="max-h-40 overflow-auto rounded-md border border-neutral-100 bg-neutral-50 p-2 font-mono text-[11px]">
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
      <div className="flex justify-end gap-2 border-t border-neutral-100 px-3 py-2">
        <button
          type="button"
          className={adminUi.btnSecondarySm}
          disabled={props.offset === 0}
          onClick={() => props.onOffsetChange(Math.max(0, props.offset - 50))}
        >
          Previous
        </button>
        <button
          type="button"
          className={adminUi.btnSecondarySm}
          disabled={props.offset + props.rows.length >= props.total}
          onClick={() => props.onOffsetChange(props.offset + 50)}
        >
          Next
        </button>
      </div>
    </div>
  )
}

function AgentTable({ rows, onInspect }: { rows: Record<string, unknown>[]; onInspect: (id: string) => void }) {
  return (
    <div className={panel}>
      <p className="border-b border-neutral-100 px-3 py-2 text-xs font-semibold text-neutral-800">Agent actions</p>
      <div className="max-h-[280px] overflow-auto">
        <table className={cn(adminUi.table, "min-w-[520px]")}>
          <thead className={cn(adminUi.thead, "sticky top-0 bg-white")}>
            <tr>
              <th className={adminUi.th}>action</th>
              <th className={adminUi.th}>user_id</th>
              <th className={adminUi.th}>team_id</th>
              <th className={adminUi.th}>executed_at</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r.id)} className={adminUi.tbodyRow}>
                <td className={cn(adminUi.td, "font-mono text-[11px]")}>{String(r.action_type ?? "")}</td>
                <td className={adminUi.td}>
                  <button
                    type="button"
                    className="font-mono text-[11px] text-orange-700 hover:underline"
                    onClick={() => onInspect(String(r.user_id ?? ""))}
                  >
                    {String(r.user_id ?? "")}
                  </button>
                </td>
                <td className={adminUi.td}>
                  <button
                    type="button"
                    className="font-mono text-[11px] text-orange-700 hover:underline"
                    onClick={() => onInspect(String(r.team_id ?? ""))}
                  >
                    {String(r.team_id ?? "")}
                  </button>
                </td>
                <td className={cn(adminUi.td, "font-mono text-[11px] text-neutral-500")}>
                  {r.executed_at ? new Date(String(r.executed_at)).toISOString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CreationsPanel({ creations }: { creations: { users: unknown[]; teams: unknown[] } }) {
  return (
    <div className={cn(panel, "p-3")}>
      <p className="text-xs font-semibold text-neutral-800">New users & teams (range)</p>
      <div className="mt-2 grid gap-3 md:grid-cols-2">
        <pre className="max-h-36 overflow-auto rounded-lg border border-neutral-100 bg-neutral-50 p-2 font-mono text-[11px]">
          {JSON.stringify(creations.users ?? [], null, 2)}
        </pre>
        <pre className="max-h-36 overflow-auto rounded-lg border border-neutral-100 bg-neutral-50 p-2 font-mono text-[11px]">
          {JSON.stringify(creations.teams ?? [], null, 2)}
        </pre>
      </div>
    </div>
  )
}

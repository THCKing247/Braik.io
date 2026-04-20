"use client"

import { adminUi } from "@/lib/admin/admin-ui"
import { cn } from "@/lib/utils"
import { DevConsoleCopyButton } from "./DevConsoleCopyButton"

export function DevConsoleRecordInspector(props: {
  open: boolean
  onClose: () => void
  inspectId: string | null
  loading: boolean
  primaryEntity: { source_table: string; record: Record<string, unknown> } | null
  auditRows: { id: string; action_type: string; created_at: string }[]
  agentRows: Record<string, unknown>[]
  onTraceUuid: () => void
  onAuditTimeline: () => void
}) {
  if (!props.open || !props.inspectId) return null

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-neutral-900/30 backdrop-blur-[1px]"
        aria-label="Close inspector"
        onClick={props.onClose}
      />
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-neutral-200 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-orange-600">Inspector</p>
            <p className="mt-1 break-all font-mono text-xs text-neutral-900">{props.inspectId}</p>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <DevConsoleCopyButton text={props.inspectId} label="Copy UUID" />
            <button type="button" className={adminUi.btnSecondarySm} onClick={props.onClose}>
              Close
            </button>
          </div>
        </div>

        <div className="flex gap-2 border-b border-neutral-100 px-4 py-2">
          <button type="button" className={adminUi.btnSecondarySm} onClick={props.onTraceUuid}>
            Trace this UUID everywhere
          </button>
          <button type="button" className={adminUi.btnSecondarySm} onClick={props.onAuditTimeline}>
            Open audit timeline
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {props.loading ? (
            <p className="text-sm text-neutral-500">Loading record…</p>
          ) : props.primaryEntity ? (
            <pre className="rounded-lg border border-neutral-100 bg-neutral-50 p-3 font-mono text-[11px] leading-relaxed text-neutral-900">
              {JSON.stringify(
                { source_table: props.primaryEntity.source_table, ...props.primaryEntity.record },
                null,
                2
              )}
            </pre>
          ) : (
            <p className="text-sm text-neutral-600">
              No direct user / team / subscription row for this id. Related activity may still appear below.
            </p>
          )}

          <div className="mt-6">
            <p className="text-xs font-semibold text-neutral-800">Related audit ({props.auditRows.length} shown)</p>
            <ul className="mt-2 space-y-1.5 text-[11px] text-neutral-700">
              {props.auditRows.slice(0, 12).map((r) => (
                <li key={r.id} className="rounded-md border border-neutral-100 bg-white px-2 py-1.5 font-mono">
                  <span className="text-neutral-500">{new Date(r.created_at).toLocaleString()}</span>{" "}
                  <span className="font-semibold text-neutral-900">{r.action_type}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6">
            <p className="text-xs font-semibold text-neutral-800">Agent actions ({props.agentRows.length} shown)</p>
            <ul className="mt-2 space-y-1.5 text-[11px] text-neutral-700">
              {props.agentRows.slice(0, 10).map((r) => (
                <li key={String(r.id)} className="rounded-md border border-neutral-100 bg-white px-2 py-1.5 font-mono">
                  {String(r.action_type ?? "")}{" "}
                  <span className="text-neutral-500">
                    {r.executed_at ? new Date(String(r.executed_at)).toLocaleString() : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>
    </>
  )
}

"use client"

import {
  DEV_CONSOLE_MODELS,
  type DevModel,
  type FilterOperator,
} from "@/lib/admin/dev-console-schema"
import { getFieldSpec } from "@/lib/admin/dev-console-schema"
import {
  type FilterConditionNode,
  type FilterGroupNode,
  newConditionRow,
} from "@/lib/admin/dev-console-structured-query"
import { adminUi } from "@/lib/admin/admin-ui"
import { cn } from "@/lib/utils"

const SIMPLE_TABLES = ["users", "teams", "subscriptions", "audit_logs", "agent_actions", "creations"] as const

function removeNodeById(root: FilterGroupNode, id: string): FilterGroupNode {
  return {
    ...root,
    children: root.children
      .filter((ch) => !(ch.kind === "condition" && ch.id === id))
      .map((ch) => (ch.kind === "group" ? removeNodeById(ch as FilterGroupNode, id) : ch)),
  }
}

function updateConditionById(
  root: FilterGroupNode,
  id: string,
  patch: Partial<FilterConditionNode>
): FilterGroupNode {
  const mapNode = (node: FilterConditionNode | FilterGroupNode): FilterConditionNode | FilterGroupNode => {
    if (node.kind === "condition") {
      if (node.id === id) return { ...node, ...patch }
      return node
    }
    return {
      ...node,
      children: node.children.map((ch) => mapNode(ch as FilterConditionNode | FilterGroupNode)),
    } as FilterGroupNode
  }
  return mapNode(root) as FilterGroupNode
}

export function DevConsoleQueryBuilder(props: {
  advanced: boolean
  model: DevModel
  onModelChange: (m: DevModel) => void
  limit: number
  onLimitChange: (n: number) => void
  dateStart: string
  dateEnd: string
  onDateStart: (v: string) => void
  onDateEnd: (v: string) => void
  filterRoot: FilterGroupNode
  onFilterRootChange: (r: FilterGroupNode) => void
  simpleTables: Record<(typeof SIMPLE_TABLES)[number], boolean>
  onSimpleTablesChange: (t: Record<(typeof SIMPLE_TABLES)[number], boolean>) => void
  actionType: string
  onActionType: (v: string) => void
}) {
  const catalog = DEV_CONSOLE_MODELS.find((m) => m.id === props.model)

  const addCondition = () => {
    props.onFilterRootChange({
      ...props.filterRoot,
      children: [...props.filterRoot.children, newConditionRow(props.model)],
    })
  }

  const addOrGroup = () => {
    const a = newConditionRow(props.model)
    const b = newConditionRow(props.model)
    const group: FilterGroupNode = {
      kind: "group",
      id: `g-${Date.now()}`,
      op: "or",
      children: [a, b],
    }
    props.onFilterRootChange({
      ...props.filterRoot,
      children: [...props.filterRoot.children, group],
    })
  }

  return (
    <div className={cn(adminUi.panel, "space-y-4 rounded-xl border-neutral-200 bg-white p-4 shadow-sm")}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Query builder</p>
        <p className="mt-1 text-[11px] leading-snug text-neutral-600">
          Build your filters, then use <span className="font-semibold text-neutral-800">Run query</span> below.
        </p>
      </div>

      {!props.advanced ? (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-neutral-700">Data scope</p>
          <div className="grid gap-1.5">
            {SIMPLE_TABLES.map((k) => (
              <label key={k} className="flex items-center gap-2 text-[11px] font-medium text-neutral-800">
                <input
                  type="checkbox"
                  checked={props.simpleTables[k]}
                  onChange={(e) =>
                    props.onSimpleTablesChange({ ...props.simpleTables, [k]: e.target.checked })
                  }
                  className="rounded border-neutral-300"
                />
                <span className="font-mono">{k}</span>
              </label>
            ))}
          </div>
          <label className={cn(adminUi.label, "mt-2")}>
            Audit action type (optional)
            <input
              value={props.actionType}
              onChange={(e) => props.onActionType(e.target.value)}
              className={cn(adminUi.input, "font-mono text-xs")}
              placeholder="exact match on audit_logs.action_type"
            />
          </label>
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={adminUi.label}>
              Model
              <select
                value={props.model}
                onChange={(e) => props.onModelChange(e.target.value as DevModel)}
                className={adminUi.select}
              >
                {DEV_CONSOLE_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={adminUi.label}>
              Row limit
              <select
                value={props.limit}
                onChange={(e) => props.onLimitChange(Number(e.target.value))}
                className={adminUi.select}
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className={adminUi.label}>
              Start (ISO or datetime)
              <input
                value={props.dateStart}
                onChange={(e) => props.onDateStart(e.target.value)}
                className={cn(adminUi.input, "font-mono text-xs")}
                placeholder="optional — filters row time"
              />
            </label>
            <label className={adminUi.label}>
              End (ISO or datetime)
              <input
                value={props.dateEnd}
                onChange={(e) => props.onDateEnd(e.target.value)}
                className={cn(adminUi.input, "font-mono text-xs")}
                placeholder="optional"
              />
            </label>
          </div>

          <div className="space-y-2 border-t border-neutral-100 pt-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-semibold text-neutral-800">Filters</p>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" className={adminUi.btnSecondarySm} onClick={addCondition}>
                  + Condition
                </button>
                <button type="button" className={adminUi.btnSecondarySm} onClick={addOrGroup}>
                  + OR group
                </button>
              </div>
            </div>
            <p className="text-[10px] text-neutral-500">
              Root combines conditions with <strong>AND</strong>. OR groups match any branch inside the group.
            </p>

            <div className="space-y-2">
              {props.filterRoot.children.map((child) => (
                <FilterChildEditor
                  key={child.kind === "condition" ? child.id : (child as FilterGroupNode).id}
                  node={child}
                  model={props.model}
                  onPatchCondition={(id, patch) =>
                    props.onFilterRootChange(updateConditionById(props.filterRoot, id, patch))
                  }
                  onRemove={(id) => props.onFilterRootChange(removeNodeById(props.filterRoot, id))}
                  onReplaceGroup={(gid, nextGroup) => {
                    props.onFilterRootChange({
                      ...props.filterRoot,
                      children: props.filterRoot.children.map((ch) =>
                        ch.kind === "group" && (ch as FilterGroupNode).id === gid ? nextGroup : ch
                      ),
                    })
                  }}
                />
              ))}
              {props.filterRoot.children.length === 0 ? (
                <p className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-3 py-4 text-center text-[11px] text-neutral-500">
                  No filters — all rows (within limit and date bounds) will be returned.
                </p>
              ) : null}
            </div>
          </div>
        </>
      )}

      {!props.advanced && catalog ? (
        <p className="text-[10px] text-neutral-500">
          Tip: choose <span className="font-semibold">Advanced mode</span> to browse {catalog.label} with field
          conditions.
        </p>
      ) : null}
    </div>
  )
}

function FilterChildEditor(props: {
  node: FilterConditionNode | FilterGroupNode
  model: DevModel
  onPatchCondition: (id: string, patch: Partial<FilterConditionNode>) => void
  onRemove: (id: string) => void
  onReplaceGroup: (id: string, g: FilterGroupNode) => void
}) {
  if (props.node.kind === "condition") {
    return (
      <ConditionRow
        c={props.node}
        model={props.model}
        onChange={(patch) => props.onPatchCondition(props.node.id, patch)}
        onRemove={() => props.onRemove(props.node.id)}
      />
    )
  }

  const g = props.node as FilterGroupNode
  return (
    <div className="rounded-lg border border-orange-100 bg-orange-50/40 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wide text-orange-800">Or group</span>
        <button
          type="button"
          className={cn(adminUi.btnSecondarySm, "text-[10px]")}
          onClick={() => props.onRemove(g.id)}
        >
          Remove group
        </button>
      </div>
      <div className="space-y-2">
        {g.children.map((ch) =>
          ch.kind === "condition" ? (
            <ConditionRow
              key={ch.id}
              c={ch}
              model={props.model}
              onChange={(patch) => {
                const next: FilterGroupNode = {
                  ...g,
                  children: g.children.map((x) =>
                    x.kind === "condition" && x.id === ch.id ? { ...x, ...patch } : x
                  ),
                }
                props.onReplaceGroup(g.id, next)
              }}
              onRemove={() => {
                const next: FilterGroupNode = {
                  ...g,
                  children: g.children.filter((x) => !(x.kind === "condition" && x.id === ch.id)),
                }
                props.onReplaceGroup(g.id, next)
              }}
            />
          ) : null
        )}
      </div>
    </div>
  )
}

function operatorLabel(op: FilterOperator): string {
  switch (op) {
    case "eq":
      return "equals"
    case "contains":
      return "contains"
    case "starts_with":
      return "starts with"
    case "gte":
      return "on or after"
    case "lte":
      return "on or before"
    default:
      return op
  }
}

function ConditionRow(props: {
  c: FilterConditionNode
  model: DevModel
  onChange: (patch: Partial<FilterConditionNode>) => void
  onRemove: () => void
}) {
  const spec = getFieldSpec(props.model, props.c.field)
  const fields = DEV_CONSOLE_MODELS.find((m) => m.id === props.model)?.fields ?? []
  const ops = spec?.operators ?? (["eq"] as FilterOperator[])

  return (
    <div className="flex flex-wrap items-end gap-2 rounded-md border border-neutral-200 bg-white p-2">
      <label className={cn(adminUi.label, "min-w-[100px] flex-1")}>
        Field
        <select
          value={props.c.field}
          onChange={(e) => props.onChange({ field: e.target.value })}
          className={cn(adminUi.select, "text-xs")}
        >
          {fields.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </label>
      <label className={cn(adminUi.label, "w-[120px]")}>
        Operator
        <select
          value={props.c.operator}
          onChange={(e) => props.onChange({ operator: e.target.value as FilterOperator })}
          className={cn(adminUi.select, "text-xs")}
        >
          {ops.map((o) => (
            <option key={o} value={o}>
              {operatorLabel(o)}
            </option>
          ))}
        </select>
      </label>
      <label className={cn(adminUi.label, "min-w-[120px] flex-[2]")}>
        Value
        <input
          value={props.c.value}
          onChange={(e) => props.onChange({ value: e.target.value })}
          className={cn(adminUi.input, "font-mono text-xs")}
        />
      </label>
      <button type="button" className={cn(adminUi.btnDangerSm, "mb-0.5")} onClick={props.onRemove}>
        Remove
      </button>
    </div>
  )
}

"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import type { DevModel } from "@/lib/admin/dev-console-schema"
import { emptyFilterRoot, type FilterGroupNode } from "@/lib/admin/dev-console-structured-query"
import { DevConsoleHeader, type DevConsolePanelMode } from "./DevConsoleHeader"
import { summarizeDraft } from "./DevConsoleHumanSummary"
import { DevConsolePresetBar } from "./DevConsolePresetBar"
import { DevConsoleQueryBuilder } from "./DevConsoleQueryBuilder"
import { DevConsoleRecordInspector } from "./DevConsoleRecordInspector"
import { DevConsoleResultsWorkspace } from "./DevConsoleResultsWorkspace"
import { DevConsoleSchemaPanel } from "./DevConsoleSchemaPanel"
import {
  loadPresets,
  loadRecentSearches,
  pushRecentSearch,
  type SavedPreset,
  savePresets,
} from "./dev-console-storage"
import { adminUi } from "@/lib/admin/admin-ui"
import { cn } from "@/lib/utils"

type LegacyOk = {
  ok: true
  request_id?: string
  mode: string
  browseWindowApplied?: boolean
  inspectId?: string
  primaryEntity?: { source_table: string; record: Record<string, unknown> } | null
  failed_scopes?: { scope: string; error_code: string; safe_message: string }[]
  warnings?: { message: string; scope?: string; code?: string }[]
  query_summary?: { normalized_query?: string; normalized_query_type?: string }
  entityHits: unknown[]
  auditLogs: {
    rows: {
      id: string
      action_type: string
      actor_id: string
      target_type: string | null
      target_id: string | null
      metadata_json: unknown
      created_at: string
      team_id: string | null
    }[]
    total: number
  }
  agentActions: { rows: Record<string, unknown>[]; total: number }
  creations?: { users: unknown[]; teams: unknown[] }
}

type StructuredOk = {
  ok: true
  mode: "structured"
  model: DevModel
  columns: string[]
  rows: Record<string, unknown>[]
  total: number
  humanSummary: string
}

type InspectPayload = LegacyOk | null

const TABLE_KEYS = ["users", "teams", "subscriptions", "audit_logs", "agent_actions", "creations"] as const

function tablesToParam(t: Record<(typeof TABLE_KEYS)[number], boolean>): string {
  const keys = TABLE_KEYS.filter((k) => t[k])
  if (keys.length === TABLE_KEYS.length) return ""
  return keys.join(",")
}

function parseTablesParam(raw: string | null): Record<(typeof TABLE_KEYS)[number], boolean> {
  const base = TABLE_KEYS.reduce((acc, k) => ({ ...acc, [k]: true }), {} as Record<(typeof TABLE_KEYS)[number], boolean>)
  if (!raw?.trim()) return base
  const set = new Set(raw.split(",").map((s) => s.trim()))
  TABLE_KEYS.forEach((k) => {
    base[k] = set.has(k)
  })
  return base
}

export function DevConsoleApp() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [capsOk, setCapsOk] = useState<boolean | null>(null)

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

  const [panelMode, setPanelMode] = useState<DevConsolePanelMode>("global")
  const advanced = panelMode === "structured"
  const [quickSearch, setQuickSearch] = useState("")
  const [model, setModel] = useState<DevModel>("users")
  const [limit, setLimit] = useState(50)
  const [filterRoot, setFilterRoot] = useState<FilterGroupNode>(() => emptyFilterRoot())
  const [simpleTables, setSimpleTables] = useState<Record<(typeof TABLE_KEYS)[number], boolean>>(() =>
    TABLE_KEYS.reduce((acc, k) => ({ ...acc, [k]: true }), {} as Record<(typeof TABLE_KEYS)[number], boolean>)
  )
  const [actionType, setActionType] = useState("")
  const [dateStart, setDateStart] = useState("")
  const [dateEnd, setDateEnd] = useState("")
  const [offset, setOffset] = useState(0)

  const [inspectId, setInspectId] = useState<string | null>(null)
  const [inspectorOpen, setInspectorOpen] = useState(false)

  const [legacyData, setLegacyData] = useState<LegacyOk | null>(null)
  const [structuredData, setStructuredData] = useState<StructuredOk | null>(null)
  const [runKind, setRunKind] = useState<"legacy" | "structured" | null>(null)

  const [inspectPayload, setInspectPayload] = useState<InspectPayload>(null)
  const [inspectLoading, setInspectLoading] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedAudit, setExpandedAudit] = useState<Set<string>>(() => new Set())

  const [presets, setPresets] = useState<SavedPreset[]>([])
  const [recent, setRecent] = useState<string[]>([])

  /** Hydrate from URL once */
  useEffect(() => {
    const q = searchParams.get("q") ?? ""
    const adv = searchParams.get("adv") === "1"
    const modeUrl = searchParams.get("mode")
    const m = (searchParams.get("model") as DevModel | null) ?? "users"
    const lim = Number(searchParams.get("lim") ?? "50") || 50
    const st = searchParams.get("st") ?? ""
    const en = searchParams.get("en") ?? ""
    const at = searchParams.get("at") ?? ""
    const tbl = searchParams.get("tbl")
    const off = Number(searchParams.get("off") ?? "0") || 0
    const ins = searchParams.get("ins") ?? ""

    setQuickSearch(q)
    if (adv) setPanelMode("structured")
    else if (modeUrl === "trace") setPanelMode("trace")
    else setPanelMode("global")
    if (["users", "teams", "subscriptions", "audit_logs", "agent_actions"].includes(m)) setModel(m)
    setLimit(Math.min(100, Math.max(25, lim)))
    setDateStart(st)
    setDateEnd(en)
    setActionType(at)
    setSimpleTables(parseTablesParam(tbl))
    setOffset(off)
    if (ins.trim()) {
      setInspectId(ins.trim().toLowerCase())
      setInspectorOpen(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- URL → state hydration once on mount
  }, [])

  useEffect(() => {
    setPresets(loadPresets())
    setRecent(loadRecentSearches())
  }, [])

  const syncUrl = useCallback(() => {
    const p = new URLSearchParams()
    if (quickSearch.trim()) p.set("q", quickSearch.trim())
    if (advanced) p.set("adv", "1")
    if (panelMode === "trace") p.set("mode", "trace")
    p.set("model", model)
    p.set("lim", String(limit))
    if (dateStart.trim()) p.set("st", dateStart.trim())
    if (dateEnd.trim()) p.set("en", dateEnd.trim())
    if (actionType.trim()) p.set("at", actionType.trim())
    const tbl = tablesToParam(simpleTables)
    if (tbl) p.set("tbl", tbl)
    p.set("off", String(offset))
    if (inspectId) p.set("ins", inspectId)
    router.replace(`${pathname}?${p.toString()}`, { scroll: false })
  }, [
    pathname,
    router,
    quickSearch,
    advanced,
    panelMode,
    model,
    limit,
    dateStart,
    dateEnd,
    actionType,
    simpleTables,
    offset,
    inspectId,
  ])

  const fetchLegacy = useCallback(
    async (opts?: { offset?: number; inspect?: string | null }) => {
      const effOff = opts?.offset ?? offset
      const effInspect = opts?.inspect !== undefined ? opts.inspect : inspectId

      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        const ins = effInspect ?? ""
        if (ins) params.set("inspect", ins)
        else if (quickSearch.trim()) params.set("q", quickSearch.trim())
        if (actionType.trim()) params.set("actionType", actionType.trim())
        const tp = tablesToParam(simpleTables)
        if (tp) params.set("tables", tp)
        if (panelMode === "trace") params.set("mode", "trace")
        if (dateStart.trim()) {
          const t = new Date(dateStart.trim())
          if (!Number.isNaN(t.getTime())) params.set("start", t.toISOString())
        }
        if (dateEnd.trim()) {
          const t = new Date(dateEnd.trim())
          if (!Number.isNaN(t.getTime())) params.set("end", t.toISOString())
        }
        params.set("offset", String(effOff))
        params.set("limit", String(limit))

        const res = await fetch(`/api/admin/dev-console?${params.toString()}`, {
          credentials: "include",
          cache: "no-store",
        })
        const json = (await res.json()) as LegacyOk | { ok: false; safe_message?: string; error?: string }
        if (!res.ok) {
          const msg =
            "safe_message" in json && json.safe_message
              ? String(json.safe_message)
              : "error" in json && json.error
                ? String(json.error)
                : `Failed (${res.status})`
          throw new Error(msg)
        }
        if (!("ok" in json) || !json.ok) {
          const msg = "safe_message" in json && json.safe_message ? String(json.safe_message) : "Bad response"
          throw new Error(msg)
        }
        setLegacyData(json)
        setStructuredData(null)
        setRunKind("legacy")
        pushRecentSearch(ins ? `inspect:${ins}` : quickSearch.trim() || "browse")
        setRecent(loadRecentSearches())
        syncUrl()
      } catch (e) {
        setError(e instanceof Error ? e.message : "Request failed")
        setLegacyData(null)
      } finally {
        setLoading(false)
      }
    },
    [
      offset,
      inspectId,
      quickSearch,
      actionType,
      simpleTables,
      dateStart,
      dateEnd,
      limit,
      syncUrl,
      panelMode,
    ]
  )

  const fetchStructured = useCallback(async (overrideOffset?: number) => {
    setLoading(true)
    setError(null)
    try {
      const effOffset = overrideOffset ?? offset
      const body = {
        model,
        limit,
        offset: effOffset,
        dateStart: dateStart.trim() || null,
        dateEnd: dateEnd.trim() || null,
        root: filterRoot,
      }

      const res = await fetch("/api/admin/dev-console", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = (await res.json()) as StructuredOk | { ok: false; safe_message?: string; error?: string; error_code?: string }
      if (!res.ok) {
        const msg =
          "safe_message" in json && json.safe_message
            ? String(json.safe_message)
            : "error" in json && json.error
              ? String(json.error)
              : `Failed (${res.status})`
        throw new Error(msg)
      }
      if (!("ok" in json) || !json.ok) {
        const code = "error_code" in json && json.error_code ? String(json.error_code) : "ERR"
        const msg = "safe_message" in json && json.safe_message ? String(json.safe_message) : "Structured query failed"
        throw new Error(`${code}: ${msg}`)
      }

      const okBody = json as StructuredOk
      setStructuredData(okBody)
      setLegacyData(null)
      setRunKind("structured")
      pushRecentSearch(`structured:${model}`)
      setRecent(loadRecentSearches())
      syncUrl()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Structured query failed")
      setStructuredData(null)
    } finally {
      setLoading(false)
    }
  }, [model, limit, offset, dateStart, dateEnd, filterRoot, syncUrl])

  useEffect(() => {
    if (!inspectId || !inspectorOpen) {
      setInspectPayload(null)
      return
    }
    let cancelled = false
    setInspectLoading(true)
    void (async () => {
      try {
        const p = new URLSearchParams()
        p.set("inspect", inspectId)
        if (actionType.trim()) p.set("actionType", actionType.trim())
        if (dateStart.trim()) {
          const t = new Date(dateStart.trim())
          if (!Number.isNaN(t.getTime())) p.set("start", t.toISOString())
        }
        if (dateEnd.trim()) {
          const t = new Date(dateEnd.trim())
          if (!Number.isNaN(t.getTime())) p.set("end", t.toISOString())
        }
        p.set("limit", "50")
        const res = await fetch(`/api/admin/dev-console?${p.toString()}`, { credentials: "include" })
        const json = (await res.json()) as LegacyOk | { ok: false }
        if (!cancelled && json.ok) setInspectPayload(json)
      } catch {
        if (!cancelled) setInspectPayload(null)
      } finally {
        if (!cancelled) setInspectLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [inspectId, inspectorOpen, actionType, dateStart, dateEnd])

  const draftSummary = useMemo(
    () => summarizeDraft({ advanced, model, quickSearch, dateStart, dateEnd, actionType }),
    [advanced, model, quickSearch, dateStart, dateEnd, actionType]
  )

  const displaySummary =
    runKind === "structured" && structuredData
      ? structuredData.humanSummary
      : legacyData?.browseWindowApplied
        ? `${draftSummary} Default time window applied.`
        : draftSummary

  const validationError = useMemo(() => {
    if (!advanced) return null
    for (const ch of filterRoot.children) {
      if (ch.kind !== "condition") continue
      if (!ch.value.trim()) return "Each filter needs a value (or remove empty rows)."
    }
    return null
  }, [advanced, filterRoot])

  function handleRunQuery() {
    setError(null)
    setInspectId(null)
    setInspectorOpen(false)
    setOffset(0)

    if (advanced) {
      if (validationError) {
        setError(validationError)
        return
      }
      void fetchStructured(0)
      return
    }

    void fetchLegacy({ offset: 0, inspect: null })
  }

  function handleQuickSearchOnly() {
    setPanelMode("global")
    setOffset(0)
    setInspectId(null)
    void fetchLegacy({ offset: 0, inspect: null })
  }

  function openInspect(id: string) {
    const nid = id.toLowerCase()
    setInspectId(nid)
    setInspectorOpen(true)
    const p = new URLSearchParams(searchParams.toString())
    p.set("ins", nid)
    router.replace(`${pathname}?${p.toString()}`, { scroll: false })
  }

  function handlePresetChip(key: string) {
    const today = new Date()
    const startDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
    const endDay = new Date(startDay.getTime() + 86400000 - 1)

    if (key === "audit_today") {
      setPanelMode("global")
      setDateStart(startDay.toISOString())
      setDateEnd(endDay.toISOString())
      setSimpleTables({
        ...simpleTables,
        audit_logs: true,
        agent_actions: false,
        creations: false,
      })
      setQuickSearch("")
      setActionType("")
      return
    }

    if (key === "user_email") {
      setPanelMode("global")
      setQuickSearch("")
      window.setTimeout(() => {
        document.querySelector<HTMLInputElement>("header input.font-mono")?.focus()
      }, 0)
      return
    }

    if (key === "uuid_trace") {
      setPanelMode("trace")
      setQuickSearch("")
      return
    }

    if (key === "team_activity") {
      setPanelMode("structured")
      setModel("agent_actions")
      setFilterRoot(emptyFilterRoot())
      setDateStart(new Date(Date.now() - 7 * 86400000).toISOString())
      setDateEnd(new Date().toISOString())
      return
    }

    if (key === "status_search") {
      setPanelMode("global")
      setQuickSearch("inactive")
      setSimpleTables({
        ...simpleTables,
        users: true,
        teams: true,
        audit_logs: true,
      })
      return
    }
  }

  function handleSavePreset() {
    const name = window.prompt("Preset name")
    if (!name?.trim()) return
    const snapshot = JSON.stringify({
      panelMode,
      quickSearch,
      model,
      limit,
      filterRoot,
      simpleTables,
      actionType,
      dateStart,
      dateEnd,
    })
    const next = [...presets, { id: crypto.randomUUID(), name: name.trim(), snapshot, savedAt: new Date().toISOString() }]
    setPresets(next)
    savePresets(next)
  }

  function handleLoadPreset(id: string) {
    const pr = presets.find((p) => p.id === id)
    if (!pr) return
    try {
      const s = JSON.parse(pr.snapshot) as Partial<{
        panelMode?: DevConsolePanelMode
        advanced?: boolean
        quickSearch: string
        model: DevModel
        limit: number
        filterRoot: FilterGroupNode
        simpleTables: Record<(typeof TABLE_KEYS)[number], boolean>
        actionType: string
        dateStart: string
        dateEnd: string
      }>
      if (s.panelMode === "global" || s.panelMode === "structured" || s.panelMode === "trace") setPanelMode(s.panelMode)
      else if (typeof s.advanced === "boolean") setPanelMode(s.advanced ? "structured" : "global")
      if (typeof s.quickSearch === "string") setQuickSearch(s.quickSearch)
      if (s.model && ["users", "teams", "subscriptions", "audit_logs", "agent_actions"].includes(s.model)) setModel(s.model)
      if (typeof s.limit === "number") setLimit(s.limit)
      if (s.filterRoot) setFilterRoot(s.filterRoot)
      if (s.simpleTables) setSimpleTables({ ...simpleTables, ...s.simpleTables })
      if (typeof s.actionType === "string") setActionType(s.actionType)
      if (typeof s.dateStart === "string") setDateStart(s.dateStart)
      if (typeof s.dateEnd === "string") setDateEnd(s.dateEnd)
    } catch {
      /* ignore */
    }
  }

  function handleShareLink() {
    syncUrl()
    void navigator.clipboard.writeText(window.location.href)
    window.alert("Copied link with current filters to clipboard.")
  }

  if (capsOk === false) {
    return (
      <div className="mx-auto max-w-lg space-y-4 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-neutral-900">Dev Console</h1>
        <p className="text-sm text-neutral-600">
          You need a legacy admin account or the <span className="font-mono">platform_admin</span> role.
        </p>
        <Link href="/admin/overview" className={adminUi.link}>
          Back to overview
        </Link>
      </div>
    )
  }

  if (capsOk === null) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white px-6 py-12 text-center text-sm font-medium text-neutral-500 shadow-sm">
        Checking access…
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-[1680px] flex-col gap-4 px-3 pb-14 pt-4 sm:px-4 lg:gap-5">
      <DevConsoleHeader
        quickSearch={quickSearch}
        onQuickSearchChange={setQuickSearch}
        onQuickSearchRun={() => handleQuickSearchOnly()}
        panelMode={panelMode}
        onPanelModeChange={(m) => {
          setPanelMode(m)
          if (m !== "structured") setStructuredData(null)
        }}
        onShareLink={handleShareLink}
        disabledSearch={Boolean(inspectId)}
      />

      <DevConsolePresetBar
        presets={presets.map((p) => ({ id: p.id, name: p.name }))}
        recent={recent}
        onChip={handlePresetChip}
        onSavePreset={handleSavePreset}
        onLoadPreset={handleLoadPreset}
      />

      <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[380px_minmax(0,1fr)_280px] xl:items-start xl:gap-5">
        <div className="flex min-h-0 flex-col gap-4">
          <DevConsoleQueryBuilder
            advanced={advanced}
            model={model}
            onModelChange={setModel}
            limit={limit}
            onLimitChange={setLimit}
            dateStart={dateStart}
            dateEnd={dateEnd}
            onDateStart={setDateStart}
            onDateEnd={setDateEnd}
            filterRoot={filterRoot}
            onFilterRootChange={setFilterRoot}
            simpleTables={simpleTables}
            onSimpleTablesChange={setSimpleTables}
            actionType={actionType}
            onActionType={setActionType}
          />

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
            <button type="button" className={adminUi.btnPrimary} onClick={handleRunQuery}>
              Run query
            </button>
            <button
              type="button"
              className={adminUi.btnSecondarySm}
              onClick={() => {
                setQuickSearch("")
                setPanelMode("global")
                setFilterRoot(emptyFilterRoot())
                setOffset(0)
                setInspectId(null)
                setStructuredData(null)
                setLegacyData(null)
                setRunKind(null)
                setActionType("")
                setDateStart("")
                setDateEnd("")
                router.replace(pathname)
              }}
            >
              Reset all
            </button>
            {validationError ? <span className="text-xs font-medium text-red-600">{validationError}</span> : null}
            {error ? <span className="text-xs font-medium text-red-600">{error}</span> : null}
          </div>
        </div>

        <DevConsoleResultsWorkspace
          loading={loading}
          error={error && !validationError ? error : null}
          humanSummary={displaySummary}
          legacyMode={legacyData?.mode}
          browseWindowApplied={legacyData?.browseWindowApplied}
          requestId={legacyData?.request_id}
          failedScopes={legacyData?.failed_scopes}
          warnings={legacyData?.warnings}
          entityHits={(legacyData?.entityHits ?? []) as unknown[]}
          auditLogs={legacyData?.auditLogs ?? { rows: [], total: 0 }}
          agentActions={legacyData?.agentActions ?? { rows: [], total: 0 }}
          creations={legacyData?.creations}
          structured={runKind === "structured" && structuredData ? structuredData : null}
          offset={offset}
          onOffsetChange={(o) => {
            setOffset(o)
            if (!advanced) void fetchLegacy({ offset: o, inspect: null })
            else void fetchStructured(o)
          }}
          onOpenInspect={(id) => openInspect(id)}
          expandedAuditIds={expandedAudit}
          onToggleAuditExpand={(id) =>
            setExpandedAudit((prev) => {
              const next = new Set(prev)
              if (next.has(id)) next.delete(id)
              else next.add(id)
              return next
            })
          }
        />

        <div className="hidden xl:block xl:sticky xl:top-4 xl:self-start">
          <DevConsoleSchemaPanel model={model} />
        </div>
      </div>

      <div className="xl:hidden">
        <p className="mb-2 text-xs font-semibold text-neutral-800">Model reference</p>
        <DevConsoleSchemaPanel model={model} />
      </div>

      <DevConsoleRecordInspector
        open={inspectorOpen && Boolean(inspectId)}
        onClose={() => {
          setInspectorOpen(false)
          setInspectId(null)
          router.replace(pathname + (quickSearch.trim() ? `?q=${encodeURIComponent(quickSearch.trim())}` : ""), {
            scroll: false,
          })
        }}
        inspectId={inspectId}
        loading={inspectLoading}
        primaryEntity={inspectPayload?.primaryEntity ?? null}
        auditRows={(inspectPayload?.auditLogs.rows ?? []).map((r) => ({
          id: r.id,
          action_type: r.action_type,
          created_at: r.created_at,
        }))}
        agentRows={inspectPayload?.agentActions.rows ?? []}
        onTraceUuid={() => {
          if (!inspectId) return
          setInspectorOpen(false)
          setPanelMode("trace")
          setQuickSearch(inspectId)
          void fetchLegacy({ inspect: null, offset: 0 })
        }}
        onAuditTimeline={() => {
          if (!inspectId) return
          setInspectorOpen(false)
          setPanelMode("global")
          const start = new Date(Date.now() - 30 * 86400000).toISOString()
          setDateStart(start)
          setDateEnd(new Date().toISOString())
          setSimpleTables({
            ...simpleTables,
            audit_logs: true,
          })
          setQuickSearch("")
          void fetchLegacy({ inspect: inspectId, offset: 0 })
        }}
      />
    </div>
  )
}

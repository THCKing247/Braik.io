"use client"

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import type { PlayerStatsRow, StatsTableRow } from "@/lib/stats-helpers"
import {
  STATS_PLAYER_TABLE_COLUMNS,
  STATS_WEEKLY_LEADING_COLUMNS,
  buildPlayerTableColumnsForKeys,
} from "@/lib/stats-display-columns"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Pencil } from "lucide-react"
import { cn } from "@/lib/utils"

/** Horizontal + vertical scroll; thin visible scrollbars so drag/scroll remains discoverable. */
const TABLE_SCROLL_WRAP =
  "max-h-[70vh] overflow-x-auto overflow-y-auto rounded-lg border [scrollbar-color:rgb(203_213_225)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300/90 [&::-webkit-scrollbar-track]:bg-transparent"

const STICKY_HEADER_BG = "rgb(var(--snow))"
const STICKY_BODY_BG = "#FFFFFF"

/** Minimum widths so wide schemas stay readable (Tailwind classes). */
function statColumnMinClass(key: string): string {
  switch (key) {
    case "lastName":
      return "min-w-[11rem] max-w-[18rem]"
    case "jerseyNumber":
      return "min-w-[2.75rem]"
    case "position":
      return "min-w-[4.5rem]"
    case "passCompletions":
    case "passAttempts":
      return "min-w-[4.25rem]"
    case "passingYards":
    case "receivingYards":
    case "rushingYards":
      return "min-w-[4.75rem]"
    case "soloTackles":
    case "assistedTackles":
    case "tacklesForLoss":
    case "sacks":
      return "min-w-[3.75rem]"
    case "weekNumber":
      return "min-w-[3.25rem]"
    case "gameLabel":
      return "min-w-[8rem]"
    case "gameOpponent":
      return "min-w-[7rem]"
    case "gameDate":
      return "min-w-[6.5rem]"
    default:
      return "min-w-[3.25rem]"
  }
}

function formatCell(row: StatsTableRow, key: keyof StatsTableRow): string {
  if (key === "weekNumber") {
    const v = row.weekNumber
    return v === null || v === undefined ? "—" : String(v)
  }
  if (key === "gameLabel") {
    const v = row.gameLabel
    return v === null || v === undefined || v === "" ? "—" : String(v)
  }
  if (key === "gameOpponent") {
    const v = row.gameOpponent
    return v === null || v === undefined || v === "" ? "—" : String(v)
  }
  if (key === "gameDate") {
    const v = row.gameDate
    if (v === null || v === undefined || v === "") return "—"
    return String(v).slice(0, 10)
  }
  const v = row[key as keyof PlayerStatsRow]
  if (v === null || v === undefined || v === "") return "—"
  if (typeof v === "number" && Number.isFinite(v)) return String(v)
  return String(v)
}

export interface AllStatsTableProps {
  mode: "season" | "weekly"
  rows: StatsTableRow[]
  getProfileHref: (row: StatsTableRow) => string
  selectionEnabled?: boolean
  selectedRowKeys?: ReadonlySet<string>
  onToggleRow?: (rowKey: string, selected: boolean) => void
  onToggleAllVisible?: (selected: boolean, visibleRowKeys: string[]) => void
  /** Weekly tab: row action to edit this entry (rowKey is entry id). */
  onEditWeeklyRow?: (row: StatsTableRow) => void
  /** When set, show only these stat columns (identity + stats). Full schema when omitted. */
  statColumnKeys?: readonly (keyof PlayerStatsRow)[] | null
}

type SortKey = keyof PlayerStatsRow | "weekNumber" | "gameLabel" | "gameOpponent" | "gameDate"
type SortDir = "asc" | "desc"

function sortValue(row: StatsTableRow, key: SortKey): string | number | null {
  if (key === "weekNumber") return row.weekNumber ?? null
  if (key === "gameLabel") return row.gameLabel ?? ""
  if (key === "gameOpponent") return row.gameOpponent ?? ""
  if (key === "gameDate") return row.gameDate ?? ""
  const v = row[key as keyof PlayerStatsRow]
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (v === null || v === undefined) return ""
  return String(v)
}

export function AllStatsTable({
  mode,
  rows,
  getProfileHref,
  selectionEnabled = false,
  selectedRowKeys,
  onToggleRow,
  onToggleAllVisible,
  onEditWeeklyRow,
  statColumnKeys,
}: AllStatsTableProps) {
  const router = useRouter()
  const showWeeklyEdit = mode === "weekly" && Boolean(onEditWeeklyRow)
  const [sortKey, setSortKey] = useState<SortKey>(mode === "weekly" ? "gameDate" : "lastName")
  const [sortDir, setSortDir] = useState<SortDir>("asc")

  const statColumnKeysSig = statColumnKeys?.join("\0") ?? ""

  const columns = useMemo(() => {
    const fullStats = STATS_PLAYER_TABLE_COLUMNS
    const subset =
      statColumnKeys && statColumnKeys.length > 0
        ? buildPlayerTableColumnsForKeys(statColumnKeys)
        : fullStats
    const statColsNoPlayer = subset.filter((c) => c.key !== "lastName")
    if (mode === "weekly") {
      return [{ key: "lastName" as const, label: "Player", numeric: false }, ...STATS_WEEKLY_LEADING_COLUMNS, ...statColsNoPlayer]
    }
    return subset.length > 0 ? subset : fullStats
  }, [mode, statColumnKeysSig, statColumnKeys])

  /** Sticky horizontal offsets (rem): checkbox 2.5, edit 3. */
  const stickyOffsets = useMemo(() => {
    const cbW = selectionEnabled ? 2.5 : 0
    const edW = showWeeklyEdit ? 3 : 0
    const playerLeft = cbW + edW
    return {
      editLeft: selectionEnabled ? cbW : 0,
      playerLeft,
      hasPrefix: selectionEnabled || showWeeklyEdit,
    }
  }, [selectionEnabled, showWeeklyEdit])

  useEffect(() => {
    setSortKey(mode === "weekly" ? "gameDate" : "lastName")
    setSortDir("asc")
  }, [mode, statColumnKeysSig])

  const sortedRows = useMemo(() => {
    const arr = [...rows]
    arr.sort((a, b) => {
      const aVal = sortValue(a, sortKey)
      const bVal = sortValue(b, sortKey)
      const aNum = typeof aVal === "number" && Number.isFinite(aVal) ? aVal : null
      const bNum = typeof bVal === "number" && Number.isFinite(bVal) ? bVal : null
      if (aNum !== null && bNum !== null) {
        return sortDir === "asc" ? aNum - bNum : bNum - aNum
      }
      const aStr = String(aVal ?? "")
      const bStr = String(bVal ?? "")
      const cmp = aStr.localeCompare(bStr, undefined, { sensitivity: "base" })
      return sortDir === "asc" ? cmp : -cmp
    })
    return arr
  }, [rows, sortKey, sortDir])

  const visibleKeys = useMemo(() => sortedRows.map((r) => r.rowKey), [sortedRows])

  const allSelected =
    selectionEnabled &&
    visibleKeys.length > 0 &&
    visibleKeys.every((k) => selectedRowKeys?.has(k))
  const someSelected =
    selectionEnabled && visibleKeys.some((k) => selectedRowKeys?.has(k)) && !allSelected

  const headerSelectRef = useRef<HTMLInputElement | null>(null)
  useLayoutEffect(() => {
    const el = headerSelectRef.current
    if (el) el.indeterminate = Boolean(someSelected && !allSelected)
  }, [someSelected, allSelected])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  const stickyHeadShadow = "shadow-[4px_0_8px_-2px_rgba(15,23,42,0.08)]"
  const stickyBodyShadow = "shadow-[4px_0_6px_-3px_rgba(15,23,42,0.06)]"

  return (
    <div
      className={cn(TABLE_SCROLL_WRAP)}
      style={{ borderColor: "rgb(var(--border))", backgroundColor: STICKY_BODY_BG }}
    >
      <table className="min-w-max w-max text-left text-sm border-collapse">
        <thead className="sticky top-0 z-[35]">
          <tr className="border-b" style={{ borderColor: "rgb(var(--border))" }}>
            {selectionEnabled && (
              <th
                className={cn(
                  "sticky left-0 z-[45] w-10 min-w-[2.5rem] px-2 py-3",
                  stickyHeadShadow
                )}
                style={{ backgroundColor: STICKY_HEADER_BG }}
                aria-label="Select rows"
              >
                <Checkbox
                  ref={headerSelectRef}
                  checked={allSelected}
                  onCheckedChange={(checked) => onToggleAllVisible?.(Boolean(checked), visibleKeys)}
                  onClick={(e) => e.stopPropagation()}
                />
              </th>
            )}
            {showWeeklyEdit && (
              <th
                className={cn(
                  "sticky z-[45] w-12 min-w-[3rem] px-1 py-3 text-center text-sm font-semibold whitespace-nowrap",
                  stickyHeadShadow
                )}
                style={{
                  left: `${stickyOffsets.editLeft}rem`,
                  backgroundColor: STICKY_HEADER_BG,
                  color: "rgb(var(--text))",
                }}
              >
                Edit
              </th>
            )}
            {columns.map(({ key, label }) => {
              const isPlayer = key === "lastName"
              const minC = statColumnMinClass(String(key))
              return (
                <th
                  key={key}
                  className={cn(
                    "px-3 py-3 text-sm font-semibold whitespace-nowrap cursor-pointer select-none hover:opacity-80",
                    isPlayer && "sticky z-[45]",
                    isPlayer && stickyHeadShadow,
                    minC
                  )}
                  style={
                    isPlayer
                      ? {
                          left: `${stickyOffsets.playerLeft}rem`,
                          backgroundColor: STICKY_HEADER_BG,
                          color: "rgb(var(--text))",
                        }
                      : { backgroundColor: STICKY_HEADER_BG, color: "rgb(var(--text))" }
                  }
                  onClick={() => handleSort(key as SortKey)}
                  aria-sort={sortKey === key ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {label}
                    {sortKey === key && (
                      <span style={{ color: "rgb(var(--accent))" }}>{sortDir === "asc" ? " ↑" : " ↓"}</span>
                    )}
                  </span>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => {
            const href = getProfileHref(row)
            const checked = selectedRowKeys?.has(row.rowKey) ?? false
            return (
              <tr
                key={row.rowKey}
                role={href ? "button" : undefined}
                tabIndex={href ? 0 : undefined}
                onClick={href ? () => router.push(href) : undefined}
                onKeyDown={
                  href
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          router.push(href)
                        }
                      }
                    : undefined
                }
                className="group border-b transition-colors hover:bg-[#F8FAFC]/80"
                style={{
                  borderColor: "rgb(var(--border))",
                  cursor: href ? "pointer" : undefined,
                }}
              >
                {selectionEnabled && (
                  <td
                    className={cn(
                      "sticky left-0 z-[25] px-2 py-2 align-middle",
                      stickyBodyShadow,
                      "bg-white group-hover:bg-[#F8FAFC]"
                    )}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(c) => onToggleRow?.(row.rowKey, Boolean(c))}
                      aria-label={`Select ${row.firstName} ${row.lastName}`}
                    />
                  </td>
                )}
                {showWeeklyEdit && (
                  <td
                    className={cn(
                      "sticky z-[25] px-1 py-2 text-center align-middle bg-white group-hover:bg-[#F8FAFC]",
                      stickyBodyShadow
                    )}
                    style={{
                      left: `${stickyOffsets.editLeft}rem`,
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label={`Edit weekly stats for ${row.firstName} ${row.lastName}`}
                      onClick={() => onEditWeeklyRow?.(row)}
                    >
                      <Pencil className="h-4 w-4" aria-hidden />
                    </Button>
                  </td>
                )}
                {columns.map(({ key }) => {
                  const isPlayer = key === "lastName"
                  const minC = statColumnMinClass(String(key))
                  return (
                    <td
                      key={key}
                      className={cn(
                        "px-3 py-2 whitespace-nowrap",
                        minC,
                        isPlayer &&
                          "sticky z-[25] font-medium bg-white group-hover:bg-[#F8FAFC]",
                        isPlayer && stickyBodyShadow
                      )}
                      style={
                        isPlayer
                          ? {
                              left: `${stickyOffsets.playerLeft}rem`,
                              color: "rgb(var(--text))",
                            }
                          : { color: "rgb(var(--text))" }
                      }
                    >
                      {isPlayer ? (
                        <span>
                          {row.firstName} {row.lastName}
                        </span>
                      ) : (
                        formatCell(row, key)
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
      {sortedRows.length === 0 && (
        <div className="py-12 text-center" style={{ color: "rgb(var(--muted))" }}>
          No players match the current filters
        </div>
      )}
    </div>
  )
}

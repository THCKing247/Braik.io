"use client"

import { useLayoutEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import type { PlayerStatsRow, StatsTableRow } from "@/lib/stats-helpers"
import { STATS_PLAYER_TABLE_COLUMNS, STATS_WEEKLY_LEADING_COLUMNS } from "@/lib/stats-display-columns"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Pencil } from "lucide-react"

const SCROLL_HIDE =
  "overflow-x-auto overflow-y-auto max-h-[70vh] [scrollbar-gutter:stable] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"

const STAT_COLUMNS = STATS_PLAYER_TABLE_COLUMNS
const WEEKLY_BEFORE_STAT = STATS_WEEKLY_LEADING_COLUMNS

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
}: AllStatsTableProps) {
  const router = useRouter()
  const showWeeklyEdit = mode === "weekly" && Boolean(onEditWeeklyRow)
  const [sortKey, setSortKey] = useState<SortKey>(mode === "weekly" ? "gameDate" : "lastName")
  const [sortDir, setSortDir] = useState<SortDir>("asc")

  const columns = useMemo(() => {
    const base = STAT_COLUMNS.filter((c) => c.key !== "lastName")
    if (mode === "weekly") {
      return [{ key: "lastName" as const, label: "Player", numeric: false }, ...WEEKLY_BEFORE_STAT, ...base]
    }
    return STAT_COLUMNS
  }, [mode])

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

  return (
    <div
      className={`rounded-lg border ${SCROLL_HIDE}`}
      style={{ borderColor: "rgb(var(--border))", backgroundColor: "#FFFFFF" }}
    >
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 z-10" style={{ backgroundColor: "rgb(var(--snow))" }}>
          <tr className="border-b" style={{ borderColor: "rgb(var(--border))" }}>
            {selectionEnabled && (
              <th className="w-10 px-2 py-3" aria-label="Select rows">
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
                className="w-12 px-1 py-3 text-center font-semibold whitespace-nowrap"
                style={{ color: "rgb(var(--text))" }}
              >
                Edit
              </th>
            )}
            {columns.map(({ key, label }) => (
              <th
                key={key}
                className="px-3 py-3 font-semibold cursor-pointer select-none whitespace-nowrap hover:opacity-80"
                style={{ color: "rgb(var(--text))" }}
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
            ))}
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
                className="border-b transition-colors hover:bg-[#F8FAFC]/80"
                style={{
                  borderColor: "rgb(var(--border))",
                  cursor: href ? "pointer" : undefined,
                }}
              >
                {selectionEnabled && (
                  <td className="px-2 py-2 align-middle" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(c) => onToggleRow?.(row.rowKey, Boolean(c))}
                      aria-label={`Select ${row.firstName} ${row.lastName}`}
                    />
                  </td>
                )}
                {showWeeklyEdit && (
                  <td className="px-1 py-2 align-middle text-center" onClick={(e) => e.stopPropagation()}>
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
                {columns.map(({ key }) => (
                  <td
                    key={key}
                    className="px-3 py-2 whitespace-nowrap"
                    style={{ color: "rgb(var(--text))" }}
                  >
                    {key === "lastName" ? (
                      <span>
                        {row.firstName} {row.lastName}
                      </span>
                    ) : (
                      formatCell(row, key)
                    )}
                  </td>
                ))}
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

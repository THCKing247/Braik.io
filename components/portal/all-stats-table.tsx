"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import type { PlayerStatsRow } from "@/lib/stats-helpers"

const STAT_COLUMNS: { key: keyof PlayerStatsRow; label: string; numeric: boolean }[] = [
  { key: "lastName", label: "Player", numeric: false },
  { key: "jerseyNumber", label: "#", numeric: true },
  { key: "position", label: "Position", numeric: false },
  { key: "gamesPlayed", label: "GP", numeric: true },
  { key: "passingYards", label: "Pass Yds", numeric: true },
  { key: "passingTds", label: "Pass TD", numeric: true },
  { key: "intThrown", label: "INT Thrown", numeric: true },
  { key: "rushingYards", label: "Rush Yds", numeric: true },
  { key: "rushingTds", label: "Rush TD", numeric: true },
  { key: "receptions", label: "Rec", numeric: true },
  { key: "receivingYards", label: "Rec Yds", numeric: true },
  { key: "receivingTds", label: "Rec TD", numeric: true },
  { key: "tackles", label: "Tackles", numeric: true },
  { key: "sacks", label: "Sacks", numeric: true },
  { key: "interceptions", label: "INT", numeric: true },
]

function formatCell(row: PlayerStatsRow, key: keyof PlayerStatsRow): string {
  const v = row[key]
  if (v === null || v === undefined || v === "") return "—"
  if (typeof v === "number" && Number.isFinite(v)) return String(v)
  return String(v)
}

export interface AllStatsTableProps {
  rows: PlayerStatsRow[]
  getProfileHref: (row: PlayerStatsRow) => string
}

type SortKey = keyof PlayerStatsRow
type SortDir = "asc" | "desc"

export function AllStatsTable({ rows, getProfileHref }: AllStatsTableProps) {
  const router = useRouter()
  const [sortKey, setSortKey] = useState<SortKey>("lastName")
  const [sortDir, setSortDir] = useState<SortDir>("asc")

  const sortedRows = useMemo(() => {
    const arr = [...rows]
    arr.sort((a, b) => {
      const aVal = a[sortKey]
      const bVal = b[sortKey]
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
      className="overflow-x-auto rounded-lg border overflow-y-auto [scrollbar-gutter:stable]"
      style={{ borderColor: "rgb(var(--border))", backgroundColor: "#FFFFFF", maxHeight: "70vh" }}
    >
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 z-10" style={{ backgroundColor: "rgb(var(--snow))" }}>
          <tr className="border-b" style={{ borderColor: "rgb(var(--border))" }}>
            {STAT_COLUMNS.map(({ key, label }) => (
              <th
                key={key}
                className="px-3 py-3 font-semibold cursor-pointer select-none whitespace-nowrap hover:opacity-80"
                style={{ color: "rgb(var(--text))" }}
                onClick={() => handleSort(key)}
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
            return (
              <tr
                key={row.id}
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
                {STAT_COLUMNS.map(({ key }) => (
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

"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import type { AthleticDepartmentListRow } from "@/lib/admin/athletic-departments-types"

function statusChip(value: string): string {
  const normalized = value.toLowerCase()
  if (normalized === "active") return "bg-emerald-500/20 text-emerald-200 border-emerald-400/40"
  return "bg-white/10 text-white/80 border-white/20"
}

export function OperatorAthleticDepartments({ initialRows }: { initialRows: AthleticDepartmentListRow[] }) {
  const [query, setQuery] = useState("")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return initialRows
    return initialRows.filter((row) =>
      `${row.schoolName} ${row.organizationSummary ?? ""} ${row.status}`.toLowerCase().includes(q)
    )
  }, [initialRows, query])

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-[#18181c] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Athletic Departments / Schools</h2>
            <p className="mt-1 text-xs text-white/60">
              Entitlements and usage for each school&rsquo;s athletic department. Video requires school + organization +
              team toggles where linked.
            </p>
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by school, org, status…"
            className="min-w-[200px] rounded border border-white/15 bg-black/30 px-3 py-1.5 text-sm"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/20 bg-[#111113] p-10 text-center text-sm text-white/60">
          {initialRows.length === 0
            ? "No athletic departments found. Provisioning may create schools and departments."
            : "No rows match your search."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#18181c]">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-white/50">
              <tr>
                <th className="px-4 py-3">School / AD</th>
                <th className="px-4 py-3">Organization(s)</th>
                <th className="px-4 py-3">Teams (used / cap)</th>
                <th className="px-4 py-3">Asst. coaches allowed</th>
                <th className="px-4 py-3">Video (school)</th>
                <th className="px-4 py-3">Users</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-b border-white/5 hover:bg-white/[0.03]">
                  <td className="px-4 py-3 font-medium text-white">{row.schoolName}</td>
                  <td className="max-w-[220px] px-4 py-3 text-white/75">
                    {row.organizationSummary ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-white/85">
                    {row.teamCount} / {row.teamsAllowed}
                  </td>
                  <td className="px-4 py-3 text-white/85">{row.assistantCoachesAllowed}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        row.videoFeatureEnabled
                          ? "rounded border border-emerald-400/40 bg-emerald-500/15 px-2 py-0.5 text-emerald-100"
                          : "rounded border border-white/15 bg-black/30 px-2 py-0.5 text-white/60"
                      }
                    >
                      {row.videoFeatureEnabled ? "On" : "Off"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/85">{row.totalUsers}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded border px-2 py-0.5 text-xs ${statusChip(row.status)}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/athletic-departments/${row.id}`}
                      className="text-cyan-300 underline hover:text-cyan-200"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

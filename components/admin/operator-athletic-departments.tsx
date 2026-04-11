"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { AdminPageHeader } from "@/components/admin/admin-page-header"
import type { AthleticDepartmentListRow } from "@/lib/admin/athletic-departments-types"
import { adminChip, adminOpsAdStatusChip, adminUi } from "@/lib/admin/admin-ui"
import { cn } from "@/lib/utils"

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
    <div className="space-y-6">
      <AdminPageHeader
        title="Athletic departments"
        description="Entitlements and usage for each school’s athletic department. Video and Coach B+ require school, organization, and team toggles where linked."
        action={
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by school, org, status…"
            className={cn(adminUi.toolbarInput, "min-w-[200px] text-sm")}
          />
        }
      />

      {filtered.length === 0 ? (
        <div className={adminUi.emptyState}>
          <p className="text-sm font-medium text-slate-300">
            {initialRows.length === 0
              ? "No athletic departments found. Provisioning may create schools and departments."
              : "No rows match your search."}
          </p>
        </div>
      ) : (
        <div className={adminUi.tableWrap}>
          <table className={cn(adminUi.table, "min-w-[1040px]")}>
            <thead className={adminUi.thead}>
              <tr>
                <th className={adminUi.th}>School / AD</th>
                <th className={adminUi.th}>Organization(s)</th>
                <th className={adminUi.th}>Teams (used / cap)</th>
                <th className={adminUi.th}>Asst. coaches allowed</th>
                <th className={adminUi.th}>Video (school)</th>
                <th className={adminUi.th}>Coach B+ (school)</th>
                <th className={adminUi.th}>Users</th>
                <th className={adminUi.th}>Status</th>
                <th className={adminUi.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className={adminUi.tbodyRow}>
                  <td className={cn(adminUi.td, "font-medium text-white")}>{row.schoolName}</td>
                  <td className={cn(adminUi.td, "max-w-[220px] text-slate-300")}>
                    {row.organizationSummary ?? "—"}
                  </td>
                  <td className={adminUi.td}>
                    {row.teamCount} / {row.teamsAllowed}
                  </td>
                  <td className={adminUi.td}>{row.assistantCoachesAllowed}</td>
                  <td className={adminUi.td}>
                    <span className={row.videoFeatureEnabled ? adminChip.success : cn(adminChip.neutral, "text-slate-300")}>
                      {row.videoFeatureEnabled ? "On" : "Off"}
                    </span>
                  </td>
                  <td className={adminUi.td}>
                    <span
                      className={
                        row.coachBPlusFeatureEnabled ? adminChip.success : cn(adminChip.neutral, "text-slate-300")
                      }
                    >
                      {row.coachBPlusFeatureEnabled ? "On" : "Off"}
                    </span>
                  </td>
                  <td className={adminUi.td}>{row.totalUsers}</td>
                  <td className={adminUi.td}>
                    <span className={cn(adminOpsAdStatusChip(row.status), "text-xs")}>
                      {row.status}
                    </span>
                  </td>
                  <td className={adminUi.td}>
                    <Link href={`/admin/athletic-departments/${row.id}`} className={cn(adminUi.link, "text-sm")}>
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

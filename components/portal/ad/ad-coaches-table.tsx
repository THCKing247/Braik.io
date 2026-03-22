import Link from "next/link"
import type { AdPrimaryHeadCoachListItem } from "@/lib/ad-primary-head-coaches"

interface AdCoachesTableProps {
  coaches: AdPrimaryHeadCoachListItem[]
}

function displayName(row: AdPrimaryHeadCoachListItem) {
  const n = row.fullName?.trim()
  if (n) return n
  const e = row.email?.trim()
  if (e) return e
  return "—"
}

export function AdCoachesTable({ coaches }: AdCoachesTableProps) {
  if (coaches.length === 0) {
    return null
  }

  const sorted = [...coaches].sort((a, b) => {
    const t = a.teamName.localeCompare(b.teamName, undefined, { sensitivity: "base" })
    if (t !== 0) return t
    return displayName(a).localeCompare(displayName(b), undefined, { sensitivity: "base" })
  })

  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[#E5E7EB]">
          <thead className="bg-[#F9FAFB]">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                Head coach
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                Team
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-[#6B7280] uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E7EB] bg-white">
            {sorted.map((row) => (
              <tr key={`${row.teamId}-${row.userId}`}>
                <td className="px-4 py-3">
                  <span className="font-medium text-[#212529]">{displayName(row)}</span>
                </td>
                <td className="px-4 py-3 text-sm text-[#6B7280]">
                  {row.email?.trim() ? row.email : "—"}
                </td>
                <td className="px-4 py-3 text-sm text-[#6B7280]">{row.teamName}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/dashboard/ad/teams/${row.teamId}`}
                    className="text-sm font-medium text-[#3B82F6] hover:text-[#2563EB]"
                  >
                    View team
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

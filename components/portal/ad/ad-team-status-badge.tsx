"use client"

type Status = "assigned" | "pending" | "none"

interface AdTeamStatusBadgeProps {
  status: Status
  coachName?: string | null
}

export function AdTeamStatusBadge({ status, coachName }: AdTeamStatusBadgeProps) {
  if (status === "assigned" && coachName) {
    return (
      <span className="inline-flex items-center rounded-md bg-[#D1FAE5] px-2 py-1 text-xs font-medium text-[#065F46]">
        {coachName}
      </span>
    )
  }
  if (status === "pending") {
    return (
      <span className="inline-flex items-center rounded-md bg-[#FEF3C7] px-2 py-1 text-xs font-medium text-[#92400E]">
        Invitation pending
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-md bg-[#F3F4F6] px-2 py-1 text-xs font-medium text-[#6B7280]">
      No head coach assigned
    </span>
  )
}

"use client"

interface AdOverviewCardsProps {
  totalTeams?: number
  totalAthletes?: number
  totalCoaches?: number
  totalParents?: number
  planStatus?: string
  departmentPlan?: string
}

export function AdOverviewCards({
  totalTeams = 0,
  totalAthletes = 0,
  totalCoaches = 0,
  totalParents = 0,
  planStatus = "active",
  departmentPlan = "Athletic Department License",
}: AdOverviewCardsProps) {
  const cards = [
    { label: "Total teams", value: totalTeams },
    { label: "Total athletes", value: totalAthletes },
    { label: "Total coaches", value: totalCoaches },
    { label: "Total parents", value: totalParents },
    { label: "Account status", value: planStatus },
    { label: "Department plan", value: departmentPlan },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm"
        >
          <p className="text-sm font-medium text-[#6B7280]">{card.label}</p>
          <p className="mt-1 text-2xl font-semibold text-[#212529]">
            {typeof card.value === "number" ? card.value.toLocaleString() : card.value}
          </p>
        </div>
      ))}
    </div>
  )
}

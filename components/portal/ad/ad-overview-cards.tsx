"use client"

import { AdCoachesPieChartCard } from "@/components/portal/ad/ad-coaches-pie-chart-card"

interface AdOverviewCardsProps {
  totalTeams?: number
  totalAthletes?: number
  headCoachCount?: number
  assistantCoachCount?: number
  totalParents?: number
  planStatus?: string
  departmentPlan?: string
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-[#6B7280]">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[#212529]">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </div>
  )
}

export function AdOverviewCards({
  totalTeams = 0,
  totalAthletes = 0,
  headCoachCount = 0,
  assistantCoachCount = 0,
  totalParents = 0,
  planStatus = "active",
  departmentPlan = "Athletic Department License",
}: AdOverviewCardsProps) {
  const cardsBeforeCoach = [
    { label: "Total teams", value: totalTeams },
    { label: "Total athletes", value: totalAthletes },
  ]
  const cardsAfterCoach = [
    { label: "Total parents", value: totalParents },
    { label: "Account status", value: planStatus },
    { label: "Department plan", value: departmentPlan },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cardsBeforeCoach.map((card) => (
        <StatCard key={card.label} label={card.label} value={card.value} />
      ))}
      <AdCoachesPieChartCard headCoachCount={headCoachCount} assistantCoachCount={assistantCoachCount} />
      {cardsAfterCoach.map((card) => (
        <StatCard key={card.label} label={card.label} value={card.value} />
      ))}
    </div>
  )
}

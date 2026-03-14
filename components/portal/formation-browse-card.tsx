"use client"

import { Card, CardContent } from "@/components/ui/card"
import { FormationThumbnail } from "@/components/portal/formation-thumbnail"
import type { FormationRecord } from "@/types/playbook"

function FootballIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 28" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden>
      <ellipse cx="24" cy="14" rx="22" ry="12" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.12" />
      <path d="M8 14h32M24 6v16M14 8l20 12M14 20l20-12M18 10l12 8M18 18l12-8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.85" />
    </svg>
  )
}

interface FormationBrowseCardProps {
  formation: FormationRecord
  subformationCount: number
  playCount: number
  onSelect: () => void
  canEdit?: boolean
  onEdit?: () => void
  onDelete?: () => void
}

export function FormationBrowseCard({
  formation,
  subformationCount,
  playCount,
  onSelect,
  canEdit,
  onEdit,
  onDelete,
}: FormationBrowseCardProps) {
  const isOffense = formation.side === "offense"
  const isDefense = formation.side === "defense"
  const barBg = isOffense ? "bg-blue-600" : isDefense ? "bg-red-600" : "bg-amber-600"
  const accentBg = isOffense
    ? "bg-blue-500/10 border-blue-200 hover:border-blue-500"
    : isDefense
    ? "bg-red-500/10 border-red-200 hover:border-red-500"
    : "bg-amber-500/10 border-amber-200 hover:border-amber-500"
  const hasTemplate = formation.templateData?.shapes?.length > 0

  return (
    <Card
      className={`min-w-[220px] cursor-pointer overflow-hidden border-2 transition-all shadow-sm p-0 relative ${accentBg}`}
      onClick={onSelect}
    >
      {hasTemplate ? (
        <FormationThumbnail templateData={formation.templateData} side={formation.side} className="rounded-t-lg" />
      ) : (
        <div className="aspect-[200/140] bg-slate-100 rounded-t-lg flex items-center justify-center">
          <FootballIcon className={`h-14 w-14 ${isOffense ? "text-blue-500/50" : isDefense ? "text-red-500/50" : "text-amber-500/50"}`} />
        </div>
      )}
      <div className={`${barBg} px-4 py-3 text-center min-w-0`}>
        <span className="font-bold text-white text-lg tracking-tight block truncate" title={formation.name}>{formation.name}</span>
      </div>
      <CardContent className="p-4 flex flex-col min-h-[100px]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Sub-formations</p>
            <p className="text-xl font-bold text-slate-800">{subformationCount}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Plays</p>
            <p className="text-xl font-bold text-slate-800">{playCount}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

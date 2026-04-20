"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Plus, ChevronDown } from "lucide-react"
import type { SideOfBall } from "@/types/playbook"
import { PortalPageHeaderSurface } from "@/components/portal/portal-page-header"

const SIDES: { value: SideOfBall; label: string }[] = [
  { value: "offense", label: "Offense" },
  { value: "defense", label: "Defense" },
  { value: "special_teams", label: "Special Teams" },
]

interface PlaybookHeaderProps {
  onNewFormation?: (side: SideOfBall) => void
  onNewPlay?: () => void
  canEdit: boolean
  /** When true, show secondary "New Play" (e.g. when a formation is selected). */
  showNewPlay?: boolean
  canEditOffense?: boolean
  canEditDefense?: boolean
  canEditSpecialTeams?: boolean
}

export function PlaybookHeader({
  onNewFormation,
  onNewPlay,
  canEdit,
  showNewPlay = false,
  canEditOffense = true,
  canEditDefense = true,
  canEditSpecialTeams = true,
}: PlaybookHeaderProps) {
  const [formationMenuOpen, setFormationMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setFormationMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const canEditSide = (side: SideOfBall) => {
    if (side === "offense") return canEdit && canEditOffense
    if (side === "defense") return canEdit && canEditDefense
    return canEdit && canEditSpecialTeams
  }

  return (
    <PortalPageHeaderSurface className="flex-shrink-0" contentClassName="px-5 py-4 sm:px-6 sm:py-5">
      <header>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Team Playbook
            </p>
            <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              Build your system
            </h1>
            <p className="mt-1 max-w-xl text-sm leading-snug text-slate-600">
              Organize formations, sub-formations, and plays across offense, defense, and special teams.
            </p>
          </div>
          {canEdit && (
            <div className="flex flex-shrink-0 flex-wrap items-center gap-2 pt-1 sm:pt-0">
              {onNewFormation && (
                <div className="relative" ref={menuRef}>
                  <Button
                    size="sm"
                    className="h-9 shadow-sm"
                    onClick={() => setFormationMenuOpen((v) => !v)}
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    New Formation
                    <ChevronDown className="ml-1 h-4 w-4 opacity-80" />
                  </Button>
                  {formationMenuOpen && (
                    <div className="absolute left-0 top-full z-20 mt-1.5 min-w-[160px] rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                      {SIDES.map((s) => (
                        <button
                          key={s.value}
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                          disabled={!canEditSide(s.value)}
                          onClick={() => {
                            onNewFormation(s.value)
                            setFormationMenuOpen(false)
                          }}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {showNewPlay && onNewPlay && (
                <Button variant="outline" size="sm" className="h-9 border-slate-200 text-slate-700 hover:bg-slate-50" onClick={onNewPlay}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  New Play
                </Button>
              )}
            </div>
          )}
        </div>
      </header>
    </PortalPageHeaderSurface>
  )
}

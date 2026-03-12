"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Lightbulb, Zap, BookOpen, Plus, ChevronDown } from "lucide-react"
import type { SideOfBall } from "@/types/playbook"

const SIDES: { value: SideOfBall; label: string }[] = [
  { value: "offense", label: "Offense" },
  { value: "defense", label: "Defense" },
  { value: "special_teams", label: "Special Teams" },
]

interface PlaybookSidebarProps {
  formationCountBySide: { offense: number; defense: number; special_teams: number }
  onBrowseOffense?: () => void
  onBrowseDefense?: () => void
  onBrowseSpecialTeams?: () => void
  onNewFormation?: (side: SideOfBall) => void
  canEdit?: boolean
}

export function PlaybookSidebar({
  formationCountBySide,
  onBrowseOffense,
  onBrowseDefense,
  onBrowseSpecialTeams,
  onNewFormation,
  canEdit = false,
}: PlaybookSidebarProps) {
  const [formationMenuOpen, setFormationMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setFormationMenuOpen(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const hasNoDefense = formationCountBySide.defense === 0
  const hasNoOffense = formationCountBySide.offense === 0
  const hasNoSpecialTeams = formationCountBySide.special_teams === 0
  const suggestedStep = hasNoDefense
    ? "Your defense has no formations yet. Add a front or base shell to begin building your defensive system."
    : hasNoOffense
    ? "Your offense has no formations yet. Add a formation to start building your offensive system."
    : hasNoSpecialTeams
    ? "Special teams has no formations yet. Add kicking or return units to complete your playbook."
    : "Open a category to review formations and start organizing plays by family."

  return (
    <aside className="flex flex-col gap-4">
      {/* How it works */}
      <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <CardHeader className="p-4 pb-1">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <BookOpen className="h-4 w-4 shrink-0 text-slate-500" />
            How playbooks are organized
          </h3>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-1">
          <p className="text-sm leading-relaxed text-slate-600">
            Start with a category, choose a formation, then build sub-formations and plays around your system. Keep terminology consistent so players and coaches can find concepts fast.
          </p>
        </CardContent>
      </Card>

      {/* Quick actions */}
      <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <CardHeader className="p-4 pb-1">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Zap className="h-4 w-4 shrink-0 text-slate-500" />
            Quick actions
          </h3>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-1 space-y-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 w-full justify-start rounded-lg border-slate-200 text-slate-700 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-800"
            onClick={onBrowseOffense}
          >
            Browse Offense
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 w-full justify-start rounded-lg border-slate-200 text-slate-700 hover:bg-red-50 hover:border-red-200 hover:text-red-800"
            onClick={onBrowseDefense}
          >
            Browse Defense
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 w-full justify-start rounded-lg border-slate-200 text-slate-700 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-800"
            onClick={onBrowseSpecialTeams}
          >
            Browse Special Teams
          </Button>
          {canEdit && onNewFormation && (
            <div className="relative pt-1" ref={menuRef}>
              <Button
                size="sm"
                variant="secondary"
                className="h-9 w-full justify-between rounded-lg"
                onClick={() => setFormationMenuOpen((v) => !v)}
              >
                <span className="flex items-center">
                  <Plus className="h-4 w-4 mr-1.5" />
                  New Formation
                </span>
                <ChevronDown className="h-4 w-4 opacity-80" />
              </Button>
              {formationMenuOpen && (
                <div className="absolute left-0 right-0 top-full z-10 mt-1.5 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                  {SIDES.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
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
        </CardContent>
      </Card>

      {/* Suggested next step — actionable guidance block */}
      <Card className="rounded-xl border-l-4 border-l-slate-400 border border-slate-200 bg-slate-50 shadow-sm">
        <CardHeader className="p-4 pb-1">
          <h3 className="text-sm font-semibold text-slate-800">Suggested next step</h3>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-1">
          <p className="text-sm leading-relaxed text-slate-700">{suggestedStep}</p>
        </CardContent>
      </Card>

      {/* Coaching tip */}
      <Card className="rounded-xl border border-amber-200/70 bg-amber-50/60 shadow-sm">
        <CardHeader className="p-4 pb-1">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-amber-900/90">
            <Lightbulb className="h-4 w-4 shrink-0 text-amber-600" />
            Coaching tip
          </h3>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-1">
          <p className="text-sm leading-relaxed text-amber-900/80">
            Group plays by formation family first, then use sub-formations and tags for motion, strength, and adjustments.
          </p>
        </CardContent>
      </Card>
    </aside>
  )
}

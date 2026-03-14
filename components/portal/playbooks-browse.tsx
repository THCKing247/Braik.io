"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PlaybookBreadcrumbs } from "@/components/portal/playbook-breadcrumbs"
import { PlaybookCard } from "@/components/portal/playbook-card"
import type { PlaybookRecord, FormationRecord, PlayRecord } from "@/types/playbook"

interface PlaybooksBrowseProps {
  teamId: string
  canEdit: boolean
}

export function PlaybooksBrowse({ teamId, canEdit }: PlaybooksBrowseProps) {
  const router = useRouter()
  const [playbooks, setPlaybooks] = useState<PlaybookRecord[]>([])
  const [formations, setFormations] = useState<FormationRecord[]>([])
  const [plays, setPlays] = useState<PlayRecord[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!teamId) return
    setLoading(true)
    try {
      const [pbRes, fRes, pRes] = await Promise.all([
        fetch(`/api/playbooks?teamId=${teamId}`),
        fetch(`/api/formations?teamId=${teamId}`),
        fetch(`/api/plays?teamId=${teamId}`),
      ])
      if (pbRes.ok) setPlaybooks(await pbRes.json())
      if (fRes.ok) setFormations(await fRes.json())
      if (pRes.ok) setPlays(await pRes.json())
    } catch (e) {
      console.error("Failed to load playbooks data", e)
    } finally {
      setLoading(false)
    }
  }, [teamId])

  useEffect(() => {
    load()
  }, [load])

  const formationCountByPlaybook = (playbookId: string) =>
    formations.filter((f) => f.playbookId === playbookId).length
  const playCountByPlaybook = (playbookId: string) =>
    plays.filter((p) => p.playbookId === playbookId).length

  const handleNewPlaybook = () => {
    router.push("/dashboard/playbooks/new")
  }

  const handleOpenPlaybook = (id: string) => {
    router.push(`/dashboard/playbooks/${id}`)
  }

  const handleDeletePlaybook = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!confirm("Delete this playbook? Formations and plays will be unassigned from it.")) return
    try {
      const res = await fetch(`/api/playbooks/${id}`, { method: "DELETE" })
      if (res.ok) load()
      else alert("Failed to delete playbook")
    } catch {
      alert("Failed to delete playbook")
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] bg-slate-50 rounded-2xl border border-slate-200">
        <p className="text-sm text-slate-500">Loading playbooks...</p>
      </div>
    )
  }

  const breadcrumbs = [{ label: "Playbooks" }]

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 border-b border-slate-200 bg-white px-5 py-4 sm:px-6 sm:py-5 rounded-t-2xl">
        <PlaybookBreadcrumbs items={breadcrumbs} className="mb-3" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Team Playbook</p>
            <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
              Playbooks
            </h1>
            <p className="mt-1 max-w-xl text-sm leading-snug text-slate-600">
              Create and manage playbooks. Open a playbook to add formations and plays.
            </p>
          </div>
          {canEdit && (
            <Button size="sm" className="h-9 shadow-sm shrink-0" onClick={handleNewPlaybook}>
              <Plus className="h-4 w-4 mr-1.5" />
              New playbook
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-slate-50 rounded-b-2xl border border-t-0 border-slate-200">
        {playbooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center max-w-md mx-auto">
            <p className="text-slate-700 font-medium">No playbooks yet</p>
            <p className="text-sm text-slate-500 mt-1">
              Create your first playbook to organize formations and plays.
            </p>
            {canEdit && (
              <Button size="sm" className="mt-6" onClick={handleNewPlaybook}>
                <Plus className="h-4 w-4 mr-1.5" />
                New playbook
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {playbooks.map((pb) => (
              <PlaybookCard
                key={pb.id}
                playbook={pb}
                formationCount={formationCountByPlaybook(pb.id)}
                playCount={playCountByPlaybook(pb.id)}
                onSelect={() => handleOpenPlaybook(pb.id)}
                onEdit={canEdit ? () => router.push(`/dashboard/playbooks/${pb.id}/edit`) : undefined}
                onDelete={canEdit ? (e: React.MouseEvent) => handleDeletePlaybook(e, pb.id) : undefined}
                canEdit={canEdit}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

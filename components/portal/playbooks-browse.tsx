"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PlaybookBreadcrumbs } from "@/components/portal/playbook-breadcrumbs"
import { PlaybookCard } from "@/components/portal/playbook-card"
import type { PlaybookRecord } from "@/types/playbook"

type PlaybookSummaryRow = PlaybookRecord & {
  formationCount: number
  playCount: number
}

interface PlaybooksBrowseProps {
  teamId: string
  canEdit: boolean
  /** From dashboard deferred-core bootstrap — avoids GET /api/playbooks/summary on first paint. */
  initialPlaybooksSummary?: PlaybookSummaryRow[]
  /** True once deferred-core has merged (or full bootstrap ready). */
  bootstrapCoreReady?: boolean
}

export function PlaybooksBrowse({
  teamId,
  canEdit,
  initialPlaybooksSummary,
  bootstrapCoreReady,
}: PlaybooksBrowseProps) {
  const router = useRouter()
  const [playbooks, setPlaybooks] = useState<PlaybookSummaryRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!teamId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/playbooks/summary?teamId=${teamId}`)
      if (res.ok) {
        const data = (await res.json()) as PlaybookSummaryRow[]
        setPlaybooks(Array.isArray(data) ? data : [])
      }
    } catch (e) {
      console.error("Failed to load playbooks data", e)
    } finally {
      setLoading(false)
    }
  }, [teamId])

  useEffect(() => {
    if (!teamId) return
    if (bootstrapCoreReady === false) {
      setLoading(true)
      return
    }
    if (bootstrapCoreReady === true && initialPlaybooksSummary !== undefined) {
      setPlaybooks(initialPlaybooksSummary)
      setLoading(false)
      return
    }
    void load()
  }, [teamId, bootstrapCoreReady, initialPlaybooksSummary, load])

  const handleNewPlaybook = () => {
    router.push("/dashboard/playbooks/new")
  }

  const handleOpenPlaybook = (id: string) => {
    router.push(`/dashboard/playbooks/${id}`)
  }

  const handleDeletePlaybook = async (id: string) => {
    if (!confirm("Delete this playbook? Formations and plays will be unassigned from it.")) return
    try {
      const res = await fetch(`/api/playbooks/${id}`, { method: "DELETE" })
      if (res.ok) load()
      else alert("Failed to delete playbook")
    } catch {
      alert("Failed to delete playbook")
    }
  }

  const breadcrumbs = [{ label: "Playbooks" }]

  return (
    <div className="flex flex-col h-full min-w-0 max-w-full overflow-hidden">
      <div className="flex-shrink-0 border-b border-slate-200 bg-white px-4 py-4 sm:px-6 sm:py-5 rounded-t-2xl">
        <PlaybookBreadcrumbs items={breadcrumbs} className="mb-3" />
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
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
            <Button size="sm" className="h-11 lg:h-9 shadow-sm w-full lg:w-auto shrink-0 rounded-xl lg:rounded-md font-semibold" onClick={handleNewPlaybook}>
              <Plus className="h-4 w-4 mr-1.5" />
              New playbook
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 pb-24 md:pb-28 lg:pb-6 bg-slate-50 rounded-b-2xl border border-t-0 border-slate-200 min-w-0">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {loading ? (
            [1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-white p-5 h-36 animate-pulse" />
            ))
          ) : playbooks.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-16 px-6 text-center rounded-xl border border-dashed border-slate-200 bg-white/80 max-w-lg mx-auto">
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
            playbooks.map((pb) => (
              <PlaybookCard
                key={pb.id}
                playbook={pb}
                formationCount={pb.formationCount}
                playCount={pb.playCount}
                onSelect={() => handleOpenPlaybook(pb.id)}
                onPresenter={() => router.push(`/dashboard/playbooks/${pb.id}/present`)}
                onEdit={canEdit ? () => router.push(`/dashboard/playbooks/${pb.id}/edit`) : undefined}
                onDelete={canEdit ? () => handleDeletePlaybook(pb.id) : undefined}
                canEdit={canEdit}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

"use client"

import { useParams, useRouter } from "next/navigation"
import { useState, useEffect, useCallback } from "react"
import { Plus, ArrowLeft, Search } from "lucide-react"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { usePlaybookToast } from "@/components/portal/playbook-toast"
import { PlaybookBreadcrumbs } from "@/components/portal/playbook-breadcrumbs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { filterPlaysBySearch } from "@/lib/utils/play-search"
import { SortablePlayList } from "@/components/portal/sortable-play-list"
import type { FormationRecord, SubFormationRecord, PlayRecord } from "@/types/playbook"
import type { DepthChartSlot } from "@/lib/constants/playbook-positions"
import { CommentThreadPanel } from "@/components/portal/comment-thread-panel"

function SubFormationDetailContent({
  playbookId,
  formationId,
  subFormationId,
  teamId,
  canEdit,
}: {
  playbookId: string
  formationId: string
  subFormationId: string
  teamId: string
  canEdit: boolean
}) {
  const router = useRouter()
  const { showToast } = usePlaybookToast()
  const [formation, setFormation] = useState<FormationRecord | null>(null)
  const [subFormation, setSubFormation] = useState<SubFormationRecord | null>(null)
  const [plays, setPlays] = useState<PlayRecord[]>([])
  const [depthChartEntries, setDepthChartEntries] = useState<DepthChartSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [playSearchQuery, setPlaySearchQuery] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [fRes, sfRes, pRes, dcRes] = await Promise.all([
        fetch(`/api/formations/${formationId}`),
        fetch(`/api/sub-formations/${subFormationId}`).catch(() => null),
        fetch(`/api/plays?teamId=${teamId}&formationId=${formationId}`),
        fetch(`/api/roster/depth-chart?teamId=${teamId}`),
      ])
      if (fRes?.ok) setFormation(await fRes.json())
      if (sfRes?.ok) {
        const data = await sfRes.json()
        setSubFormation(data)
      } else {
        const listRes = await fetch(`/api/sub-formations?teamId=${teamId}&formationId=${formationId}`)
        if (listRes.ok) {
          const list = await listRes.json()
          const found = list.find((s: SubFormationRecord) => s.id === subFormationId)
          setSubFormation(found ?? null)
        }
      }
      if (pRes.ok) setPlays((await pRes.json()).filter((p: PlayRecord) => p.subFormationId === subFormationId))
      if (dcRes.ok) {
        const dc = await dcRes.json()
        setDepthChartEntries(dc.entries ?? [])
      }
    } catch (e) {
      console.error("Failed to load sub-formation", e)
    } finally {
      setLoading(false)
    }
  }, [formationId, subFormationId, teamId])

  useEffect(() => {
    load()
  }, [load])

  const handleDuplicatePlay = useCallback(
    async (playId: string) => {
      try {
        const res = await fetch(`/api/plays/${playId}/duplicate`, { method: "POST" })
        if (!res.ok) throw new Error("Failed to duplicate")
        const newPlay = await res.json()
        showToast("Play duplicated", "success")
        const returnUrl = `/dashboard/playbooks/${playbookId}/formation/${formationId}/subformation/${subFormationId}`
        router.push(`/dashboard/playbooks/play/${newPlay.id}?returnUrl=${encodeURIComponent(returnUrl)}`)
      } catch {
        showToast("Failed to duplicate play", "error")
      }
    },
    [playbookId, formationId, subFormationId, router, showToast]
  )
  const filteredPlays = filterPlaysBySearch(plays, playSearchQuery)

  const handleReorderPlays = useCallback((reordered: PlayRecord[]) => {
    setPlays(reordered)
  }, [])

  const handleRenamePlay = async (playId: string, newName: string) => {
    try {
      const res = await fetch(`/api/plays/${playId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      })
      if (res.ok) load()
    } catch {
      alert("Failed to rename play")
    }
  }
  const handleDeletePlay = async (playId: string) => {
    try {
      const res = await fetch(`/api/plays/${playId}`, { method: "DELETE" })
      if (res.ok) load()
    } catch {
      alert("Failed to delete play")
    }
  }

  const playEditorPath = (playId: string) =>
    `/dashboard/playbooks/${playbookId}/formation/${formationId}/subformation/${subFormationId}/play/${playId}/edit`

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] bg-slate-50 rounded-2xl">
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    )
  }
  if (!subFormation || !formation) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-sm text-slate-500">Sub-formation not found</p>
        <Button variant="outline" onClick={() => router.push(`/dashboard/playbooks/${playbookId}/formation/${formationId}`)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
      </div>
    )
  }

  const breadcrumbs = [
    { label: "Playbooks", href: "/dashboard/playbooks" },
    { label: "Playbook", href: `/dashboard/playbooks/${playbookId}` },
    { label: formation.name, href: `/dashboard/playbooks/${playbookId}/formation/${formationId}` },
    { label: subFormation.name, href: `/dashboard/playbooks/${playbookId}/formation/${formationId}/subformation/${subFormationId}` },
  ]

  return (
    <div className="min-h-[775px] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex-shrink-0 border-b border-slate-200 bg-white px-5 py-4 sm:px-6 sm:py-5">
        <PlaybookBreadcrumbs items={breadcrumbs} className="mb-3" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{subFormation.name}</h1>
            <p className="mt-1 text-sm text-slate-600">Plays in this sub-formation.</p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/playbooks/${playbookId}/formation/${formationId}`)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            {canEdit && (
              <>
                <Button size="sm" onClick={() => router.push(`/dashboard/playbooks/${playbookId}/formation/${formationId}/subformation/${subFormationId}/edit`)}>
                  Edit sub-formation
                </Button>
                <Button size="sm" variant="secondary" onClick={() => router.push(`/dashboard/playbooks/${playbookId}/formation/${formationId}/subformation/${subFormationId}/play/new`)}>
                  <Plus className="h-4 w-4 mr-1" /> New play
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-slate-50">
        {plays.length === 0 ? (
          <div className="py-12 text-center rounded-xl border border-dashed border-slate-200 bg-white/60">
            <p className="text-slate-600 font-medium">No plays yet</p>
            {canEdit && (
              <Button size="sm" className="mt-4" onClick={() => router.push(`/dashboard/playbooks/${playbookId}/formation/${formationId}/subformation/${subFormationId}/play/new`)}>
                <Plus className="h-4 w-4 mr-1" /> New play
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Plays (this sub-formation)</h2>
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="search"
                  placeholder="Search plays..."
                  value={playSearchQuery}
                  onChange={(e) => setPlaySearchQuery(e.target.value)}
                  className="pl-8 h-9 text-sm"
                />
              </div>
            </div>
            <SortablePlayList
              plays={filteredPlays}
              formations={formation ? [formation] : []}
              depthChartEntries={depthChartEntries}
              canEdit={canEdit && !playSearchQuery.trim()}
            playEditorPath={playEditorPath}
            onDuplicate={handleDuplicatePlay}
            onRename={handleRenamePlay}
            onDelete={handleDeletePlay}
            onReorder={handleReorderPlays}
            reorderScopeKey={subFormationId}
          />
          </>
        )}
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">Collaboration</h2>
          <CommentThreadPanel parentType="sub_formation" parentId={subFormationId} defaultCollapsed={true} />
        </section>
      </div>
    </div>
  )
}

export default function SubFormationDetailPage() {
  const params = useParams()
  const playbookId = typeof params?.playbookId === "string" ? params.playbookId : null
  const formationId = typeof params?.formationId === "string" ? params.formationId : null
  const subFormationId = typeof params?.subFormationId === "string" ? params.subFormationId : null

  if (!playbookId || !formationId || !subFormationId) {
    return (
      <DashboardPageShell>
        {() => <p className="p-6 text-sm text-slate-500">Invalid route</p>}
      </DashboardPageShell>
    )
  }

  return (
    <DashboardPageShell>
      {({ teamId, canEdit }) => (
        <SubFormationDetailContent
          playbookId={playbookId}
          formationId={formationId}
          subFormationId={subFormationId}
          teamId={teamId}
          canEdit={canEdit}
        />
      )}
    </DashboardPageShell>
  )
}

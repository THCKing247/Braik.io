"use client"

import { useParams, useRouter } from "next/navigation"
import { useState, useEffect, useMemo } from "react"
import { FieldCoordinateSystem } from "@/components/portal/playbook-field-surface"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { PlaybookBreadcrumbs } from "@/components/portal/playbook-breadcrumbs"
import { PlaybookBuilder, type CanvasData } from "@/components/portal/playbook-builder"
import { templateDataToCanvasData } from "@/lib/utils/playbook-canvas"
import { canvasPlayersToTemplateData } from "@/lib/utils/playbook-canvas"
import type { FormationRecord } from "@/types/playbook"
import type { PlayCanvasData } from "@/types/playbook"

export default function FormationEditPage() {
  const params = useParams()
  const router = useRouter()
  const playbookId = typeof params?.playbookId === "string" ? params.playbookId : null
  const formationId = typeof params?.formationId === "string" ? params.formationId : null

  const [formation, setFormation] = useState<FormationRecord | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!formationId) {
      setLoading(false)
      return
    }
    fetch(`/api/formations/${formationId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setFormation(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [formationId])

  const initialCanvasData: CanvasData | null = useMemo(() => {
    if (!formation) return null
    const defaultTemplate = { fieldView: "HALF" as const, shapes: [], paths: [] }
    const raw = templateDataToCanvasData(formation.templateData ?? defaultTemplate, formation.side)
    const coord = new FieldCoordinateSystem(800, 600, 15, 50)
    const playersWithPixels = raw.players.map((p) => {
      const xYards = p.xYards ?? 0
      const yYards = p.yYards ?? 0
      const { x, y } = coord.yardToPixel(xYards, yYards)
      return { ...p, x, y, xYards, yYards }
    })
    return {
      players: playersWithPixels,
      zones: [],
      manCoverages: [],
      fieldType: "half",
      side: formation.side,
    }
  }, [formation])

  const handleSave = async (data: CanvasData, _name: string) => {
    if (!formationId || !formation) return
    const playCanvasData: PlayCanvasData = {
      players: data.players.map((p) => ({
        id: p.id,
        x: p.x,
        y: p.y,
        xYards: p.xYards ?? 0,
        yYards: p.yYards ?? 0,
        label: p.label,
        shape: p.shape,
      })),
      zones: [],
      manCoverages: [],
      fieldType: "half",
      side: formation.side,
    }
    const templateData = canvasPlayersToTemplateData(playCanvasData.players, formation.side)
    try {
      const res = await fetch(`/api/formations/${formationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateData }),
      })
      if (res.ok) router.push(`/dashboard/playbooks/${playbookId}/formation/${formationId}`)
      else alert("Failed to save formation")
    } catch {
      alert("Failed to save formation")
    }
  }

  const handleClose = () => {
    router.push(`/dashboard/playbooks/${playbookId}/formation/${formationId}`)
  }

  const breadcrumbs = [
    { label: "Playbooks", href: "/dashboard/playbooks" },
    { label: "Playbook", href: playbookId ? `/dashboard/playbooks/${playbookId}` : undefined },
    { label: formation?.name ?? "Formation", href: formationId ? `/dashboard/playbooks/${playbookId}/formation/${formationId}` : undefined },
    { label: "Edit" },
  ]

  if (!playbookId || !formationId) {
    return (
      <DashboardPageShell>
        {() => <p className="p-6 text-sm text-slate-500">Invalid route</p>}
      </DashboardPageShell>
    )
  }

  if (loading || !formation) {
    return (
      <DashboardPageShell>
        {() => (
          <div className="flex items-center justify-center min-h-[400px]">
            <p className="text-sm text-slate-500">{loading ? "Loading..." : "Formation not found"}</p>
          </div>
        )}
      </DashboardPageShell>
    )
  }

  return (
    <DashboardPageShell>
      {({ canEdit }) => (
        <div className="min-h-[775px] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex-shrink-0 border-b border-slate-200 bg-white px-5 py-4 sm:px-6 sm:py-5">
            <PlaybookBreadcrumbs items={breadcrumbs} className="mb-3" />
            <h1 className="text-xl font-semibold text-slate-900">Edit formation: {formation.name}</h1>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <PlaybookBuilder
              playId={null}
              playData={initialCanvasData}
              playName={formation.name}
              editorSourceKey={`formation-${formationId}`}
              side={formation.side}
              formation={formation.name}
              onSave={handleSave}
              onClose={handleClose}
              canEdit={canEdit}
              isTemplateMode={true}
              templateName={formation.name}
            />
          </div>
        </div>
      )}
    </DashboardPageShell>
  )
}

"use client"

import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { usePlaybookToast } from "@/components/portal/playbook-toast"
import { useEditorSaveState } from "@/lib/hooks/use-editor-save-state"
import { EditorSaveStatusChip } from "@/components/portal/editor-save-status"
import { LeaveWithoutSavingDialog } from "@/components/portal/leave-without-saving-dialog"
import { ConfirmDestructiveDialog } from "@/components/portal/confirm-destructive-dialog"
import { FieldCoordinateSystem } from "@/components/portal/playbook-field-surface"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { PlaybookBreadcrumbs } from "@/components/portal/playbook-breadcrumbs"
import { PlaybookBuilder, type CanvasData } from "@/components/portal/playbook-builder"
import { templateDataToCanvasData } from "@/lib/utils/playbook-canvas"
import { canvasPlayersToTemplateData } from "@/lib/utils/playbook-canvas"
import type { FormationRecord } from "@/types/playbook"
import type { PlayCanvasData } from "@/types/playbook"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { CommentThreadPanel } from "@/components/portal/comment-thread-panel"
import { Trash2 } from "lucide-react"

const AUTO_SAVE_DEBOUNCE_MS = 8000

export default function FormationEditPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { showToast } = usePlaybookToast()
  const saveState = useEditorSaveState("saved")
  const playbookId = typeof params?.playbookId === "string" ? params.playbookId : null
  const formationId = typeof params?.formationId === "string" ? params.formationId : null
  const triggerSaveRef = useRef<(() => void | Promise<void>) | null>(null)
  const createdHandledRef = useRef(false)

  const [formation, setFormation] = useState<FormationRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true)
  const [formationDeleteDialogOpen, setFormationDeleteDialogOpen] = useState(false)
  const [formationDeleteImpact, setFormationDeleteImpact] = useState<{
    subFormationsCount: number
    directPlaysCount: number
    subFormationPlaysCount: number
    totalPlaysCount: number
  } | null>(null)
  const [formationDeleteImpactLoading, setFormationDeleteImpactLoading] = useState(false)
  const [formationDeleting, setFormationDeleting] = useState(false)

  useEffect(() => {
    if (!formationDeleteDialogOpen || !formationId) return
    setFormationDeleteImpactLoading(true)
    fetch(`/api/formations/${formationId}/delete-impact`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setFormationDeleteImpact)
      .catch(() => setFormationDeleteImpact(null))
      .finally(() => setFormationDeleteImpactLoading(false))
  }, [formationDeleteDialogOpen, formationId])

  const handleConfirmDeleteFormation = useCallback(async () => {
    if (!formationId) return
    setFormationDeleting(true)
    try {
      const res = await fetch(`/api/formations/${formationId}`, { method: "DELETE" })
      if (res.ok) {
        showToast("Formation deleted", "success")
        setFormationDeleteDialogOpen(false)
        router.push(`/dashboard/playbooks/${playbookId}`)
      } else {
        showToast("Could not delete formation", "error")
      }
    } catch {
      showToast("Could not delete formation", "error")
    } finally {
      setFormationDeleting(false)
    }
  }, [formationId, playbookId, router, showToast])

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

  useEffect(() => {
    if (searchParams.get("created") !== "1" || !playbookId || !formationId || createdHandledRef.current) return
    createdHandledRef.current = true
    showToast("Formation created", "success")
    router.replace(`/dashboard/playbooks/${playbookId}/formation/${formationId}/edit`, { scroll: false })
  }, [searchParams, playbookId, formationId, router, showToast])

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

  const handleSave = useCallback(
    async (data: CanvasData, _name: string) => {
      if (!formationId || !formation) return
      saveState.setSaving()
      try {
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
        const res = await fetch(`/api/formations/${formationId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateData }),
        })
        if (res.ok) {
          saveState.setSaved()
          showToast("Formation saved", "success")
        } else {
          saveState.setError()
          showToast("Save failed. Please try again.", "error")
          throw new Error("Failed to save formation")
        }
      } catch (err) {
        saveState.setError()
        showToast("Save failed. Please try again.", "error")
        throw err
      }
    },
    [formationId, formation, saveState, showToast]
  )

  const handleClose = () => {
    saveState.confirmBeforeNavigate(() => router.push(`/dashboard/playbooks/${playbookId}/formation/${formationId}`))
  }

  useEffect(() => {
    if (!autoSaveEnabled || saveState.status !== "dirty") return
    const t = setTimeout(() => {
      triggerSaveRef.current?.()
    }, AUTO_SAVE_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [autoSaveEnabled, saveState.status])

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
            <div className="flex items-center gap-3 flex-wrap">
              <PlaybookBreadcrumbs items={breadcrumbs} className="mb-0" confirmBeforeNavigate={saveState.confirmBeforeNavigate} />
              <EditorSaveStatusChip status={saveState.status} lastSavedAt={saveState.lastSavedAt} />
              <div className="flex items-center gap-2 ml-auto">
                <Label htmlFor="auto-save-formation" className="text-xs text-slate-600 whitespace-nowrap cursor-pointer">Auto-save</Label>
                <Checkbox
                  id="auto-save-formation"
                  checked={autoSaveEnabled}
                  onCheckedChange={setAutoSaveEnabled}
                />
                {canEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => setFormationDeleteDialogOpen(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete formation
                  </Button>
                )}
              </div>
            </div>
            <h1 className="text-xl font-semibold text-slate-900 mt-2">Edit formation: {formation.name}</h1>
            <p className="mt-0.5 text-sm text-slate-500">Design alignment and player positions for this formation.</p>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
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
              onDirty={saveState.setDirty}
              triggerSaveRef={triggerSaveRef}
              canEdit={canEdit}
              isTemplateMode={true}
              templateName={formation.name}
            />
            </div>
            <div className="flex-shrink-0 p-4 border-t border-slate-200 bg-slate-50/50">
              <CommentThreadPanel parentType="formation" parentId={formationId} defaultCollapsed={true} />
            </div>
          </div>
          <LeaveWithoutSavingDialog
            open={saveState.leaveDialogOpen}
            onOpenChange={(open) => { if (!open) saveState.handleLeaveCancel(); saveState.setLeaveDialogOpen(open); }}
            onConfirm={saveState.handleLeaveConfirm}
            onCancel={saveState.handleLeaveCancel}
          />
          <ConfirmDestructiveDialog
            open={formationDeleteDialogOpen}
            onOpenChange={setFormationDeleteDialogOpen}
            title="Delete this formation?"
            message="This will also permanently delete all sub-formations and all plays under this formation, including plays inside its sub-formations. This action cannot be undone."
            impactItems={formationDeleteImpact ? [
              { label: "Sub-formations to delete", value: formationDeleteImpact.subFormationsCount },
              { label: "Direct plays to delete", value: formationDeleteImpact.directPlaysCount },
              { label: "Sub-formation plays to delete", value: formationDeleteImpact.subFormationPlaysCount },
              { label: "Total plays to delete", value: formationDeleteImpact.totalPlaysCount },
            ] : undefined}
            isLoadingImpact={formationDeleteImpactLoading}
            confirmLabel="Delete"
            cancelLabel="Cancel"
            onConfirm={handleConfirmDeleteFormation}
            isDeleting={formationDeleting}
          />
        </div>
      )}
    </DashboardPageShell>
  )
}

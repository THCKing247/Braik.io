"use client"

import { useParams, useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect, useMemo, useRef } from "react"
import { usePlaybookToast } from "@/components/portal/playbook-toast"
import { useEditorSaveState } from "@/lib/hooks/use-editor-save-state"
import { EditorSaveStatusChip } from "@/components/portal/editor-save-status"
import { LeaveWithoutSavingDialog } from "@/components/portal/leave-without-saving-dialog"
import { FieldCoordinateSystem } from "@/components/portal/playbook-field-surface"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { PlaybookBreadcrumbs } from "@/components/portal/playbook-breadcrumbs"
import { PlaybookBuilder, type CanvasData } from "@/components/portal/playbook-builder"
import { templateDataToCanvasData } from "@/lib/utils/playbook-canvas"
import { canvasPlayersToTemplateData } from "@/lib/utils/playbook-canvas"
import type { SubFormationRecord, TemplateData } from "@/types/playbook"
import type { PlayCanvasData } from "@/types/playbook"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { CommentThreadPanel } from "@/components/portal/comment-thread-panel"

const AUTO_SAVE_DEBOUNCE_MS = 8000

export default function SubFormationEditPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { showToast } = usePlaybookToast()
  const saveState = useEditorSaveState("saved")
  const playbookId = typeof params?.playbookId === "string" ? params.playbookId : null
  const formationId = typeof params?.formationId === "string" ? params.formationId : null
  const subFormationId = typeof params?.subFormationId === "string" ? params.subFormationId : null
  const triggerSaveRef = useRef<(() => void | Promise<void>) | null>(null)

  const [subFormation, setSubFormation] = useState<SubFormationRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true)

  useEffect(() => {
    if (!subFormationId) {
      setLoading(false)
      return
    }
    fetch(`/api/sub-formations/${subFormationId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setSubFormation(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [subFormationId])

  useEffect(() => {
    if (searchParams.get("created") === "1") {
      showToast("Sub-formation created. You can now design the sub-formation.", "success")
      router.replace(`/dashboard/playbooks/${playbookId}/formation/${formationId}/subformation/${subFormationId}/edit`, { scroll: false })
    }
  }, [searchParams, playbookId, formationId, subFormationId, router, showToast])

  const initialCanvasData: CanvasData | null = useMemo(() => {
    if (!subFormation) return null
    const defaultTemplate: TemplateData = { fieldView: "HALF", shapes: [], paths: [] }
    const raw = templateDataToCanvasData(subFormation.templateData ?? defaultTemplate, subFormation.side)
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
      side: subFormation.side,
    }
  }, [subFormation])

  const handleSave = async (data: CanvasData, _name: string) => {
    if (!subFormationId || !subFormation) return
    saveState.setSaving()
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
      side: subFormation.side,
    }
    const templateData = canvasPlayersToTemplateData(playCanvasData.players, subFormation.side)
    const res = await fetch(`/api/sub-formations/${subFormationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateData }),
    })
    if (res.ok) {
      saveState.setSaved()
      showToast("Sub-formation saved", "success")
    } else {
      saveState.setError()
      showToast("Save failed. Please try again.", "error")
      throw new Error("Failed to save sub-formation")
    }
  }

  const handleClose = () => {
    saveState.confirmBeforeNavigate(() => router.push(`/dashboard/playbooks/${playbookId}/formation/${formationId}/subformation/${subFormationId}`))
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
    { label: "Formation", href: formationId ? `/dashboard/playbooks/${playbookId}/formation/${formationId}` : undefined },
    { label: subFormation?.name ?? "Sub-formation", href: subFormationId ? `/dashboard/playbooks/${playbookId}/formation/${formationId}/subformation/${subFormationId}` : undefined },
    { label: "Edit" },
  ]

  if (!playbookId || !formationId || !subFormationId) {
    return (
      <DashboardPageShell>
        {() => <p className="p-6 text-sm text-slate-500">Invalid route</p>}
      </DashboardPageShell>
    )
  }

  if (loading || !subFormation) {
    return (
      <DashboardPageShell>
        {() => (
          <div className="flex items-center justify-center min-h-[400px]">
            <p className="text-sm text-slate-500">{loading ? "Loading..." : "Sub-formation not found"}</p>
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
                <Label htmlFor="auto-save-subformation" className="text-xs text-slate-600 whitespace-nowrap cursor-pointer">Auto-save</Label>
                <Checkbox
                  id="auto-save-subformation"
                  checked={autoSaveEnabled}
                  onCheckedChange={setAutoSaveEnabled}
                />
              </div>
            </div>
            <h1 className="text-xl font-semibold text-slate-900 mt-2">Edit sub-formation: {subFormation.name}</h1>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <PlaybookBuilder
              playId={null}
              playData={initialCanvasData}
              playName={subFormation.name}
              editorSourceKey={`subformation-${subFormationId}`}
              side={subFormation.side}
              formation={subFormation.name}
              onSave={handleSave}
              onClose={handleClose}
              onDirty={saveState.setDirty}
              triggerSaveRef={triggerSaveRef}
              canEdit={canEdit}
              isTemplateMode={true}
              templateName={subFormation.name}
            />
            </div>
            <div className="flex-shrink-0 p-4 border-t border-slate-200 bg-slate-50/50">
              <CommentThreadPanel parentType="sub_formation" parentId={subFormationId} defaultCollapsed={true} />
            </div>
          </div>
          <LeaveWithoutSavingDialog
            open={saveState.leaveDialogOpen}
            onOpenChange={(open) => { if (!open) saveState.handleLeaveCancel(); saveState.setLeaveDialogOpen(open); }}
            onConfirm={saveState.handleLeaveConfirm}
            onCancel={saveState.handleLeaveCancel}
          />
        </div>
      )}
    </DashboardPageShell>
  )
}

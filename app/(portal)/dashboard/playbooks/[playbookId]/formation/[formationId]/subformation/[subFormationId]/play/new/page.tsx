"use client"

import { useParams, useRouter } from "next/navigation"
import { useState, useEffect, useRef } from "react"
import { templateDataToCanvasData } from "@/lib/utils/playbook-canvas"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { usePlaybookToast } from "@/components/portal/playbook-toast"
import type { FormationRecord, SubFormationRecord } from "@/types/playbook"

function CreateSubFormationPlayRedirect({
  playbookId,
  formationId,
  subFormationId,
  teamId,
  formation,
  subFormation,
}: {
  playbookId: string
  formationId: string
  subFormationId: string
  teamId: string
  formation: FormationRecord
  subFormation: SubFormationRecord
}) {
  const router = useRouter()
  const { showToast } = usePlaybookToast()
  const done = useRef(false)
  useEffect(() => {
    if (done.current) return
    done.current = true
    const defaultTemplate = { fieldView: "HALF" as const, shapes: [], paths: [] }
    const template = subFormation.templateData ?? formation.templateData ?? defaultTemplate
    const side = subFormation.side ?? formation.side
    const canvasData = templateDataToCanvasData(template, side)
    fetch("/api/plays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teamId,
        playbookId,
        formationId,
        subFormationId,
        side,
        formation: formation.name,
        name: "New Play",
        canvasData,
      }),
    })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to create play")
        return r.json()
      })
      .then((play) => {
        const returnUrl = `/dashboard/playbooks/${playbookId}/formation/${formationId}/subformation/${subFormationId}`
        router.replace(`/dashboard/playbooks/play/${play.id}?returnUrl=${encodeURIComponent(returnUrl)}`)
      })
      .catch(() => {
        showToast("Could not create play", "error")
        router.replace(`/dashboard/playbooks/${playbookId}/formation/${formationId}/subformation/${subFormationId}`)
      })
  }, [playbookId, formationId, subFormationId, teamId, formation, subFormation, router, showToast])
  return (
    <div className="flex items-center justify-center min-h-[400px] bg-slate-50">
      <p className="text-sm text-slate-500">Creating play...</p>
    </div>
  )
}

function SubFormationPlayNewContent({
  playbookId,
  formationId,
  subFormationId,
  teamId,
}: {
  playbookId: string
  formationId: string
  subFormationId: string
  teamId: string
}) {
  const [formation, setFormation] = useState<FormationRecord | null>(null)
  const [subFormation, setSubFormation] = useState<SubFormationRecord | null>(null)

  useEffect(() => {
    fetch(`/api/formations/${formationId}`).then((r) => (r.ok ? r.json() : null)).then(setFormation)
  }, [formationId])
  useEffect(() => {
    fetch(`/api/sub-formations/${subFormationId}`).then((r) => (r.ok ? r.json() : null)).then(setSubFormation)
  }, [subFormationId])

  if (!formation || !subFormation) {
    return (
      <div className="flex items-center justify-center min-h-[400px] bg-slate-50">
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    )
  }
  return (
    <CreateSubFormationPlayRedirect
      playbookId={playbookId}
      formationId={formationId}
      subFormationId={subFormationId}
      teamId={teamId}
      formation={formation}
      subFormation={subFormation}
    />
  )
}

export default function NewSubFormationPlayPage() {
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
      {({ teamId }) => (
        <SubFormationPlayNewContent
          playbookId={playbookId}
          formationId={formationId}
          subFormationId={subFormationId}
          teamId={teamId}
        />
      )}
    </DashboardPageShell>
  )
}

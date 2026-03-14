"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { templateDataToCanvasData } from "@/lib/utils/playbook-canvas"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import type { FormationRecord } from "@/types/playbook"

function CreateFormationPlayRedirect({
  playbookId,
  formationId,
  teamId,
  formation,
}: {
  playbookId: string
  formationId: string
  teamId: string
  formation: FormationRecord
}) {
  const router = useRouter()
  const done = useRef(false)
  useEffect(() => {
    if (done.current) return
    done.current = true
    const defaultTemplate = { fieldView: "HALF" as const, shapes: [], paths: [] }
    const template = formation.templateData ?? defaultTemplate
    const canvasData = templateDataToCanvasData(template, formation.side)
    fetch("/api/plays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teamId,
        playbookId,
        formationId,
        side: formation.side,
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
        const returnUrl = `/dashboard/playbooks/${playbookId}/formation/${formationId}`
        router.replace(`/dashboard/playbooks/play/${play.id}?returnUrl=${encodeURIComponent(returnUrl)}`)
      })
      .catch(() => alert("Failed to create play"))
  }, [playbookId, formationId, teamId, formation, router])
  return (
    <div className="flex items-center justify-center min-h-[400px] bg-slate-50">
      <p className="text-sm text-slate-500">Creating play...</p>
    </div>
  )
}

export default function NewFormationPlayPage() {
  const params = useParams()
  const playbookId = typeof params?.playbookId === "string" ? params.playbookId : null
  const formationId = typeof params?.formationId === "string" ? params.formationId : null

  if (!playbookId || !formationId) {
    return (
      <DashboardPageShell>
        {() => <p className="p-6 text-sm text-slate-500">Invalid route</p>}
      </DashboardPageShell>
    )
  }

  return (
    <DashboardPageShell>
      {({ teamId }) => (
        <FormationPlayNewContent playbookId={playbookId} formationId={formationId} teamId={teamId} />
      )}
    </DashboardPageShell>
  )
}

function FormationPlayNewContent({
  playbookId,
  formationId,
  teamId,
}: {
  playbookId: string
  formationId: string
  teamId: string
}) {
  const [formation, setFormation] = useState<FormationRecord | null>(null)

  useEffect(() => {
    fetch(`/api/formations/${formationId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setFormation)
  }, [formationId])

  if (!formation) {
    return (
      <div className="flex items-center justify-center min-h-[400px] bg-slate-50">
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    )
  }
  return (
    <CreateFormationPlayRedirect
      playbookId={playbookId}
      formationId={formationId}
      teamId={teamId}
      formation={formation}
    />
  )
}


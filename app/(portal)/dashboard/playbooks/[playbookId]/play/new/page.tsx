"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect } from "react"
import { templateDataToCanvasData } from "@/lib/utils/playbook-canvas"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"

function CreatePlayRedirect({ playbookId, teamId }: { playbookId: string; teamId: string }) {
  const router = useRouter()
  useEffect(() => {
    const defaultTemplate = { fieldView: "HALF" as const, shapes: [], paths: [] }
    const canvasData = templateDataToCanvasData(defaultTemplate, "offense")
    fetch("/api/plays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        teamId,
        playbookId,
        side: "offense",
        formation: "Custom",
        name: "New Play",
        canvasData,
      }),
    })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to create play")
        return r.json()
      })
      .then((play) => {
        const returnUrl = `/dashboard/playbooks/${playbookId}`
        router.replace(`/dashboard/playbooks/play/${play.id}?returnUrl=${encodeURIComponent(returnUrl)}`)
      })
      .catch(() => alert("Failed to create play"))
  }, [playbookId, teamId, router])
  return (
    <div className="flex items-center justify-center min-h-[400px] bg-slate-50">
      <p className="text-sm text-slate-500">Creating play...</p>
    </div>
  )
}

export default function NewPlayPage() {
  const params = useParams()
  const playbookId = typeof params?.playbookId === "string" ? params.playbookId : null

  if (!playbookId) {
    return (
      <DashboardPageShell>
        {() => <p className="p-6 text-sm text-slate-500">Invalid playbook</p>}
      </DashboardPageShell>
    )
  }

  return (
    <DashboardPageShell>
      {({ teamId }) => <CreatePlayRedirect playbookId={playbookId} teamId={teamId} />}
    </DashboardPageShell>
  )
}

"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect, useRef } from "react"
import { templateDataToCanvasData } from "@/lib/utils/playbook-canvas"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { usePlaybookToast } from "@/components/portal/playbook-toast"
import type { TemplateData } from "@/types/playbook"

function CreatePlayRedirect({ playbookId, teamId }: { playbookId: string; teamId: string }) {
  const router = useRouter()
  const { showToast } = usePlaybookToast()
  const done = useRef(false)
  useEffect(() => {
    if (done.current) return
    done.current = true
    const defaultTemplate: TemplateData = { fieldView: "HALF", shapes: [], paths: [] }
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
      .catch(() => {
        showToast("Could not create play", "error")
        router.replace(`/dashboard/playbooks/${playbookId}`)
      })
  }, [playbookId, teamId, router, showToast])
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

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
      .then(async (r) => {
        const data = await r.json().catch(() => ({}))
        if (!r.ok) {
          if (process.env.NODE_ENV !== "production") {
            console.warn("[Create play] Server error:", {
              error: (data as { error?: string }).error,
              phase: (data as { phase?: string }).phase,
              debugId: (data as { debugId?: string }).debugId,
              details: (data as { details?: unknown }).details,
            })
          }
          throw new Error((data as { error?: string }).error ?? "Failed to create play")
        }
        return data as { id: string }
      })
      .then((play) => {
        showToast("Play created", "success")
        const returnUrl = `/dashboard/playbooks/${playbookId}`
        router.replace(`/dashboard/playbooks/play/${play.id}?returnUrl=${encodeURIComponent(returnUrl)}`)
      })
      .catch(() => {
        showToast("Could not create play", "error")
        router.replace(`/dashboard/playbooks/${playbookId}`)
      })
  }, [playbookId, teamId, router, showToast])
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] bg-slate-50 rounded-2xl border border-slate-200">
      <p className="text-sm font-medium text-slate-700">New play</p>
      <p className="text-xs text-slate-500 mt-1">Creating play...</p>
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

"use client"

import { useParams, useRouter } from "next/navigation"
import { useState, useEffect, useCallback } from "react"
import { ArrowLeft, Plus, ListOrdered } from "lucide-react"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { PlaybookBreadcrumbs } from "@/components/portal/playbook-breadcrumbs"
import { Button } from "@/components/ui/button"
import { usePlaybookToast } from "@/components/portal/playbook-toast"
import type { PlaybookRecord } from "@/types/playbook"

type InstallScriptSummary = {
  id: string
  playbookId: string
  teamId: string
  name: string
  createdAt: string
}

export default function InstallScriptsListPage() {
  const params = useParams()
  const router = useRouter()
  const playbookId = typeof params?.playbookId === "string" ? params.playbookId : null
  const { showToast } = usePlaybookToast()

  const [playbook, setPlaybook] = useState<PlaybookRecord | null>(null)
  const [scripts, setScripts] = useState<InstallScriptSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    if (!playbookId) return
    setLoading(true)
    try {
      const [pbRes, sRes] = await Promise.all([
        fetch(`/api/playbooks/${playbookId}`),
        fetch(`/api/playbooks/${playbookId}/install-scripts`),
      ])
      if (pbRes.ok) setPlaybook(await pbRes.json())
      if (sRes.ok) setScripts(await sRes.json())
    } catch (e) {
      console.error("Failed to load install scripts", e)
      showToast("Failed to load install scripts", "error")
    } finally {
      setLoading(false)
    }
  }, [playbookId, showToast])

  useEffect(() => {
    load()
  }, [load])

  const handleCreate = async () => {
    if (!playbookId || creating) return
    setCreating(true)
    try {
      const res = await fetch(`/api/playbooks/${playbookId}/install-scripts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Install script" }),
      })
      if (res.ok) {
        const script = await res.json()
        showToast("Install script created", "success")
        router.push(`/dashboard/playbooks/${playbookId}/install-scripts/${script.id}`)
      } else {
        showToast("Failed to create install script", "error")
      }
    } catch {
      showToast("Failed to create install script", "error")
    } finally {
      setCreating(false)
    }
  }

  const breadcrumbs = [
    { label: "Playbooks", href: "/dashboard/playbooks" },
    { label: playbook?.name ?? "Playbook", href: playbookId ? `/dashboard/playbooks/${playbookId}` : undefined },
    { label: "Install scripts" },
  ]

  if (!playbookId) {
    return (
      <DashboardPageShell>
        {() => <p className="p-6 text-sm text-slate-500">Invalid playbook</p>}
      </DashboardPageShell>
    )
  }

  if (loading) {
    return (
      <DashboardPageShell>
        {() => (
          <div className="flex items-center justify-center min-h-[400px]">
            <p className="text-sm text-slate-500">Loading...</p>
          </div>
        )}
      </DashboardPageShell>
    )
  }

  return (
    <DashboardPageShell>
      {() => (
        <div className="min-h-[775px] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex-shrink-0 border-b border-slate-200 bg-white px-5 py-4 sm:px-6 sm:py-5">
            <PlaybookBreadcrumbs items={breadcrumbs} className="mb-3" />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-xl font-semibold text-slate-900">Install scripts</h1>
                <p className="mt-1 text-sm text-slate-600">
                  Build ordered play lists for the presenter. Open a script in presenter mode to follow script order.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/playbooks/${playbookId}`)}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <Button size="sm" onClick={handleCreate} disabled={creating}>
                  <Plus className="h-4 w-4 mr-1" /> New script
                </Button>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-slate-50">
            {scripts.length === 0 ? (
              <div className="py-12 text-center rounded-xl border border-dashed border-slate-200 bg-white">
                <ListOrdered className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600 font-medium">No install scripts yet</p>
                <p className="text-sm text-slate-500 mt-1">
                  Create a script, add plays in order, then present using the script.
                </p>
                <Button size="sm" className="mt-4" onClick={handleCreate} disabled={creating}>
                  <Plus className="h-4 w-4 mr-1" /> New script
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {scripts.map((s) => (
                  <div
                    key={s.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => router.push(`/dashboard/playbooks/${playbookId}/install-scripts/${s.id}`)}
                    onKeyDown={(e) => e.key === "Enter" && router.push(`/dashboard/playbooks/${playbookId}/install-scripts/${s.id}`)}
                    className="flex items-center gap-4 p-4 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <ListOrdered className="h-8 w-8 text-slate-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800">{s.name}</p>
                      <p className="text-xs text-slate-500">
                        Created {new Date(s.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardPageShell>
  )
}

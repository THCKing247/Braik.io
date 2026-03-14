"use client"

import { useParams, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { PlaybookBreadcrumbs } from "@/components/portal/playbook-breadcrumbs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { PlaybookRecord } from "@/types/playbook"

export default function EditPlaybookPage() {
  const params = useParams()
  const router = useRouter()
  const playbookId = typeof params?.playbookId === "string" ? params.playbookId : null
  const [playbook, setPlaybook] = useState<PlaybookRecord | null>(null)
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!playbookId) {
      setLoading(false)
      return
    }
    fetch(`/api/playbooks/${playbookId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setPlaybook(data)
          setName(data.name ?? "")
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [playbookId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!playbookId || !name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/playbooks/${playbookId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError((data as { error?: string }).error ?? "Failed to update")
        setSaving(false)
        return
      }
      router.push(`/dashboard/playbooks/${playbookId}`)
    } catch {
      setError("Failed to update playbook")
    } finally {
      setSaving(false)
    }
  }

  const breadcrumbs = [
    { label: "Playbooks", href: "/dashboard/playbooks" },
    { label: playbook?.name ?? "Playbook", href: playbookId ? `/dashboard/playbooks/${playbookId}` : undefined },
    { label: "Edit" },
  ]

  return (
    <DashboardPageShell>
      {() => (
        <div className="min-h-[775px] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex-shrink-0 border-b border-slate-200 bg-white px-5 py-4 sm:px-6 sm:py-5">
            <PlaybookBreadcrumbs items={breadcrumbs} className="mb-3" />
            <h1 className="text-xl font-semibold text-slate-900">Edit playbook</h1>
          </div>
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-slate-50">
            {loading ? (
              <p className="text-sm text-slate-500">Loading...</p>
            ) : !playbook ? (
              <p className="text-sm text-slate-500">Playbook not found</p>
            ) : (
              <form onSubmit={handleSubmit} className="max-w-md space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Playbook name"
                    className="max-w-sm"
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="flex gap-2">
                  <Button type="submit" disabled={saving || !name.trim()}>
                    {saving ? "Saving…" : "Save"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => router.push(`/dashboard/playbooks/${playbookId}`)}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </DashboardPageShell>
  )
}

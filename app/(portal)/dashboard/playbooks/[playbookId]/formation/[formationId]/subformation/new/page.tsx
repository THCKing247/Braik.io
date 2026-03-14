"use client"

import { useParams, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { PlaybookBreadcrumbs } from "@/components/portal/playbook-breadcrumbs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { FormationRecord } from "@/types/playbook"

export default function NewSubFormationPage() {
  const params = useParams()
  const router = useRouter()
  const playbookId = typeof params?.playbookId === "string" ? params.playbookId : null
  const formationId = typeof params?.formationId === "string" ? params.formationId : null
  const [name, setName] = useState("")
  const [formation, setFormation] = useState<FormationRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!formationId) {
      setLoading(false)
      return
    }
    fetch(`/api/formations/${formationId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setFormation)
      .finally(() => setLoading(false))
  }, [formationId])

  const handleSubmit = async (e: React.FormEvent, teamId: string) => {
    e.preventDefault()
    if (!formationId || !name.trim() || !formation) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/sub-formations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          formationId,
          side: formation.side,
          name: name.trim(),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError((data as { error?: string }).error ?? "Failed to create sub-formation")
        setSaving(false)
        return
      }
      const sub = await res.json()
      router.push(`/dashboard/playbooks/${playbookId}/formation/${formationId}/subformation/${sub.id}/edit?created=1`)
    } catch {
      setError("Failed to create sub-formation")
    } finally {
      setSaving(false)
    }
  }

  const breadcrumbs = [
    { label: "Playbooks", href: "/dashboard/playbooks" },
    { label: "Playbook", href: playbookId ? `/dashboard/playbooks/${playbookId}` : undefined },
    { label: formation?.name ?? "Formation", href: formationId ? `/dashboard/playbooks/${playbookId}/formation/${formationId}` : undefined },
    { label: "New sub-formation" },
  ]

  if (!playbookId || !formationId) {
    return (
      <DashboardPageShell>
        {() => <p className="p-6 text-sm text-slate-500">Invalid route</p>}
      </DashboardPageShell>
    )
  }

  if (loading) {
    return (
      <DashboardPageShell>
        {() => <p className="p-6 text-sm text-slate-500">Loading...</p>}
      </DashboardPageShell>
    )
  }

  return (
    <DashboardPageShell>
      {({ teamId }) => (
        <div className="min-h-[775px] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex-shrink-0 border-b border-slate-200 bg-white px-5 py-4 sm:px-6 sm:py-5">
            <PlaybookBreadcrumbs items={breadcrumbs} className="mb-3" />
            <h1 className="text-xl font-semibold text-slate-900">New sub-formation</h1>
          </div>
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-slate-50">
            <form onSubmit={(e) => handleSubmit(e, teamId)} className="max-w-md space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Deuce Close"
                  className="max-w-sm"
                  autoFocus
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2">
                <Button type="submit" disabled={saving || !name.trim()}>
                  {saving ? "Creating…" : "Create sub-formation"}
                </Button>
                <Button type="button" variant="outline" onClick={() => router.push(`/dashboard/playbooks/${playbookId}/formation/${formationId}`)}>
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardPageShell>
  )
}

"use client"

import { useParams, useRouter } from "next/navigation"
import { useState } from "react"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { PlaybookBreadcrumbs } from "@/components/portal/playbook-breadcrumbs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { SideOfBall } from "@/types/playbook"

const SIDES: { value: SideOfBall; label: string }[] = [
  { value: "offense", label: "Offense" },
  { value: "defense", label: "Defense" },
  { value: "special_teams", label: "Special Teams" },
]

export default function NewFormationPage() {
  const params = useParams()
  const router = useRouter()
  const playbookId = typeof params?.playbookId === "string" ? params.playbookId : null
  const [name, setName] = useState("")
  const [side, setSide] = useState<SideOfBall>("offense")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent, teamId: string) => {
    e.preventDefault()
    if (!playbookId || !name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/formations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          playbookId,
          side,
          name: name.trim(),
          templateData: { fieldView: "HALF", shapes: [], paths: [] },
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError((data as { error?: string }).error ?? "Failed to create formation")
        setSaving(false)
        return
      }
      const formation = await res.json()
      router.push(`/dashboard/playbooks/${playbookId}/formation/${formation.id}`)
    } catch {
      setError("Failed to create formation")
    } finally {
      setSaving(false)
    }
  }

  const breadcrumbs = [
    { label: "Playbooks", href: "/dashboard/playbooks" },
    { label: "Playbook", href: playbookId ? `/dashboard/playbooks/${playbookId}` : undefined },
    { label: "New formation" },
  ]

  if (!playbookId) {
    return (
      <DashboardPageShell>
        {() => <p className="p-6 text-sm text-slate-500">Invalid playbook</p>}
      </DashboardPageShell>
    )
  }

  return (
    <DashboardPageShell>
      {({ teamId }) => (
        <div className="min-h-[775px] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex-shrink-0 border-b border-slate-200 bg-white px-5 py-4 sm:px-6 sm:py-5">
            <PlaybookBreadcrumbs items={breadcrumbs} className="mb-3" />
            <h1 className="text-xl font-semibold text-slate-900">New formation</h1>
          </div>
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-slate-50">
            <form onSubmit={(e) => handleSubmit(e, teamId)} className="max-w-md space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Singleback, I-Form"
                  className="max-w-sm"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label>Side</Label>
                <div className="flex gap-2 flex-wrap">
                  {SIDES.map((s) => (
                    <Button
                      key={s.value}
                      type="button"
                      variant={side === s.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSide(s.value)}
                    >
                      {s.label}
                    </Button>
                  ))}
                </div>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2">
                <Button type="submit" disabled={saving || !name.trim()}>
                  {saving ? "Creating…" : "Create formation"}
                </Button>
                <Button type="button" variant="outline" onClick={() => router.push(`/dashboard/playbooks/${playbookId}`)}>
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

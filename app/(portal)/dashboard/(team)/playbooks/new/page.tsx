"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { DashboardPageShell } from "@/components/portal/dashboard-page-shell"
import { PlaybookBreadcrumbs } from "@/components/portal/playbook-breadcrumbs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function NewPlaybookPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const breadcrumbs = [
    { label: "Playbooks", href: "/dashboard/playbooks" },
    { label: "New playbook" },
  ]

  const handleSubmit = async (e: React.FormEvent, teamId: string) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/playbooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, name: name.trim() }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError((data as { error?: string }).error ?? "Failed to create playbook")
        setSaving(false)
        return
      }
      const playbook = await res.json()
      router.push(`/dashboard/playbooks/${playbook.id}`)
    } catch {
      setError("Failed to create playbook")
    } finally {
      setSaving(false)
    }
  }

  return (
    <DashboardPageShell>
      {({ teamId }) => (
          <div className="min-h-[775px] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex-shrink-0 border-b border-slate-200 bg-white px-5 py-4 sm:px-6 sm:py-5">
              <PlaybookBreadcrumbs items={breadcrumbs} className="mb-3" />
              <h1 className="text-xl font-semibold text-slate-900">New playbook</h1>
            </div>
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-slate-50">
              <form onSubmit={(e) => handleSubmit(e, teamId)} className="max-w-md space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. 2024 Offense"
                    className="max-w-sm"
                    autoFocus
                  />
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="flex gap-2">
                  <Button type="submit" disabled={saving || !name.trim()}>
                    {saving ? "Creating…" : "Create playbook"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push("/dashboard/playbooks")}
                  >
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

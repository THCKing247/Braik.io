"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { adminUi } from "@/lib/admin/admin-ui"
import { cn } from "@/lib/utils"

const TEAM_STATUSES = ["active", "suspended", "cancelled", "terminated"] as const

export function AdminTeamStatusForm({
  teamId,
  initialStatus,
}: {
  teamId: string
  initialStatus: string
}) {
  const router = useRouter()
  const [status, setStatus] = useState(initialStatus)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setStatus(initialStatus)
  }, [initialStatus])
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  async function onSave() {
    setSaving(true)
    setError("")
    setSuccess("")
    try {
      const response = await fetch(`/api/admin/teams/${teamId}/service-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamStatus: status }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || "Failed to update team status")
      }
      setSuccess("Status updated")
      router.refresh()
    } catch (err: any) {
      setError(err.message || "Failed to update")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <select
        className={cn(adminUi.toolbarInput, "min-w-[140px]")}
        value={status}
        onChange={(event) => setStatus(event.target.value)}
      >
        {TEAM_STATUSES.map((value) => (
          <option key={value} value={value}>
            {value.toUpperCase()}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className={cn(adminUi.btnPrimarySm, "disabled:opacity-60")}
      >
        {saving ? "Saving..." : "Update"}
      </button>
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
      {!error && success ? <p className="text-xs text-emerald-300">{success}</p> : null}
    </div>
  )
}

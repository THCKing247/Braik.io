"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SPORT_OPTIONS } from "@/lib/pricing-sports"

type Props = {
  teamId: string
  initialName: string
  initialSport: string
  initialRosterSize: number | null
  initialTeamLevel: string | null
  initialGender: string | null
  initialHeadCoachEmail: string | null
}

export function AdTeamEditForm({
  teamId,
  initialName,
  initialSport,
  initialRosterSize,
  initialTeamLevel,
  initialGender,
  initialHeadCoachEmail,
}: Props) {
  const router = useRouter()
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [teamName, setTeamName] = useState(initialName)
  const [sport, setSport] = useState(initialSport || "")
  const [rosterSize, setRosterSize] = useState(
    initialRosterSize != null ? String(initialRosterSize) : ""
  )
  const [teamLevel, setTeamLevel] = useState(() => {
    const lv = (initialTeamLevel ?? "").trim().toLowerCase()
    if (lv === "varsity" || lv === "jv" || lv === "freshman") return lv
    return initialTeamLevel ?? ""
  })
  const [gender, setGender] = useState(() => {
    const g = (initialGender ?? "").trim()
    if (!g) return ""
    const lower = g.toLowerCase()
    if (lower === "boys") return "Boys"
    if (lower === "girls") return "Girls"
    if (lower === "coed" || lower === "mixed") return "Coed"
    return g
  })
  const [headCoachEmail, setHeadCoachEmail] = useState(initialHeadCoachEmail ?? "")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    const name = teamName.trim()
    const sportVal = sport.trim()
    if (!name || !sportVal) {
      setError("Team name and sport are required.")
      return
    }
    setSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        teamName: name,
        sport: sportVal,
        rosterSize: rosterSize.trim() === "" ? null : Math.max(0, parseInt(rosterSize, 10)),
        teamLevel: teamLevel.trim() === "" ? null : teamLevel.toLowerCase(),
        gender: gender.trim() === "" ? null : gender.trim(),
      }
      const hc = headCoachEmail.trim().toLowerCase()
      if (hc) {
        payload.headCoachEmail = hc
      }

      const res = await fetch(`/api/ad/teams/${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError((data as { error?: string }).error ?? "Failed to save.")
        return
      }
      router.refresh()
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="edit-teamName">Team name *</Label>
          <Input
            id="edit-teamName"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-sport">Sport *</Label>
          <select
            id="edit-sport"
            value={sport}
            onChange={(e) => setSport(e.target.value)}
            className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
            required
          >
            <option value="">Select sport</option>
            {SPORT_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="edit-rosterSize">Roster size</Label>
          <Input
            id="edit-rosterSize"
            type="number"
            min={0}
            max={500}
            value={rosterSize}
            onChange={(e) => setRosterSize(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-level">Level</Label>
          <select
            id="edit-level"
            value={teamLevel}
            onChange={(e) => setTeamLevel(e.target.value)}
            className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          >
            <option value="">Not set</option>
            <option value="varsity">Varsity</option>
            <option value="jv">JV</option>
            <option value="freshman">Freshman</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="edit-gender">Gender</Label>
          <select
            id="edit-gender"
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          >
            <option value="">Not set</option>
            <option value="Boys">Boys</option>
            <option value="Girls">Girls</option>
            <option value="Coed">Coed</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-hc-email">Head coach email</Label>
          <Input
            id="edit-hc-email"
            type="email"
            value={headCoachEmail}
            onChange={(e) => setHeadCoachEmail(e.target.value)}
            placeholder="Assign by account email (optional)"
          />
          <p className="text-xs text-[#6B7280]">Leave blank to keep current coach. Enter email to assign.</p>
        </div>
      </div>

      <Button type="submit" disabled={submitting}>
        {submitting ? "Saving…" : "Save changes"}
      </Button>
    </form>
  )
}

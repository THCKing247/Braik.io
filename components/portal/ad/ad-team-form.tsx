"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SPORT_OPTIONS } from "@/lib/pricing-sports"

type Props = {
  onSuccess?: () => void
}

export function AdTeamForm({ onSuccess }: Props) {
  const router = useRouter()
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [sport, setSport] = useState("")
  const [teamName, setTeamName] = useState("")
  const [rosterSize, setRosterSize] = useState<string>("")
  const [season, setSeason] = useState("")
  const [headCoachFirstName, setHeadCoachFirstName] = useState("")
  const [headCoachLastName, setHeadCoachLastName] = useState("")
  const [headCoachEmail, setHeadCoachEmail] = useState("")
  const [notes, setNotes] = useState("")

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
      const res = await fetch("/api/ad/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sport: sportVal,
          teamName: name,
          rosterSize: rosterSize ? Math.max(0, parseInt(rosterSize, 10)) : undefined,
          season: season.trim() || undefined,
          headCoachFirstName: headCoachFirstName.trim() || undefined,
          headCoachLastName: headCoachLastName.trim() || undefined,
          headCoachEmail: headCoachEmail.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? "Failed to create team.")
        return
      }
      if (onSuccess) onSuccess()
      else router.replace("/dashboard/ad/teams")
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
          <Label htmlFor="teamName">Team name *</Label>
          <Input
            id="teamName"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="e.g. Varsity Football"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sport">Sport *</Label>
          <select
            id="sport"
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
          <Label htmlFor="rosterSize">Roster size</Label>
          <Input
            id="rosterSize"
            type="number"
            min={0}
            max={500}
            value={rosterSize}
            onChange={(e) => setRosterSize(e.target.value)}
            placeholder="e.g. 40"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="season">Season / year</Label>
          <Input
            id="season"
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            placeholder="e.g. 2024-25"
          />
        </div>
      </div>

      <div className="border-t border-border pt-6">
        <h3 className="text-sm font-semibold text-foreground mb-3">Invite head coach (optional)</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Send an invitation to a head coach. They can accept and join this team.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="headCoachFirstName">First name</Label>
            <Input
              id="headCoachFirstName"
              value={headCoachFirstName}
              onChange={(e) => setHeadCoachFirstName(e.target.value)}
              placeholder="Coach first name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="headCoachLastName">Last name</Label>
            <Input
              id="headCoachLastName"
              value={headCoachLastName}
              onChange={(e) => setHeadCoachLastName(e.target.value)}
              placeholder="Coach last name"
            />
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <Label htmlFor="headCoachEmail">Email</Label>
          <Input
            id="headCoachEmail"
            type="email"
            value={headCoachEmail}
            onChange={(e) => setHeadCoachEmail(e.target.value)}
            placeholder="coach@school.edu"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Internal notes (optional)"
          rows={3}
          className="flex w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
        />
      </div>

      <div className="flex flex-wrap gap-3 pt-4">
        <Button
          type="submit"
          disabled={submitting}
          className="bg-[#3B82F6] hover:bg-[#2563EB] text-white"
        >
          {submitting ? "Creating…" : "Create team"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={submitting}
          onClick={() => router.push("/dashboard/ad/teams")}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}

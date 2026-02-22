"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function OnboardingWizard() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const [orgName, setOrgName] = useState("")
  const [orgType, setOrgType] = useState("school")
  const [schoolName, setSchoolName] = useState("")
  const [city, setCity] = useState("")
  const [teamName, setTeamName] = useState("")
  const [sport, setSport] = useState("football")
  const [primaryColor, setPrimaryColor] = useState("#1e3a5f")
  const [secondaryColor, setSecondaryColor] = useState("#FFFFFF")
  const [seasonName, setSeasonName] = useState("")
  const [seasonStart, setSeasonStart] = useState("")
  const [seasonEnd, setSeasonEnd] = useState("")
  const [rosterCap, setRosterCap] = useState("50")
  const [duesAmount, setDuesAmount] = useState("5.00")
  const [duesDueDate, setDuesDueDate] = useState("")

  const handleStep1 = async () => {
    if (!teamName || !city) {
      setError("Please fill in all required fields (Team Name and City)")
      return
    }
    setStep(2)
  }

  const handleStep2 = async () => {
    if (!seasonName || !seasonStart || !seasonEnd) {
      setError("Please fill in all required fields")
      return
    }
    setStep(3)
  }

  const handleSubmit = async () => {
    if (!duesDueDate) {
      setError("Please set a dues due date")
      return
    }

    setLoading(true)
    setError("")

    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgName: schoolName || city, // Use school name or city as org name
          orgType,
          city,
          schoolName: schoolName || null,
          teamName,
          sport,
          primaryColor,
          secondaryColor,
          seasonName,
          seasonStart,
          seasonEnd,
          rosterCap: parseInt(rosterCap),
          duesAmount: parseFloat(duesAmount),
          duesDueDate,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "An error occurred")
        return
      }

      router.push("/dashboard")
      router.refresh()
    } catch (err) {
      setError("An error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step {step} of 3</CardTitle>
        <CardDescription>
          {step === 1 && "Create your organization and team"}
          {step === 2 && "Set up season details"}
          {step === 3 && "Configure dues and billing"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="schoolName">School Name (Optional)</Label>
              <Input
                id="schoolName"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="e.g., Lincoln High School"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City *</Label>
              <Input
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g., Lincoln, NE"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teamName">Team Name *</Label>
              <Input
                id="teamName"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="e.g., Varsity Football"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sport">Sport *</Label>
              <select
                id="sport"
                value={sport}
                onChange={(e) => setSport(e.target.value)}
                className="flex h-10 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
                required
              >
                <option value="football">Football</option>
                <option value="basketball">Basketball</option>
                <option value="soccer">Soccer</option>
                <option value="baseball">Baseball</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="primaryColor">Primary Color</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="primaryColor"
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-16 h-10"
                  />
                  <Input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    placeholder="#1e3a5f"
                    className="flex-1"
                  />
                </div>
                <p className="text-xs text-muted">Main team color (default: blue)</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="secondaryColor">Secondary Color</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="secondaryColor"
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="w-16 h-10"
                  />
                  <Input
                    type="text"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    placeholder="#FFFFFF"
                    className="flex-1"
                  />
                </div>
                <p className="text-xs text-muted">Accent/outline color (default: white)</p>
              </div>
            </div>
            {error && <div className="text-sm text-danger">{error}</div>}
            <Button onClick={handleStep1} className="w-full">Next</Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="seasonName">Season Name *</Label>
              <Input
                id="seasonName"
                value={seasonName}
                onChange={(e) => setSeasonName(e.target.value)}
                placeholder="e.g., Fall 2024"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="seasonStart">Season Start *</Label>
                <Input
                  id="seasonStart"
                  type="date"
                  value={seasonStart}
                  onChange={(e) => setSeasonStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seasonEnd">Season End *</Label>
                <Input
                  id="seasonEnd"
                  type="date"
                  value={seasonEnd}
                  onChange={(e) => setSeasonEnd(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rosterCap">Roster Cap</Label>
              <Input
                id="rosterCap"
                type="number"
                value={rosterCap}
                onChange={(e) => setRosterCap(e.target.value)}
                min="1"
              />
            </div>
            {error && <div className="text-sm text-danger">{error}</div>}
            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                Back
              </Button>
              <Button onClick={handleStep2} className="flex-1">Next</Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="duesAmount">Dues Amount per Player ($) *</Label>
              <Input
                id="duesAmount"
                type="number"
                step="0.01"
                value={duesAmount}
                onChange={(e) => setDuesAmount(e.target.value)}
                min="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="duesDueDate">Dues Due Date *</Label>
              <Input
                id="duesDueDate"
                type="date"
                value={duesDueDate}
                onChange={(e) => setDuesDueDate(e.target.value)}
              />
            </div>
            {error && <div className="text-sm text-danger">{error}</div>}
            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                Back
              </Button>
              <Button onClick={handleSubmit} disabled={loading} className="flex-1">
                {loading ? "Creating..." : "Create Team"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}


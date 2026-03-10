"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"

interface RosterTemplateSettingsProps {
  teamId: string
}

interface RosterTemplate {
  header: {
    showYear: boolean
    showSchoolName: boolean
    showTeamName: boolean
    yearLabel: string
    schoolNameLabel: string
    teamNameLabel: string
  }
  body: {
    showJerseyNumber: boolean
    showPlayerName: boolean
    showGrade: boolean
    showPosition: boolean
    showWeight: boolean
    showHeight: boolean
    jerseyNumberLabel: string
    playerNameLabel: string
    gradeLabel: string
    positionLabel: string
    weightLabel: string
    heightLabel: string
    sortBy: "jerseyNumber" | "name"
  }
  footer: {
    showGeneratedDate: boolean
    customText: string
  }
}

const defaultTemplate: RosterTemplate = {
  header: {
    showYear: true,
    showSchoolName: true,
    showTeamName: true,
    yearLabel: "Year",
    schoolNameLabel: "School",
    teamNameLabel: "Team",
  },
  body: {
    showJerseyNumber: true,
    showPlayerName: true,
    showGrade: true,
    showPosition: true,
    showWeight: true,
    showHeight: true,
    jerseyNumberLabel: "Number",
    playerNameLabel: "Name",
    gradeLabel: "Grade",
    positionLabel: "Position",
    weightLabel: "Weight",
    heightLabel: "Height",
    sortBy: "jerseyNumber",
  },
  footer: {
    showGeneratedDate: true,
    customText: "",
  },
}

export function RosterTemplateSettings({ teamId }: RosterTemplateSettingsProps) {
  const [template, setTemplate] = useState<RosterTemplate>(defaultTemplate)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const loadTemplate = async () => {
      try {
        const response = await fetch(`/api/teams/${teamId}/roster-template`)
        if (response.ok) {
          const data = await response.json()
          if (data.template) {
            setTemplate({ ...defaultTemplate, ...data.template })
          }
        }
      } catch (error) {
        console.error("Failed to load template:", error)
      } finally {
        setLoading(false)
      }
    }
    loadTemplate()
  }, [teamId])

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await fetch(`/api/teams/${teamId}/roster-template`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template }),
      })

      if (response.ok) {
        alert("Roster template saved successfully!")
      } else {
        const error = await response.json()
        alert(error.error || "Failed to save template")
      }
    } catch (error) {
      console.error("Failed to save template:", error)
      alert("Failed to save template")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="text-white">Loading template...</div>
  }

  return (
    <div className="space-y-6">
      <Card className="bg-[#1e3a5f] border-[#1e3a5f]">
        <CardHeader>
          <CardTitle className="text-white">Roster Print/Email Template</CardTitle>
          <CardDescription className="text-white/70">
            Customize how your roster appears when printed or emailed. Changes apply to both print and email formats.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Header Settings */}
          <div className="space-y-4">
            <h3 className="text-white font-semibold">Header Information</h3>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="showYear"
                checked={template.header.showYear}
                onCheckedChange={(checked) =>
                  setTemplate({
                    ...template,
                    header: { ...template.header, showYear: checked === true },
                  })
                }
              />
              <Label htmlFor="showYear" className="text-white">Show Year</Label>
            </div>
            {template.header.showYear && (
              <div className="ml-6 space-y-2">
                <Label htmlFor="yearLabel" className="text-white/70">Year Label</Label>
                <Input
                  id="yearLabel"
                  value={template.header.yearLabel}
                  onChange={(e) =>
                    setTemplate({
                      ...template,
                      header: { ...template.header, yearLabel: e.target.value },
                    })
                  }
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Checkbox
                id="showSchoolName"
                checked={template.header.showSchoolName}
                onCheckedChange={(checked) =>
                  setTemplate({
                    ...template,
                    header: { ...template.header, showSchoolName: checked === true },
                  })
                }
              />
              <Label htmlFor="showSchoolName" className="text-white">Show School Name</Label>
            </div>
            {template.header.showSchoolName && (
              <div className="ml-6 space-y-2">
                <Label htmlFor="schoolNameLabel" className="text-white/70">School Name Label</Label>
                <Input
                  id="schoolNameLabel"
                  value={template.header.schoolNameLabel}
                  onChange={(e) =>
                    setTemplate({
                      ...template,
                      header: { ...template.header, schoolNameLabel: e.target.value },
                    })
                  }
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Checkbox
                id="showTeamName"
                checked={template.header.showTeamName}
                onCheckedChange={(checked) =>
                  setTemplate({
                    ...template,
                    header: { ...template.header, showTeamName: checked === true },
                  })
                }
              />
              <Label htmlFor="showTeamName" className="text-white">Show Team Name</Label>
            </div>
            {template.header.showTeamName && (
              <div className="ml-6 space-y-2">
                <Label htmlFor="teamNameLabel" className="text-white/70">Team Name Label</Label>
                <Input
                  id="teamNameLabel"
                  value={template.header.teamNameLabel}
                  onChange={(e) =>
                    setTemplate({
                      ...template,
                      header: { ...template.header, teamNameLabel: e.target.value },
                    })
                  }
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>
            )}
          </div>

          {/* Body Settings */}
          <div className="space-y-4">
            <h3 className="text-white font-semibold">Roster Columns</h3>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="showJerseyNumber"
                checked={template.body.showJerseyNumber}
                onCheckedChange={(checked) =>
                  setTemplate({
                    ...template,
                    body: { ...template.body, showJerseyNumber: checked === true },
                  })
                }
              />
              <Label htmlFor="showJerseyNumber" className="text-white">Show Jersey Number</Label>
            </div>
            {template.body.showJerseyNumber && (
              <div className="ml-6 space-y-2">
                <Label htmlFor="jerseyNumberLabel" className="text-white/70">Jersey Number Label</Label>
                <Input
                  id="jerseyNumberLabel"
                  value={template.body.jerseyNumberLabel}
                  onChange={(e) =>
                    setTemplate({
                      ...template,
                      body: { ...template.body, jerseyNumberLabel: e.target.value },
                    })
                  }
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Checkbox
                id="showPlayerName"
                checked={template.body.showPlayerName}
                onCheckedChange={(checked) =>
                  setTemplate({
                    ...template,
                    body: { ...template.body, showPlayerName: checked === true },
                  })
                }
              />
              <Label htmlFor="showPlayerName" className="text-white">Show Player Name</Label>
            </div>
            {template.body.showPlayerName && (
              <div className="ml-6 space-y-2">
                <Label htmlFor="playerNameLabel" className="text-white/70">Player Name Label</Label>
                <Input
                  id="playerNameLabel"
                  value={template.body.playerNameLabel}
                  onChange={(e) =>
                    setTemplate({
                      ...template,
                      body: { ...template.body, playerNameLabel: e.target.value },
                    })
                  }
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Checkbox
                id="showGrade"
                checked={template.body.showGrade}
                onCheckedChange={(checked) =>
                  setTemplate({
                    ...template,
                    body: { ...template.body, showGrade: checked === true },
                  })
                }
              />
              <Label htmlFor="showGrade" className="text-white">Show Grade</Label>
            </div>
            {template.body.showGrade && (
              <div className="ml-6 space-y-2">
                <Label htmlFor="gradeLabel" className="text-white/70">Grade Label</Label>
                <Input
                  id="gradeLabel"
                  value={template.body.gradeLabel}
                  onChange={(e) =>
                    setTemplate({
                      ...template,
                      body: { ...template.body, gradeLabel: e.target.value },
                    })
                  }
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Checkbox
                id="showPosition"
                checked={template.body.showPosition !== false}
                onCheckedChange={(checked) =>
                  setTemplate({
                    ...template,
                    body: { ...template.body, showPosition: checked === true },
                  })
                }
              />
              <Label htmlFor="showPosition" className="text-white">Show Position</Label>
            </div>
            {template.body.showPosition !== false && (
              <div className="ml-6 space-y-2">
                <Label htmlFor="positionLabel" className="text-white/70">Position Label</Label>
                <Input
                  id="positionLabel"
                  value={template.body.positionLabel ?? "Position"}
                  onChange={(e) =>
                    setTemplate({
                      ...template,
                      body: { ...template.body, positionLabel: e.target.value },
                    })
                  }
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Checkbox
                id="showWeight"
                checked={template.body.showWeight !== false}
                onCheckedChange={(checked) =>
                  setTemplate({
                    ...template,
                    body: { ...template.body, showWeight: checked === true },
                  })
                }
              />
              <Label htmlFor="showWeight" className="text-white">Show Weight</Label>
            </div>
            {template.body.showWeight !== false && (
              <div className="ml-6 space-y-2">
                <Label htmlFor="weightLabel" className="text-white/70">Weight Label</Label>
                <Input
                  id="weightLabel"
                  value={template.body.weightLabel ?? "Weight"}
                  onChange={(e) =>
                    setTemplate({
                      ...template,
                      body: { ...template.body, weightLabel: e.target.value },
                    })
                  }
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Checkbox
                id="showHeight"
                checked={template.body.showHeight !== false}
                onCheckedChange={(checked) =>
                  setTemplate({
                    ...template,
                    body: { ...template.body, showHeight: checked === true },
                  })
                }
              />
              <Label htmlFor="showHeight" className="text-white">Show Height</Label>
            </div>
            {template.body.showHeight !== false && (
              <div className="ml-6 space-y-2">
                <Label htmlFor="heightLabel" className="text-white/70">Height Label</Label>
                <Input
                  id="heightLabel"
                  value={template.body.heightLabel ?? "Height"}
                  onChange={(e) =>
                    setTemplate({
                      ...template,
                      body: { ...template.body, heightLabel: e.target.value },
                    })
                  }
                  className="bg-white/10 border-white/20 text-white"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="sortBy" className="text-white">Sort Players By</Label>
              <select
                id="sortBy"
                value={template.body.sortBy}
                onChange={(e) =>
                  setTemplate({
                    ...template,
                    body: { ...template.body, sortBy: e.target.value as "jerseyNumber" | "name" },
                  })
                }
                className="w-full bg-white/10 border border-white/20 text-white rounded-md px-3 py-2"
              >
                <option value="jerseyNumber">Jersey Number</option>
                <option value="name">Name</option>
              </select>
            </div>
          </div>

          {/* Footer Settings */}
          <div className="space-y-4">
            <h3 className="text-white font-semibold">Footer Information</h3>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="showGeneratedDate"
                checked={template.footer.showGeneratedDate}
                onCheckedChange={(checked) =>
                  setTemplate({
                    ...template,
                    footer: { ...template.footer, showGeneratedDate: checked === true },
                  })
                }
              />
              <Label htmlFor="showGeneratedDate" className="text-white">Show Generated Date</Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customText" className="text-white">Custom Footer Text (Optional)</Label>
              <Input
                id="customText"
                value={template.footer.customText}
                onChange={(e) =>
                  setTemplate({
                    ...template,
                    footer: { ...template.footer, customText: e.target.value },
                  })
                }
                placeholder="e.g., Go Team!"
                className="bg-white/10 border-white/20 text-white"
              />
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-4">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Template"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

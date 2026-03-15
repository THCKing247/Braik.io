"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { usePlaybookToast } from "@/components/portal/playbook-toast"
import { Building2, Loader2 } from "lucide-react"

interface ProgramInfo {
  id: string
  program_name: string
  organization_id: string | null
}

interface CurrentProgramResponse {
  program: ProgramInfo | null
  canLinkToOrganization: boolean
  reason: string | null
}

export function LinkToOrganizationSettings() {
  const [loading, setLoading] = useState(true)
  const [programInfo, setProgramInfo] = useState<CurrentProgramResponse | null>(null)
  const [code, setCode] = useState("")
  const [linking, setLinking] = useState(false)
  const { showToast } = usePlaybookToast()

  useEffect(() => {
    let cancelled = false
    async function fetchCurrent() {
      try {
        const res = await fetch("/api/programs/current")
        const data = (await res.json()) as CurrentProgramResponse
        if (!cancelled) setProgramInfo(data)
      } catch {
        if (!cancelled) setProgramInfo(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchCurrent()
    return () => {
      cancelled = true
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) {
      showToast("Please enter the link code from your Athletic Director.", "error")
      return
    }
    setLinking(true)
    try {
      const res = await fetch("/api/programs/link-to-organization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(data.error ?? "Failed to link program.", "error")
        return
      }
      showToast("Your program is now linked to the Athletic Director organization.", "success")
      setCode("")
      setProgramInfo((prev) =>
        prev && prev.program
          ? {
              ...prev,
              canLinkToOrganization: false,
              reason: "already_linked",
              program: { ...prev.program, organization_id: data.organizationId ?? "" },
            }
          : prev
      )
    } finally {
      setLinking(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading program…</span>
      </div>
    )
  }

  if (!programInfo?.program) {
    return (
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Link to Athletic Director</h3>
        <p className="text-sm text-muted-foreground">
          Your account is not associated with a program, or you don’t have a team. Link a team first to see this option.
        </p>
      </div>
    )
  }

  if (!programInfo.canLinkToOrganization) {
    if (programInfo.reason === "already_linked") {
      return (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Link to Athletic Director
          </h3>
          <p className="text-sm text-muted-foreground">
            This program is already linked to an Athletic Director organization. You have full access to your program; the Athletic Director has organization-level visibility and control.
          </p>
        </div>
      )
    }
    if (programInfo.reason === "not_head_coach") {
      return (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Link to Athletic Director</h3>
          <p className="text-sm text-muted-foreground">
            Only the head coach (program owner) can link this program to an Athletic Director.
          </p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <Building2 className="h-5 w-5" />
        Join Athletic Department
      </h3>
      <p className="text-sm text-muted-foreground">
        If your school uses Braik’s Athletic Director plan, you can link this program to the athletic department. You remain the head coach; the AD gets organization-level visibility. Enter the link code provided by your Athletic Director.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[200px] space-y-2">
          <Label htmlFor="ad-link-code">Link code</Label>
          <Input
            id="ad-link-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. ABC12XYZ"
            maxLength={20}
            className="font-mono"
          />
        </div>
        <Button type="submit" disabled={linking || !code.trim()}>
          {linking ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Linking…
            </>
          ) : (
            "Link program"
          )}
        </Button>
      </form>
    </div>
  )
}

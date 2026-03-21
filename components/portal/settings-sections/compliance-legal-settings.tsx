"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface ComplianceLogItem {
  id: string
  eventType: string
  policyVersion: string
  timestamp: string
  ipAddress: string | null
  user: {
    name: string | null
    email: string
  }
}

interface ComplianceLegalSettingsProps {
  teamId: string
  userRole: string
}

export function ComplianceLegalSettings({ teamId, userRole }: ComplianceLegalSettingsProps) {
  const [logs, setLogs] = useState<ComplianceLogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/compliance/logs?teamId=${encodeURIComponent(teamId)}`)
        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}))
          throw new Error((errBody as { error?: string }).error || "Failed to load compliance logs")
        }
        const data = await response.json()
        setLogs(data.logs || [])
      } catch (err: any) {
        setError(err?.message || "Failed to load compliance logs")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [teamId])

  return (
    <div className="space-y-6">
      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Compliance & Legal</CardTitle>
          <CardDescription className="text-muted-foreground">
            Review legal policies and monitor team compliance events.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <Link href="/terms" target="_blank">
              <Button variant="outline" className="border-border text-foreground">View Terms of Service</Button>
            </Link>
            <Link href="/privacy" target="_blank">
              <Button variant="outline" className="border-border text-foreground">View Privacy Policy</Button>
            </Link>
            <Link href="/acceptable-use" target="_blank">
              <Button variant="outline" className="border-border text-foreground">View Acceptable Use Policy</Button>
            </Link>
            <Link href="/ai-transparency" target="_blank">
              <Button variant="outline" className="border-border text-foreground">View AI Transparency</Button>
            </Link>
            <a href="/api/compliance/parental-consent-form" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="border-border text-foreground">Download Parental Consent Form (PDF)</Button>
            </a>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Consent Logs</CardTitle>
          <CardDescription className="text-muted-foreground">
            {userRole === "HEAD_COACH"
              ? "Head Coach can review and export logs."
              : "Assistant coaches can review logs only."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {userRole === "HEAD_COACH" && (
            <a href={`/api/compliance/logs?teamId=${encodeURIComponent(teamId)}&format=csv`}>
              <Button variant="outline" className="border-border text-foreground">Export Logs (CSV)</Button>
            </a>
          )}

          {loading ? (
            <p className="text-muted-foreground text-sm">Loading compliance logs...</p>
          ) : error ? (
            <p className="text-destructive text-sm">{error}</p>
          ) : logs.length === 0 ? (
            <p className="text-muted-foreground text-sm">No compliance logs recorded yet.</p>
          ) : (
            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {logs.map((log) => (
                <div key={log.id} className="rounded border border-border bg-muted/30 p-3 text-sm text-foreground">
                  <p className="font-medium">
                    {log.eventType} - {log.policyVersion}
                  </p>
                  <p className="text-muted-foreground">
                    {new Date(log.timestamp).toLocaleString()} - {log.user.name || log.user.email}
                  </p>
                  {log.ipAddress && <p className="text-muted-foreground">IP: {log.ipAddress}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

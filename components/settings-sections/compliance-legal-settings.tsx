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
        const response = await fetch("/api/compliance/logs")
        if (!response.ok) {
          throw new Error("Failed to load compliance logs")
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
      <Card className="bg-[#1e3a5f] border-[#1e3a5f]">
        <CardHeader>
          <CardTitle className="text-white">Compliance & Legal</CardTitle>
          <CardDescription className="text-white/70">
            Review legal policies and monitor team compliance events.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <Link href="/terms" target="_blank">
              <Button variant="outline">View Terms of Service</Button>
            </Link>
            <Link href="/privacy" target="_blank">
              <Button variant="outline">View Privacy Policy</Button>
            </Link>
            <Link href="/acceptable-use" target="_blank">
              <Button variant="outline">View Acceptable Use Policy</Button>
            </Link>
            <Link href="/ai-transparency" target="_blank">
              <Button variant="outline">View AI Transparency</Button>
            </Link>
            <a href="/api/compliance/parental-consent-form" target="_blank" rel="noopener noreferrer">
              <Button variant="outline">Download Parental Consent Form (PDF)</Button>
            </a>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-[#1e3a5f] border-[#1e3a5f]">
        <CardHeader>
          <CardTitle className="text-white">Consent Logs</CardTitle>
          <CardDescription className="text-white/70">
            {userRole === "HEAD_COACH"
              ? "Head Coach can review and export logs."
              : "Assistant coaches can review logs only."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {userRole === "HEAD_COACH" && (
            <a href="/api/compliance/logs?format=csv">
              <Button variant="outline">Export Logs (CSV)</Button>
            </a>
          )}

          {loading ? (
            <p className="text-white/70 text-sm">Loading compliance logs...</p>
          ) : error ? (
            <p className="text-red-300 text-sm">{error}</p>
          ) : logs.length === 0 ? (
            <p className="text-white/70 text-sm">No compliance logs recorded yet.</p>
          ) : (
            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {logs.map((log) => (
                <div key={log.id} className="rounded border border-white/20 bg-white/5 p-3 text-sm text-white">
                  <p className="font-medium">
                    {log.eventType} - {log.policyVersion}
                  </p>
                  <p className="text-white/70">
                    {new Date(log.timestamp).toLocaleString()} - {log.user.name || log.user.email}
                  </p>
                  {log.ipAddress && <p className="text-white/60">IP: {log.ipAddress}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

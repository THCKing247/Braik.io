"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

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

const POLICY_LINKS: { label: string; title: string; href: string }[] = [
  { label: "View Terms of Service", title: "Terms of Service", href: "/terms" },
  { label: "View Privacy Policy", title: "Privacy Policy", href: "/privacy" },
  { label: "View Acceptable Use Policy", title: "Acceptable Use Policy", href: "/acceptable-use" },
  { label: "View AI Transparency", title: "AI Transparency", href: "/ai-transparency" },
]

export function ComplianceLegalSettings({ teamId, userRole }: ComplianceLegalSettingsProps) {
  const [logs, setLogs] = useState<ComplianceLogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTitle, setModalTitle] = useState("")
  const [modalSrc, setModalSrc] = useState<string | null>(null)

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
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load compliance logs")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [teamId])

  const openPolicy = (title: string, href: string) => {
    setModalTitle(title)
    setModalSrc(href)
    setModalOpen(true)
  }

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
            {POLICY_LINKS.map((p) => (
              <Button
                key={p.href}
                type="button"
                variant="outline"
                className="border-border text-foreground"
                onClick={() => openPolicy(p.title, p.href)}
              >
                {p.label}
              </Button>
            ))}
            <Button
              type="button"
              variant="outline"
              className="border-border text-foreground"
              onClick={() =>
                openPolicy("Parental Consent Form (PDF)", "/api/compliance/parental-consent-form")
              }
            >
              Download Parental Consent Form (PDF)
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden flex flex-col gap-0 p-0">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle className="text-foreground">{modalTitle}</DialogTitle>
          </DialogHeader>
          {modalSrc && (
            <div className="min-h-[70vh] w-full flex-1 border-t border-border bg-muted/20">
              <iframe
                title={modalTitle}
                src={modalSrc}
                className="h-[70vh] w-full border-0"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

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
              <Button variant="outline" className="border-border text-foreground">
                Export Logs (CSV)
              </Button>
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

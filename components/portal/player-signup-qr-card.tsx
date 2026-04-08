"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { QrCodeImage, qrCodeToDataUrl } from "@/components/ui/qr-code-image"
import { buildPlayerSignupUrl } from "@/lib/app/public-site-url"
import { usePlaybookToast } from "@/components/portal/playbook-toast"
import { Copy, Check, Download, QrCode } from "lucide-react"
interface CodesResponse {
  teamName?: string | null
  playerCode?: string | null
}

export function PlayerSignupQrCard({ teamId }: { teamId: string }) {
  const { showToast } = usePlaybookToast()
  const [loading, setLoading] = useState(true)
  const [codes, setCodes] = useState<CodesResponse | null>(null)
  const [copied, setCopied] = useState<"code" | "link" | null>(null)
  const [downloadBusy, setDownloadBusy] = useState(false)

  const load = useCallback(async () => {
    if (!teamId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/roster/codes?teamId=${encodeURIComponent(teamId)}`, { credentials: "include" })
      if (res.ok) {
        const data = (await res.json()) as CodesResponse
        setCodes(data)
      } else {
        setCodes(null)
      }
    } catch {
      setCodes(null)
    } finally {
      setLoading(false)
    }
  }, [teamId])

  useEffect(() => {
    void load()
  }, [load])

  const playerCode = codes?.playerCode?.trim() ?? ""
  const signupUrl = playerCode ? buildPlayerSignupUrl(playerCode) : ""

  const copyText = async (text: string, kind: "code" | "link") => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(kind)
      setTimeout(() => setCopied(null), 2000)
      showToast(kind === "code" ? "Join code copied." : "Signup link copied.", "success")
    } catch {
      showToast("Could not copy to clipboard.", "error")
    }
  }

  const downloadPng = async () => {
    if (!signupUrl || !playerCode) return
    setDownloadBusy(true)
    try {
      const dataUrl = await qrCodeToDataUrl(signupUrl, 512)
      const a = document.createElement("a")
      a.href = dataUrl
      a.download = `braik-player-signup-${playerCode}.png`
      a.rel = "noopener"
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      showToast("QR code downloaded.", "success")
    } catch {
      showToast("Download failed. Try again or copy the link instead.", "error")
    } finally {
      setDownloadBusy(false)
    }
  }

  if (loading) {
    return (
      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <QrCode className="h-5 w-5" />
            Player signup
          </CardTitle>
          <CardDescription>Loading…</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="border border-border bg-card overflow-hidden">
      <CardHeader className="space-y-1">
        <CardTitle className="flex items-center gap-2 text-foreground font-athletic uppercase tracking-wide text-base">
          <QrCode className="h-5 w-5 shrink-0 text-primary" />
          Player signup
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Share a QR code or link so players open the Braik signup page with your team join code already filled in. Players
          still complete name matching and account creation—nothing is bypassed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!playerCode ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">No player join code yet</p>
            <p>
              Generate team join codes first (Settings → Subscription, or your team&apos;s code tools). The same{" "}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">player_code</code> is used for this QR and link.
            </p>
            <p className="mt-2 text-xs">
              Regenerating codes will be available from that flow later; for now use your existing code generator.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-3 min-w-0 flex-1">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Team player join code</p>
                  <p className="mt-1 text-2xl font-bold font-mono tracking-wider text-foreground break-all">{playerCode}</p>
                  {codes?.teamName ? (
                    <p className="text-sm text-muted-foreground mt-1">Team: {codes.teamName}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => void copyText(playerCode, "code")}>
                    {copied === "code" ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                    Copy code
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => void copyText(signupUrl, "link")}>
                    {copied === "link" ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                    Copy signup link
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground break-all rounded-md bg-muted/50 px-3 py-2 border border-border">
                  {signupUrl}
                </p>
              </div>
              <div className="flex flex-col items-center gap-3 shrink-0 mx-auto lg:mx-0">
                <div className="rounded-2xl border-2 border-border bg-white p-4 shadow-sm">
                  <QrCodeImage value={signupUrl} size={200} />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={downloadBusy}
                  onClick={() => void downloadPng()}
                  className="w-full max-w-[220px]"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {downloadBusy ? "Preparing…" : "Download QR (PNG)"}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground border-t border-border pt-4">
              Tip: Print or screen-share the QR code on the sideline; players scan with their phone camera and continue on
              Braik. For privacy, only the join code is embedded—never the full roster.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}

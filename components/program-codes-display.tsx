"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Copy, Check } from "lucide-react"

interface ProgramCodesDisplayProps {
  teamId: string
  userRole: string
}

export function ProgramCodesDisplay({ teamId, userRole }: ProgramCodesDisplayProps) {
  const [codes, setCodes] = useState<{ playerCode: string | null; parentCode: string | null } | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<"player" | "parent" | null>(null)

  // Only coaches can see codes
  const canViewCodes = ["HEAD_COACH", "ASSISTANT_COACH"].includes(userRole)

  useEffect(() => {
    if (canViewCodes) {
      loadCodes()
    } else {
      setLoading(false)
    }
  }, [teamId, canViewCodes])

  const loadCodes = async () => {
    try {
      const response = await fetch(`/api/roster/codes?teamId=${teamId}`)
      if (response.ok) {
        const data = await response.json()
        setCodes(data)
      }
    } catch (error) {
      console.error("Failed to load codes:", error)
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async (text: string, type: "player" | "parent") => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(type)
      setTimeout(() => setCopied(null), 2000)
    } catch (error) {
      console.error("Failed to copy:", error)
    }
  }

  if (!canViewCodes) {
    return null
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Loading program codes...</p>
        </CardContent>
      </Card>
    )
  }

  if (!codes) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Program Codes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Team Code</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Share this team code with players to join the program
              </p>
            </div>
            {codes.playerCode && (
              <div className="flex items-center gap-2">
                <code className="px-3 py-1.5 bg-muted rounded-md font-mono text-sm">
                  {codes.playerCode}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(codes.playerCode!, "player")}
                >
                  {copied === "player" ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Team Code</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Share this team code with parents to join the program
              </p>
            </div>
            {codes.parentCode && (
              <div className="flex items-center gap-2">
                <code className="px-3 py-1.5 bg-muted rounded-md font-mono text-sm">
                  {codes.parentCode}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(codes.parentCode!, "parent")}
                >
                  {copied === "parent" ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

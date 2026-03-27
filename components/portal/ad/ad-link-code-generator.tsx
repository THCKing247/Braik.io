"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Copy, Building2 } from "lucide-react"
import { useAdAppBootstrapOptional } from "@/components/portal/ad-app-bootstrap-context"

const DEFAULT_EXPIRES_DAYS = 14
const DEFAULT_MAX_USES = 1

export function AdLinkCodeGenerator() {
  const ad = useAdAppBootstrapOptional()
  const [loading, setLoading] = useState(false)
  const [generatedCode, setGeneratedCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)
    setGeneratedCode(null)
    try {
      const res = await fetch("/api/invite-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inviteType: "athletic_director_link_invite",
          expiresInDays: DEFAULT_EXPIRES_DAYS,
          maxUses: DEFAULT_MAX_USES,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? "Failed to generate link code.")
        return
      }
      setGeneratedCode(data.code ?? null)
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!generatedCode) return
    try {
      await navigator.clipboard.writeText(generatedCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError("Could not copy to clipboard.")
    }
  }

  if (
    ad?.payload &&
    ad.payload.flags.canPerformDepartmentOwnerActions === false
  ) {
    return null
  }

  return (
    <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-[#212529] flex items-center gap-2">
        <Building2 className="h-5 w-5" />
        Link existing head coach program
      </h2>
      <p className="mt-2 text-sm text-[#6B7280]">
        Have a head coach who already has a Braik program? Generate a one-time link code. They enter it in Settings → Athletic Department to attach their program to your organization. Their program, roster, and data stay intact; you get visibility and control at the organization level.
      </p>
      {error && (
        <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className="bg-[#3B82F6] hover:bg-[#2563EB] text-white"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating…
            </>
          ) : (
            "Generate link code"
          )}
        </Button>
        {generatedCode && (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Input
              readOnly
              value={generatedCode}
              className="font-mono max-w-[180px] bg-[#F9FAFB]"
            />
            <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
              {copied ? "Copied" : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        )}
      </div>
      {generatedCode && (
        <p className="mt-3 text-xs text-[#6B7280]">
          Code expires in {DEFAULT_EXPIRES_DAYS} days and can be used once. Share it with the head coach; they enter it under Settings → Athletic Department.
        </p>
      )}
    </div>
  )
}

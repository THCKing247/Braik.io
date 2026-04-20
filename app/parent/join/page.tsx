"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SiteHeader } from "@/components/marketing/site-header"
import { isWaitlistMode } from "@/lib/config/waitlist-mode"
import { getProgramOrCoachAccessHref } from "@/lib/marketing/join-cta"

const STORAGE_KEY = "braik_parent_player_code"

type Step = "code" | "confirm"

/**
 * Parent-only entry: parent link code (from the coach) before first-time account signup.
 * Does not use HC/AD portal shells (marketing/auth layout only).
 */
export default function ParentJoinPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>("code")
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [playerLabel, setPlayerLabel] = useState<string | null>(null)
  const [teamLabel, setTeamLabel] = useState<string | null>(null)

  const handleValidate = async () => {
    setError("")
    const normalized = code.trim().toUpperCase()
    if (!normalized) {
      setError("Enter the parent link code from your coach.")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/parent/validate-player-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: normalized }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        valid?: boolean
        error?: string
        playerDisplayName?: string | null
        teamName?: string | null
      }
      if (!data.valid) {
        setError(data.error ?? "That code is not valid.")
        return
      }
      setPlayerLabel(data.playerDisplayName ?? null)
      setTeamLabel(data.teamName ?? null)
      setStep("confirm")
    } catch {
      setError("Something went wrong. Try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmAndSignup = () => {
    const normalized = code.trim().toUpperCase()
    if (typeof window !== "undefined") {
      sessionStorage.setItem(STORAGE_KEY, normalized)
      const existing = localStorage.getItem("signupData")
      const signupData = existing ? JSON.parse(existing) : {}
      signupData.role = "parent"
      signupData.teamId = normalized
      localStorage.setItem("signupData", JSON.stringify(signupData))
    }
    router.push("/signup")
  }

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <section className="relative min-h-screen flex items-center justify-center px-4 py-24 md:py-32">
        <div className="container mx-auto">
          <div className="w-full max-w-md mx-auto p-10 rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
            <h1 className="text-2xl font-athletic font-bold text-center text-[#212529] uppercase tracking-tight">
              Parent Access
            </h1>
            <p className="mt-2 text-center text-sm text-[#495057]">
              Enter the parent link code your coach gave you after your athlete finishes player signup. You&apos;ll confirm the
              athlete, then create your own parent account.
            </p>
            <div className="mt-8 space-y-4">
              {step === "code" ? (
                <>
                  <div className="space-y-2 text-left">
                    <Label htmlFor="player-code" className="text-sm font-medium text-[#495057]">
                      Parent link code
                    </Label>
                    <Input
                      id="player-code"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      className="font-mono text-lg tracking-wider"
                      placeholder="e.g. ABC12XYZ"
                      maxLength={20}
                      autoComplete="off"
                    />
                  </div>
                  {error ? (
                    <div className="text-sm text-white bg-[#EF4444] border border-[#EF4444] rounded-lg p-3 font-medium" role="alert">
                      {error}
                    </div>
                  ) : null}
                  <Button
                    type="button"
                    className="w-full font-athletic uppercase tracking-wide"
                    size="lg"
                    disabled={loading}
                    onClick={() => void handleValidate()}
                  >
                    {loading ? "Checking…" : "Continue"}
                  </Button>
                </>
              ) : (
                <>
                  <div className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-4 text-center space-y-2" role="status">
                    <p className="text-sm font-semibold text-[#1E40AF]">Confirm your athlete</p>
                    <p className="text-lg font-medium text-[#172554]">{playerLabel ?? "Linked athlete"}</p>
                    {teamLabel ? <p className="text-sm text-[#1E3A8A]/90">Team: {teamLabel}</p> : null}
                  </div>
                  <p className="text-center text-sm text-[#6B7280]">
                    This parent account will be linked only to this athlete. You are not signing in as the player.
                  </p>
                  <div className="flex gap-3">
                    <Button type="button" variant="outline" className="flex-1" size="lg" onClick={() => setStep("code")}>
                      Back
                    </Button>
                    <Button type="button" className="flex-1 font-athletic uppercase tracking-wide" size="lg" onClick={handleConfirmAndSignup}>
                      Continue to sign up
                    </Button>
                  </div>
                </>
              )}
              <p className="text-center text-sm text-[#6B7280]">
                Already have an account?{" "}
                <Link href="/login" className="font-medium text-[#3B82F6] hover:underline">
                  Sign in
                </Link>
              </p>
              <p className="text-center text-xs text-[#9CA3AF]">
                Coaches and staff:{" "}
                {isWaitlistMode() ? (
                  <>
                    <Link href={getProgramOrCoachAccessHref()} className="text-[#6B7280] hover:text-[#3B82F6] hover:underline">
                      join the waitlist
                    </Link>{" "}
                    for program access.
                  </>
                ) : (
                  <>
                    <Link href={getProgramOrCoachAccessHref()} className="text-[#6B7280] hover:text-[#3B82F6] hover:underline">
                      request coach or school access
                    </Link>
                    .
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

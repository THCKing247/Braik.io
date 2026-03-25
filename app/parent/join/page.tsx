"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SiteHeader } from "@/components/marketing/site-header"

const STORAGE_KEY = "braik_parent_player_code"

/**
 * Parent-only entry: collect the child's personal player code before account signup.
 * Does not use HC/AD portal shells (marketing/auth layout only).
 */
export default function ParentJoinPage() {
  const router = useRouter()
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleContinue = async () => {
    setError("")
    const normalized = code.trim().toUpperCase()
    if (!normalized) {
      setError("Enter your child's player code.")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/parent/validate-player-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: normalized }),
      })
      const data = (await res.json().catch(() => ({}))) as { valid?: boolean; error?: string }
      if (!data.valid) {
        setError(data.error ?? "Invalid player code.")
        return
      }
      if (typeof window !== "undefined") {
        sessionStorage.setItem(STORAGE_KEY, normalized)
        const existing = localStorage.getItem("signupData")
        const signupData = existing ? JSON.parse(existing) : {}
        signupData.role = "parent"
        signupData.teamId = normalized
        localStorage.setItem("signupData", JSON.stringify(signupData))
      }
      router.push("/signup")
    } catch {
      setError("Something went wrong. Try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <section className="relative min-h-screen flex items-center justify-center px-4 py-24 md:py-32">
        <div className="container mx-auto">
          <div className="w-full max-w-md mx-auto p-10 rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
            <h1 className="text-2xl font-athletic font-bold text-center text-[#212529] uppercase tracking-tight">
              Parent sign up
            </h1>
            <p className="mt-2 text-center text-sm text-[#495057]">
              Enter your child&apos;s personal player code from their coach. You&apos;ll create your parent account on the next steps.
            </p>
            <div className="mt-8 space-y-4">
              <div className="space-y-2 text-left">
                <Label htmlFor="player-code" className="text-sm font-medium text-[#495057]">
                  Player code
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
              <Button type="button" className="w-full font-athletic uppercase tracking-wide" size="lg" disabled={loading} onClick={() => void handleContinue()}>
                {loading ? "Checking…" : "Continue"}
              </Button>
              <p className="text-center text-sm text-[#6B7280]">
                Already have an account?{" "}
                <Link href="/login" className="font-medium text-[#3B82F6] hover:underline">
                  Sign in
                </Link>
              </p>
              <p className="text-center text-xs text-[#9CA3AF]">
                Coaches and staff: use the main{" "}
                <Link href="/signup/role" className="text-[#6B7280] hover:text-[#3B82F6] hover:underline">
                  sign up
                </Link>{" "}
                flow.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

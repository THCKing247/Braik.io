"use client"

import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { SiteHeader } from "@/components/marketing/site-header"
import { CheckCircle, Copy, Check } from "lucide-react"
import {
  applyServerAuthSessionPayload,
  signIn,
  type SessionResponse,
} from "@/lib/auth/client-auth"
import { resolveClientPostAuthDestination } from "@/lib/auth/resolve-client-post-auth-destination"

type SignupApiError = {
  error?: string
  code?: string
  details?: string
  /** Returned by /api/auth/signup-secure for head_coach role */
  inviteCode?: string
  consentVerificationRequired?: boolean
  message?: string
}

export default function PaymentPage() {
  const router = useRouter()
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [signupData, setSignupData] = useState<Record<string, unknown> | null>(null)
  const [teamCode, setTeamCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [redirecting, setRedirecting] = useState(false)

  const getApiErrorMessage = (status: number, data?: SignupApiError) => {
    const code = data?.code || `HTTP-${status}`
    const base = data?.error || "Signup request failed."
    const details = data?.details ? ` Details: ${data.details}` : ""
    return `[SIGNUP-API-${code}] ${base}${details}`
  }

  useEffect(() => {
    const saved = localStorage.getItem("signupData")
    if (!saved) {
      router.push("/signup")
      return
    }
    setSignupData(JSON.parse(saved))
  }, [router])

  const handleCopyCode = () => {
    if (!teamCode) return
    navigator.clipboard.writeText(teamCode).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  const handleGoToDashboard = () => {
    localStorage.removeItem("signupData")
    router.push("/dashboard")
    router.refresh()
  }

  const handleComplete = async () => {
    if (!signupData) {
      setError("[SIGNUP-FLOW-001] Missing signup data in local storage. Please restart signup from Step 1.")
      return
    }

    setError("")
    setLoading(true)

    try {
      const response = await fetch("/api/auth/signup-secure", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name: `${signupData.firstName} ${signupData.lastName}`,
          email: signupData.email, 
          password: signupData.password,
          role: signupData.role,
          sportType: signupData.sportType,
          programType: signupData.programType,
          schoolName: signupData.programType !== "youth" ? signupData.schoolName : null,
          city: signupData.programType === "youth" ? signupData.city : null,
          teamName: signupData.teamName,
          primaryColor: signupData.primaryColor,
          secondaryColor: signupData.secondaryColor,
          compliance: signupData.compliance,
          phone: signupData.phone,
          smsOptIn: Boolean(signupData.smsOptIn),
        }),
      })

      const data = (await response.json()) as SignupApiError & {
        redirectTo?: string
        supabaseSession?: { access_token: string; refresh_token: string; expires_at?: number }
        user?: SessionResponse["user"]
        sessionEstablishFailed?: boolean
      }

      if (!response.ok) {
        setError(getApiErrorMessage(response.status, data))
        setLoading(false)
        return
      }

      if (data.consentVerificationRequired) {
        localStorage.removeItem("signupData")
        setError(`[SIGNUP-CONSENT-202] ${data.message || "Parental consent verification is required before account activation."}`)
        setLoading(false)
        return
      }

      if (data.supabaseSession && data.user) {
        await applyServerAuthSessionPayload({
          user: data.user,
          supabaseSession: data.supabaseSession,
        })
      } else {
        const result = await signIn("credentials", {
          email: String(signupData.email || ""),
          password: String(signupData.password || ""),
          redirect: false,
        })

        if (result?.error) {
          setError(`[SIGNUP-AUTH-${result.error}] Account was created, but auto-login failed. Please sign in manually on the login page.`)
          setLoading(false)
          return
        }
      }

      setLoading(false)

      // If Head Coach, show team code inline before redirecting
      if (signupData.role === "head-coach" && "inviteCode" in data && typeof data.inviteCode === "string") {
        setTeamCode(data.inviteCode)
      } else {
        setRedirecting(true)
        localStorage.removeItem("signupData")
        const role =
          typeof signupData.role === "string" ? signupData.role.replace(/-/g, "_") : null
        const dest = await resolveClientPostAuthDestination(data, { profileRole: role })
        router.push(dest)
        router.refresh()
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown client exception"
      setError(`[SIGNUP-CLIENT-500] Signup could not complete due to a client/runtime exception. Details: ${message}`)
      setLoading(false)
    }
  }

  const handleBack = () => {
    router.push("/signup/program")
  }

  // ── Team Code success screen ─────────────────────────────────────────
  if (teamCode) {
    return (
      <div className="min-h-screen bg-white">
        <SiteHeader />
        <section className="relative min-h-screen flex items-center justify-center px-4 py-24 md:py-32">
          <div className="container mx-auto">
            <div className="w-full max-w-2xl mx-auto p-10 rounded-2xl border border-[#E5E7EB] bg-white shadow-sm text-center space-y-8">
              {/* Success icon */}
              <div className="flex justify-center">
                <CheckCircle className="w-16 h-16 text-[#22C55E]" strokeWidth={1.5} />
              </div>

              <div className="space-y-2">
                <h2 className="text-3xl md:text-4xl font-athletic font-bold text-[#212529] uppercase tracking-tight">
                  Account Created!
                </h2>
                <p className="text-[#495057] text-lg">
                  Your program is set up and ready to go.
                </p>
              </div>

              {/* Team Code card */}
              <div className="rounded-xl border-2 border-[#3B82F6] bg-[#EFF6FF] p-6 space-y-3">
                <p className="text-sm font-semibold text-[#1E3A8A] uppercase tracking-widest">
                  Your Team Code
                </p>
                <p className="text-4xl font-mono font-bold tracking-[0.25em] text-[#1D4ED8]">
                  {teamCode}
                </p>
                <p className="text-sm text-[#3B82F6]">
                  Share this code with Assistant Coaches, Players, and Parents so they can join your team.
                </p>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="inline-flex items-center gap-2 mt-1 rounded-lg border border-[#3B82F6] bg-white px-4 py-2 text-sm font-medium text-[#1D4ED8] hover:bg-[#DBEAFE] transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 text-[#22C55E]" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copied!" : "Copy Team Code"}
                </button>
              </div>

              <div className="rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] p-4 text-sm text-[#6c757d] text-left">
                <p className="font-medium text-[#212529] mb-1">Save this code somewhere safe.</p>
                <p>You can also find your Team Code anytime inside your dashboard under Settings.</p>
              </div>

              <Button
                type="button"
                onClick={handleGoToDashboard}
                disabled={redirecting}
                className="w-full font-athletic uppercase tracking-wide"
                size="lg"
              >
                {redirecting ? "Taking you to your dashboard..." : "Go to Dashboard"}
              </Button>
            </div>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <section className="relative min-h-screen flex items-center justify-center px-4 py-24 md:py-32">
        <div className="container mx-auto">
          <div className="w-full max-w-2xl mx-auto p-10 rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
            <div className="mb-8">
              {/* Step progress bar */}
              <div className="flex items-center gap-2 mb-6">
                {[1, 2, 3].map((step) => (
                  <div key={step} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className={`h-1.5 w-full rounded-full transition-colors ${
                        step <= 3 ? "bg-[#3B82F6]" : "bg-[#E5E7EB]"
                      }`}
                    />
                    <span className={`text-xs font-medium ${step === 3 ? "text-[#3B82F6]" : "text-[#9CA3AF]"}`}>
                      {step === 1 ? "Account" : step === 2 ? "Program" : "Review"}
                    </span>
                  </div>
                ))}
              </div>

              <h2 className="text-3xl md:text-4xl font-athletic font-bold text-center mb-2 text-[#212529] uppercase tracking-tight">
                Review & Create
              </h2>
              <p className="text-center text-[#495057]">
                Step 3 of 3 — Confirm your program details
              </p>
            </div>

            <div className="space-y-6">
              {/* Program summary */}
              {signupData && (
                <div className="p-5 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB] space-y-2 text-sm">
                  <p className="font-semibold text-[#212529] text-base mb-3">Program Summary</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[#495057]">
                    <span className="text-[#9CA3AF]">Team Name</span>
                    <span className="font-medium text-[#212529]">{String(signupData.teamName || "—")}</span>
                    <span className="text-[#9CA3AF]">Sport</span>
                    <span className="font-medium text-[#212529] capitalize">{String(signupData.sportType || "—")}</span>
                    <span className="text-[#9CA3AF]">Program Type</span>
                    <span className="font-medium text-[#212529] capitalize">{String(signupData.programType || "—").replace("-", " ")}</span>
                    {Boolean(signupData.schoolName) && (
                      <>
                        <span className="text-[#9CA3AF]">School</span>
                        <span className="font-medium text-[#212529]">{String(signupData.schoolName)}</span>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="p-5 rounded-xl border border-dashed border-[#D1D5DB] bg-white space-y-2">
                <p className="text-sm font-semibold text-[#212529]">Payment — Coming Soon</p>
                <p className="text-sm text-[#6c757d]">
                  Billing setup via Stripe will be available before launch. You can complete your account now and configure payment from your dashboard.
                </p>
              </div>

              {error && (
                <div className="text-sm text-white bg-[#EF4444] border border-[#EF4444] rounded-lg p-3 font-medium" role="alert" aria-live="polite">
                  {error}
                </div>
              )}

              <div className="flex gap-4">
                <Button 
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  className="flex-1 bg-white border-[#E5E7EB] text-[#212529] hover:bg-[#F9FAFB]"
                  disabled={loading}
                >
                  Back
                </Button>
                <Button 
                  type="button"
                  onClick={handleComplete}
                  className="flex-1 font-athletic uppercase tracking-wide" 
                  size="lg"
                  disabled={loading}
                >
                  {loading ? "Creating account..." : "Complete Signup"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

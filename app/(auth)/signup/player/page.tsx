"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SiteHeader } from "@/components/marketing/site-header"
import { LEGAL_POLICY_VERSIONS } from "@/lib/audit/compliance-config"
import Link from "next/link"
import { applyServerAuthSessionPayload, signIn, type SessionResponse } from "@/lib/auth/client-auth"
import type { PlayerJoinAnalyzeResponse, PlayerJoinMatchCandidate } from "@/lib/players/claim-types"
import { SmsConsentCheckbox } from "@/components/compliance/sms-consent-checkbox"
import { normalizePlayerJoinCode } from "@/lib/players/join-code-normalize"

type Step = "code" | "info" | "match" | "account"

const CODE_NOT_FOUND_MSG =
  "We couldn’t find a team for that code. Double-check the code from your coach or try scanning the QR again."

function PlayerJoinSignupInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const codeFromQuery = useMemo(() => {
    const raw = searchParams.get("code")
    return raw ? normalizePlayerJoinCode(raw) : ""
  }, [searchParams])

  const [step, setStep] = useState<Step>("code")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(() => codeFromQuery.length > 0)

  const [joinCode, setJoinCode] = useState("")
  const [teamName, setTeamName] = useState<string | null>(null)

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [graduationYear, setGraduationYear] = useState("")
  const [jerseyNumber, setJerseyNumber] = useState("")
  const [dateOfBirth, setDateOfBirth] = useState("")

  const [analyzeResult, setAnalyzeResult] = useState<PlayerJoinAnalyzeResponse | null>(null)
  const [selectedCandidate, setSelectedCandidate] = useState<PlayerJoinMatchCandidate | null>(null)
  const [confirmNotListed, setConfirmNotListed] = useState(false)

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [playerAge, setPlayerAge] = useState("")
  const [parentEmail, setParentEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [smsOptIn, setSmsOptIn] = useState(false)
  const [acceptLegalBundle, setAcceptLegalBundle] = useState(false)
  const [confirmMinorConsent, setConfirmMinorConsent] = useState(false)

  useEffect(() => {
    if (!codeFromQuery) {
      setInitializing(false)
      return
    }
    setJoinCode(codeFromQuery)
    setError("")
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch("/api/player/join/resolve-team", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ joinCode: codeFromQuery }),
        })
        const data = (await res.json()) as { ok?: boolean; teamName?: string | null; error?: string }
        if (cancelled) return
        if (res.ok && data.ok) {
          setTeamName(data.teamName ?? null)
          setStep("info")
        } else {
          const notFound = data.error === "invalid_code" || res.status === 404
          setError(
            notFound
              ? CODE_NOT_FOUND_MSG
              : res.status === 403
                ? "Signup is temporarily unavailable. Try again later or contact support."
                : "We couldn’t verify that link. Try again or enter your team code manually."
          )
          setStep("code")
        }
      } catch {
        if (!cancelled) {
          setError("Could not reach Braik. Check your connection and try again.")
          setStep("code")
        }
      } finally {
        if (!cancelled) setInitializing(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [codeFromQuery])

  const validatePassword = (pwd: string) => {
    if (pwd.length < 8) return false
    if (!/[A-Z]/.test(pwd)) return false
    if (!/[a-z]/.test(pwd)) return false
    if (!/[0-9]/.test(pwd)) return false
    if (!/[^A-Za-z0-9]/.test(pwd)) return false
    return true
  }

  const handleResolveCode = async () => {
    setError("")
    const normalized = normalizePlayerJoinCode(joinCode)
    if (!normalized) {
      setError("Enter the team join code from your coach.")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/player/join/resolve-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ joinCode: normalized }),
      })
      const data = (await res.json()) as { ok?: boolean; teamName?: string | null; error?: string }
      if (!res.ok || !data.ok) {
        const notFound = data.error === "invalid_code" || res.status === 404
        setError(
          notFound
            ? CODE_NOT_FOUND_MSG
            : res.status === 403
              ? "Signup is temporarily unavailable. Try again later or contact support."
              : "We couldn’t verify that code. Try again in a moment."
        )
        setLoading(false)
        return
      }
      setTeamName(data.teamName ?? null)
      setStep("info")
    } catch {
      setError("Network error. Try again.")
    }
    setLoading(false)
  }

  const handleAnalyze = async () => {
    setError("")
    if (!firstName.trim() || !lastName.trim()) {
      setError("First and last name are required.")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/player/join/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          joinCode: normalizePlayerJoinCode(joinCode),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          jerseyNumber: jerseyNumber.trim() ? Number(jerseyNumber) : undefined,
          graduationYear: graduationYear.trim() ? Number(graduationYear) : undefined,
          dateOfBirth: dateOfBirth.trim() || undefined,
        }),
      })
      const data = (await res.json()) as PlayerJoinAnalyzeResponse & { error?: string }
      if (!res.ok) {
        setError(data.error ?? "Could not check roster match.")
        setLoading(false)
        return
      }
      if (data.outcome === "invalid_code") {
        setError(CODE_NOT_FOUND_MSG)
        setLoading(false)
        return
      }
      setAnalyzeResult(data)
      setConfirmNotListed(false)
      setSelectedCandidate(null)
      if (data.outcome === "needs_confirmation") {
        setStep("match")
      } else {
        setStep("account")
      }
    } catch {
      setError("Network error. Try again.")
    }
    setLoading(false)
  }

  const continueFromMatch = () => {
    setError("")
    if (!confirmNotListed && !selectedCandidate) {
      setError("Select the roster row that is you, or confirm that none match.")
      return
    }
    setStep("account")
  }

  const handleCreateAccount = async () => {
    setError("")
    if (!email.trim() || !password || !confirmPassword) {
      setError("Email and password are required.")
      return
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }
    if (!validatePassword(password)) {
      setError("Password must meet complexity requirements (see signup help).")
      return
    }
    if (!acceptLegalBundle) {
      setError("Please accept the legal policies to continue.")
      return
    }
    const isMinorPlayer = Number(playerAge) > 0 && Number(playerAge) < 18
    if (!playerAge) {
      setError("Player age is required.")
      return
    }
    if (isMinorPlayer && (!confirmMinorConsent || !parentEmail.trim())) {
      setError("Minor players require parent email and consent confirmation.")
      return
    }
    const phoneTrim = phone.trim()
    if (phoneTrim && !smsOptIn) {
      setError("Agree to SMS terms or remove the phone number.")
      return
    }

    let playerJoinIntent: "auto" | "confirm" | "new"
    let confirmedPlayerId: string | undefined

    if (analyzeResult?.outcome === "auto_claim") {
      playerJoinIntent = "auto"
    } else if (analyzeResult?.outcome === "needs_confirmation") {
      if (confirmNotListed) {
        playerJoinIntent = "new"
      } else if (selectedCandidate) {
        playerJoinIntent = "confirm"
        confirmedPlayerId = selectedCandidate.id
      } else {
        setError("Select a roster match or confirm none apply.")
        return
      }
    } else {
      playerJoinIntent = "new"
    }

    setLoading(true)
    try {
      const compliance = {
        terms: { version: LEGAL_POLICY_VERSIONS.terms, acceptedAt: new Date().toISOString() },
        privacy: { version: LEGAL_POLICY_VERSIONS.privacy, acceptedAt: new Date().toISOString() },
        acceptableUse: { version: LEGAL_POLICY_VERSIONS.acceptableUse, acceptedAt: new Date().toISOString() },
        aiAcknowledgement: { version: LEGAL_POLICY_VERSIONS.aiAcknowledgement, acceptedAt: new Date().toISOString() },
        minorParentalConsent: isMinorPlayer
          ? {
              version: LEGAL_POLICY_VERSIONS.privacy,
              acceptedAt: new Date().toISOString(),
              parentEmail: parentEmail.trim(),
              playerAge: Number(playerAge),
            }
          : null,
      }

      const response = await fetch("/api/auth/signup-secure", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${firstName.trim()} ${lastName.trim()}`,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim(),
          password,
          role: "player",
          teamId: normalizePlayerJoinCode(joinCode),
          playerJoinIntent,
          confirmedPlayerId,
          graduationYear: graduationYear.trim() ? Number(graduationYear) : undefined,
          jerseyNumber: jerseyNumber.trim() ? Number(jerseyNumber) : undefined,
          dateOfBirth: dateOfBirth.trim() || undefined,
          playerAge,
          parentEmail: parentEmail.trim() || undefined,
          phone: phoneTrim || undefined,
          smsOptIn: phoneTrim ? smsOptIn : false,
          compliance,
        }),
      })

      const data = (await response.json()) as {
        error?: string
        details?: string
        supabaseSession?: { access_token: string; refresh_token: string; expires_at?: number }
        user?: SessionResponse["user"]
        sessionEstablishFailed?: boolean
      }

      if (!response.ok) {
        setError(data.error ?? "Signup failed.")
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
          email: email.trim(),
          password,
          redirect: false,
        })
        if (result?.error) {
          setError("Account created but sign-in failed. Try logging in manually.")
          setLoading(false)
          return
        }
      }

      router.push("/dashboard")
      router.refresh()
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error"
      setError(msg)
    }
    setLoading(false)
  }

  if (initializing) {
    return (
      <div className="min-h-screen bg-white">
        <SiteHeader />
        <section className="relative min-h-screen flex items-center justify-center px-4 py-24 md:py-32">
          <p className="text-[#495057]">Loading team…</p>
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
            <div className="mb-8 text-center space-y-2">
              <h2 className="text-3xl md:text-4xl font-athletic font-bold text-[#212529] uppercase tracking-tight">
                Join as player
              </h2>
              <p className="text-[#495057]">
                Enter your team&apos;s player join code from your coach. Your full roster stays private until you&apos;re
                linked.
              </p>
            </div>

            {teamName ? (
              <div className="mb-6 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3 text-center" role="status">
                <p className="text-base font-semibold text-[#1E40AF]">Joining {teamName}</p>
                <p className="text-xs text-[#1E3A8A]/90 mt-1">
                  Complete the steps below. Matching and coach review still apply—this link only fills in your team code.
                </p>
              </div>
            ) : null}

            {step === "code" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="joinCode">Team join code</Label>
                  <Input
                    id="joinCode"
                    value={joinCode}
                    onChange={(e) => setJoinCode(normalizePlayerJoinCode(e.target.value))}
                    className="font-mono text-lg tracking-wider"
                    placeholder="e.g. ABC12XY9"
                    autoComplete="off"
                  />
                </div>
                <Button
                  type="button"
                  className="w-full font-athletic uppercase tracking-wide"
                  size="lg"
                  onClick={handleResolveCode}
                  disabled={loading || !normalizePlayerJoinCode(joinCode)}
                >
                  {loading ? "Checking…" : "Continue"}
                </Button>
              </div>
            )}

            {step === "info" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fn">First name *</Label>
                    <Input id="fn" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ln">Last name *</Label>
                    <Input id="ln" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="jy">Jersey #</Label>
                    <Input id="jy" inputMode="numeric" value={jerseyNumber} onChange={(e) => setJerseyNumber(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gy">Graduation year</Label>
                    <Input id="gy" inputMode="numeric" value={graduationYear} onChange={(e) => setGraduationYear(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dob">Date of birth</Label>
                    <Input id="dob" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
                  </div>
                </div>
                <p className="text-xs text-[#6B7280]">
                  Jersey, graduation year, and DOB help match you to a coach-created roster spot without exposing the roster.
                </p>
                <div className="flex gap-3">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setStep("code")}>
                    Back
                  </Button>
                  <Button type="button" className="flex-1 font-athletic uppercase tracking-wide" onClick={handleAnalyze} disabled={loading}>
                    {loading ? "Checking…" : "Continue"}
                  </Button>
                </div>
              </div>
            )}

            {step === "match" && analyzeResult?.candidates && (
              <div className="space-y-4">
                <p className="text-sm text-[#495057]">
                  We found a possible roster match. Select the one that is you, or choose &quot;None of these&quot; if your coach
                  should review manually.
                </p>
                <div className="space-y-2 max-h-72 overflow-y-auto rounded-lg border border-[#E5E7EB] p-2">
                  {analyzeResult.candidates.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedCandidate(c)
                        setConfirmNotListed(false)
                      }}
                      className={`w-full text-left rounded-lg px-3 py-2 border transition-colors ${
                        selectedCandidate?.id === c.id
                          ? "border-[#3B82F6] bg-[#EFF6FF]"
                          : "border-transparent hover:bg-[#F9FAFB]"
                      }`}
                    >
                      <div className="font-medium text-[#212529]">
                        {c.firstName} {c.lastName}
                      </div>
                      <div className="text-xs text-[#6B7280]">
                        {[c.positionGroup ? `Position ${c.positionGroup}` : null, c.jerseyNumber != null ? `#${c.jerseyNumber}` : null, c.graduationYear != null ? `Class of ${c.graduationYear}` : null]
                          .filter(Boolean)
                          .join(" · ") || "Limited details shown"}
                      </div>
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-sm text-[#495057] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmNotListed}
                    onChange={(e) => {
                      setConfirmNotListed(e.target.checked)
                      if (e.target.checked) setSelectedCandidate(null)
                    }}
                  />
                  None of these are me — create a new roster entry for coach review
                </label>
                <div className="flex gap-3">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setStep("info")}>
                    Back
                  </Button>
                  <Button type="button" className="flex-1 font-athletic uppercase tracking-wide" onClick={continueFromMatch}>
                    Continue
                  </Button>
                </div>
              </div>
            )}

            {step === "account" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="em">Email *</Label>
                  <Input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ph">Mobile phone</Label>
                  <Input id="ph" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  {phone.trim() ? <SmsConsentCheckbox id="player-join-sms" checked={smsOptIn} onChange={setSmsOptIn} /> : null}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pa">Player age *</Label>
                  <Input id="pa" type="number" min={1} max={99} value={playerAge} onChange={(e) => setPlayerAge(e.target.value)} />
                </div>
                {Number(playerAge) > 0 && Number(playerAge) < 18 && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="pe">Parent / guardian email *</Label>
                      <Input id="pe" type="email" value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} />
                    </div>
                    <label className="flex items-start gap-3 py-2.5 px-3 rounded-lg bg-[#FFFBEB] border border-[#FDE68A] cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-1 shrink-0"
                        checked={confirmMinorConsent}
                        onChange={(e) => setConfirmMinorConsent(e.target.checked)}
                      />
                      <span className="text-sm text-[#92400E] leading-snug">
                        I confirm parental or legal guardian consent for this minor.
                      </span>
                    </label>
                  </>
                )}
                <div className="space-y-2">
                  <Label htmlFor="pw">Password *</Label>
                  <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pw2">Confirm password *</Label>
                  <Input id="pw2" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                </div>
                <label className="flex items-start gap-3 rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] px-3 py-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 shrink-0"
                    checked={acceptLegalBundle}
                    onChange={(e) => setAcceptLegalBundle(e.target.checked)}
                  />
                  <span className="text-sm text-[#495057] leading-relaxed">
                    I agree to the{" "}
                    <Link href="/terms" target="_blank" className="text-[#2563EB] font-medium hover:underline">
                      Terms
                    </Link>
                    ,{" "}
                    <Link href="/privacy" target="_blank" className="text-[#2563EB] font-medium hover:underline">
                      Privacy
                    </Link>
                    , and{" "}
                    <Link href="/acceptable-use" target="_blank" className="text-[#2563EB] font-medium hover:underline">
                      Acceptable Use
                    </Link>
                    .
                  </span>
                </label>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setStep(analyzeResult?.outcome === "needs_confirmation" ? "match" : "info")}
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    className="flex-1 font-athletic uppercase tracking-wide"
                    onClick={handleCreateAccount}
                    disabled={loading}
                  >
                    {loading ? "Creating…" : "Create account"}
                  </Button>
                </div>
              </div>
            )}

            {error ? (
              <div className="mt-4 text-sm text-white bg-[#EF4444] border border-[#EF4444] rounded-lg p-3 font-medium" role="alert">
                {error}
              </div>
            ) : null}

            <p className="mt-6 text-center text-sm text-[#6c757d]">
              Wrong path?{" "}
              <Link href="/signup/role" className="text-[#3B82F6] hover:underline font-medium">
                Other sign up options
              </Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}

function PlayerJoinSignupFallback() {
  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <section className="relative min-h-screen flex items-center justify-center px-4 py-24 md:py-32">
        <p className="text-[#495057]">Loading…</p>
      </section>
    </div>
  )
}

export default function PlayerJoinSignupPage() {
  return (
    <Suspense fallback={<PlayerJoinSignupFallback />}>
      <PlayerJoinSignupInner />
    </Suspense>
  )
}

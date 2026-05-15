"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SiteHeader } from "@/components/marketing/site-header"
import { SmsConsentCheckbox } from "@/components/compliance/sms-consent-checkbox"
import { LEGAL_POLICY_VERSIONS } from "@/lib/audit/compliance-config"
import {
  applyServerAuthSessionPayload,
  signIn,
  type SessionResponse,
} from "@/lib/auth/client-auth"
import { resolveClientPostAuthDestination } from "@/lib/auth/resolve-client-post-auth-destination"
import {
  BRAIK_PARENT_JOIN_PREVIEW_SESSION_KEY,
  BRAIK_PARENT_PLAYER_CODE_SESSION_KEY,
} from "@/lib/parent/parent-join-session-keys"

type SignupApiError = {
  error?: string
  code?: string
  details?: string
  consentVerificationRequired?: boolean
  message?: string
}

function validatePasswordComplexity(pwd: string) {
  if (pwd.length < 8) return false
  if (!/[A-Z]/.test(pwd)) return false
  if (!/[a-z]/.test(pwd)) return false
  if (!/[0-9]/.test(pwd)) return false
  if (!/[^A-Za-z0-9]/.test(pwd)) return false
  return true
}

export default function ParentJoinCreateAccountPage() {
  const router = useRouter()
  const [playerCode, setPlayerCode] = useState<string | null>(null)
  const [playerLabel, setPlayerLabel] = useState<string | null>(null)
  const [teamLabel, setTeamLabel] = useState<string | null>(null)
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [phone, setPhone] = useState("")
  const [smsOptIn, setSmsOptIn] = useState(false)
  const [acceptLegalBundle, setAcceptLegalBundle] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    const rawCode = sessionStorage.getItem(BRAIK_PARENT_PLAYER_CODE_SESSION_KEY)?.trim()
    if (!rawCode) {
      router.replace("/parent/join")
      return
    }
    setPlayerCode(rawCode.toUpperCase())
    const previewRaw = sessionStorage.getItem(BRAIK_PARENT_JOIN_PREVIEW_SESSION_KEY)
    if (previewRaw) {
      try {
        const p = JSON.parse(previewRaw) as { playerDisplayName?: string | null; teamName?: string | null }
        setPlayerLabel(typeof p.playerDisplayName === "string" ? p.playerDisplayName : null)
        setTeamLabel(typeof p.teamName === "string" ? p.teamName : null)
      } catch {
        /* ignore */
      }
    }
  }, [router])

  const handleSubmit = async () => {
    setError("")
    if (!playerCode) {
      setError("Your session expired. Start again from Parent Access.")
      return
    }
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password || !confirmPassword) {
      setError("Please fill in all required fields.")
      return
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }
    if (!validatePasswordComplexity(password)) {
      setError(
        "Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character."
      )
      return
    }
    if (!acceptLegalBundle) {
      setError("Please confirm you agree to the Terms, Privacy Policy, Acceptable Use Policy, and AI transparency notice.")
      return
    }
    const phoneTrim = phone.trim()
    if (phoneTrim && !smsOptIn) {
      setError("When you add a mobile number, agree to transactional SMS from Braik or remove the phone number.")
      return
    }

    setLoading(true)
    try {
      const compliance = {
        terms: { version: LEGAL_POLICY_VERSIONS.terms, acceptedAt: new Date().toISOString() },
        privacy: { version: LEGAL_POLICY_VERSIONS.privacy, acceptedAt: new Date().toISOString() },
        acceptableUse: { version: LEGAL_POLICY_VERSIONS.acceptableUse, acceptedAt: new Date().toISOString() },
        aiAcknowledgement: { version: LEGAL_POLICY_VERSIONS.aiAcknowledgement, acceptedAt: new Date().toISOString() },
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
          role: "parent",
          teamId: playerCode,
          phone: phoneTrim || undefined,
          smsOptIn: phoneTrim ? smsOptIn : false,
          compliance,
        }),
      })

      const data = (await response.json()) as SignupApiError & {
        redirectTo?: string
        supabaseSession?: { access_token: string; refresh_token: string; expires_at?: number }
        user?: SessionResponse["user"]
      }

      if (!response.ok) {
        const msg = data.details ? `${data.error ?? "Signup failed"} ${data.details}` : data.error ?? "Signup failed."
        setError(msg)
        setLoading(false)
        return
      }

      if (data.consentVerificationRequired) {
        setError(data.message ?? "Parental consent verification is required before account activation.")
        setLoading(false)
        return
      }

      if (data.supabaseSession && data.user) {
        await applyServerAuthSessionPayload({
          user: data.user,
          supabaseSession: data.supabaseSession,
        })
      } else {
        const login = await signIn("credentials", {
          email: email.trim(),
          password,
          redirect: false,
        })
        if (login?.error) {
          setError("Account was created but sign-in failed. Try signing in manually.")
          setLoading(false)
          return
        }
      }

      sessionStorage.removeItem(BRAIK_PARENT_PLAYER_CODE_SESSION_KEY)
      sessionStorage.removeItem(BRAIK_PARENT_JOIN_PREVIEW_SESSION_KEY)

      const dest = await resolveClientPostAuthDestination(data, { profileRole: "parent" })
      router.push(dest)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.")
      setLoading(false)
    }
  }

  if (!playerCode) {
    return (
      <div className="min-h-screen bg-white">
        <SiteHeader />
        <section className="relative min-h-screen flex items-center justify-center px-4 py-24">
          <p className="text-[#495057]">Loading…</p>
        </section>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <section className="relative min-h-screen flex items-center justify-center px-4 py-24 md:py-32">
        <div className="container mx-auto">
          <div className="w-full max-w-lg mx-auto p-10 rounded-2xl border border-[#E5E7EB] bg-white shadow-sm space-y-6">
            <div className="text-center space-y-2">
              <h1 className="text-2xl font-athletic font-bold text-[#212529] uppercase tracking-tight">
                Create parent account
              </h1>
              <p className="text-sm text-[#495057]">
                You&apos;re connecting to an existing player profile on your team. Braik grants coach and AD accounts through your
                school&apos;s Braik admin — use Request access only if you were instructed to.
              </p>
            </div>

            <div className="rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-4 text-center space-y-1" role="status">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#1E40AF]">Athlete on roster</p>
              <p className="text-lg font-medium text-[#172554]">{playerLabel ?? "Confirmed athlete"}</p>
              {teamLabel ? <p className="text-sm text-[#1E3A8A]/90">Team: {teamLabel}</p> : null}
              <p className="text-xs font-mono tracking-wider text-[#374151] pt-1">Code ••••{playerCode.slice(-4)}</p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fn">First name *</Label>
                  <Input id="fn" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ln">Last name *</Label>
                  <Input id="ln" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="em">Email *</Label>
                <Input
                  id="em"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pw">Password *</Label>
                <Input
                  id="pw"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pw2">Confirm password *</Label>
                <Input
                  id="pw2"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tel">Mobile phone (optional)</Label>
                <Input
                  id="tel"
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                />
              </div>
              {phone.trim() ? (
                <SmsConsentCheckbox id="parent-join-sms" checked={smsOptIn} onChange={setSmsOptIn} />
              ) : null}
              <label className="flex items-start gap-3 text-sm text-[#495057] cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-[#D1D5DB]"
                  checked={acceptLegalBundle}
                  onChange={(e) => setAcceptLegalBundle(e.target.checked)}
                />
                <span>
                  I agree to the{" "}
                  <Link href="/terms" className="text-[#2563EB] underline underline-offset-2">
                    Terms
                  </Link>
                  ,{" "}
                  <Link href="/privacy" className="text-[#2563EB] underline underline-offset-2">
                    Privacy Policy
                  </Link>
                  ,{" "}
                  <Link href="/acceptable-use" className="text-[#2563EB] underline underline-offset-2">
                    Acceptable Use
                  </Link>
                  , and{" "}
                  <Link href="/ai-transparency" className="text-[#2563EB] underline underline-offset-2">
                    AI transparency
                  </Link>
                  .
                </span>
              </label>
            </div>

            {error ? (
              <div className="text-sm text-white bg-[#EF4444] border border-[#EF4444] rounded-lg p-3 font-medium" role="alert">
                {error}
              </div>
            ) : null}

            <div className="flex gap-3">
              <Button type="button" variant="outline" className="flex-1" asChild>
                <Link href="/parent/join">Back</Link>
              </Button>
              <Button
                type="button"
                className="flex-1 font-athletic uppercase tracking-wide"
                size="lg"
                disabled={loading}
                onClick={() => void handleSubmit()}
              >
                {loading ? "Creating…" : "Create account"}
              </Button>
            </div>

            <p className="text-center text-sm text-[#6B7280]">
              Already have an account?{" "}
              <Link href="/login" className="font-medium text-[#3B82F6] hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}

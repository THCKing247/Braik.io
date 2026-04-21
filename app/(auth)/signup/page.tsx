"use client"

import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SiteHeader } from "@/components/marketing/site-header"
import { LEGAL_POLICY_VERSIONS } from "@/lib/audit/compliance-config"
import Link from "next/link"
import { SmsConsentCheckbox } from "@/components/compliance/sms-consent-checkbox"

const JOIN_TOKEN_SESSION_KEY = "braik_join_token"
const PARENT_CODE_SESSION_KEY = "braik_parent_player_code"

export default function SignupPage() {
  const router = useRouter()
  const [error, setError] = useState("")
  const [role, setRole] = useState("")
  const [teamId, setTeamId] = useState("")

  // Personal Information
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [dateOfBirth, setDateOfBirth] = useState("")
  const [phone, setPhone] = useState("")
  const [smsOptIn, setSmsOptIn] = useState(false)

  const [acceptLegalBundle, setAcceptLegalBundle] = useState(false)

  const withErrorCode = (code: string, message: string) => `[${code}] ${message}`

  // Load from localStorage if available
  useEffect(() => {
    const saved = localStorage.getItem("signupData")
    if (saved) {
      const data = JSON.parse(saved)
      setRole(data.role || "")
      if (data.role !== "head-coach") {
        let tid = data.teamId || ""
        if (data.role === "parent" && typeof window !== "undefined" && !tid) {
          const fromParentFlow = sessionStorage.getItem(PARENT_CODE_SESSION_KEY)
          if (fromParentFlow) {
            tid = fromParentFlow
            data.teamId = fromParentFlow
            localStorage.setItem("signupData", JSON.stringify(data))
          }
        }
        setTeamId(tid)
      }
      setFirstName(data.firstName || "")
      setLastName(data.lastName || "")
      setEmail(data.email || "")
      setDateOfBirth(data.dateOfBirth || "")
      setPhone(data.phone || "")
      setSmsOptIn(Boolean(data.smsOptIn))
      const c = data?.compliance
      setAcceptLegalBundle(
        Boolean(c?.terms?.acceptedAt) &&
          Boolean(c?.privacy?.acceptedAt) &&
          Boolean(c?.acceptableUse?.acceptedAt) &&
          Boolean(c?.aiAcknowledgement?.acceptedAt)
      )
    } else {
      router.push("/signup/role")
    }
  }, [router])

  // ── Validation ─────────────────────────────────────────────────────────────
  const validatePassword = (pwd: string) => {
    if (pwd.length < 8) return false
    if (!/[A-Z]/.test(pwd)) return false
    if (!/[a-z]/.test(pwd)) return false
    if (!/[0-9]/.test(pwd)) return false
    if (!/[^A-Za-z0-9]/.test(pwd)) return false
    return true
  }

  const handleContinue = () => {
    setError("")

    if (!role) {
      router.push("/signup/role")
      return
    }

    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      setError(withErrorCode("SIGNUP-VALIDATION-001", "Please fill in all required fields before continuing."))
      return
    }

    if (password !== confirmPassword) {
      setError(withErrorCode("SIGNUP-VALIDATION-002", "Passwords do not match. Re-enter both password fields."))
      return
    }

    if (!validatePassword(password)) {
      setError(withErrorCode("SIGNUP-VALIDATION-003", "Password must be at least 8 characters and include uppercase, lowercase, numeric, and special characters."))
      return
    }

    if (role === "parent" && !teamId.trim()) {
      setError(
        withErrorCode(
          "SIGNUP-VALIDATION-008",
          "Enter your child's player code, or start at Parent sign up (/parent/join) to validate the code first."
        )
      )
      return
    }

    if (role === "player") {
      const hasJoinToken =
        typeof window !== "undefined" && Boolean(sessionStorage.getItem(JOIN_TOKEN_SESSION_KEY))
      if (!teamId.trim() && !hasJoinToken) {
        setError(
          withErrorCode(
            "SIGNUP-VALIDATION-009",
            "Use the invite link from your coach, or enter your personal player code from the team roster before continuing."
          )
        )
        return
      }
    }

    if (!acceptLegalBundle) {
      setError(
        withErrorCode(
          "SIGNUP-COMPLIANCE-001",
          "Please confirm you agree to the Terms, Privacy Policy, Acceptable Use Policy, and AI transparency notice before continuing."
        )
      )
      return
    }

    if (role === "player" && !dateOfBirth.trim()) {
      setError(withErrorCode("SIGNUP-COMPLIANCE-005", "Date of birth is required."))
      return
    }

    const phoneTrim = phone.trim()
    if (phoneTrim && !smsOptIn) {
      setError(
        withErrorCode(
          "SIGNUP-SMS-001",
          "You added a mobile number — please agree to transactional SMS messages from Braik (see below) or clear the phone field to continue."
        )
      )
      return
    }

    // Save to localStorage
    const saved = localStorage.getItem("signupData")
    const signupData = saved ? JSON.parse(saved) : {}
    signupData.firstName = firstName
    signupData.lastName = lastName
    signupData.email = email
    signupData.password = password
    signupData.role = role
    signupData.dateOfBirth = dateOfBirth.trim()
    signupData.phone = phoneTrim || undefined
    signupData.smsOptIn = phoneTrim ? smsOptIn : false
    signupData.compliance = {
      terms: {
        version: LEGAL_POLICY_VERSIONS.terms,
        acceptedAt: new Date().toISOString(),
      },
      privacy: {
        version: LEGAL_POLICY_VERSIONS.privacy,
        acceptedAt: new Date().toISOString(),
      },
      acceptableUse: {
        version: LEGAL_POLICY_VERSIONS.acceptableUse,
        acceptedAt: new Date().toISOString(),
      },
      aiAcknowledgement: {
        version: LEGAL_POLICY_VERSIONS.aiAcknowledgement,
        acceptedAt: new Date().toISOString(),
      },
    }
    if (teamId) {
      signupData.teamId = teamId
    }
    localStorage.setItem("signupData", JSON.stringify(signupData))

    if (role === "head-coach") {
      router.push("/signup/program")
    } else {
      router.push("/signup/complete")
    }
  }

  // ── Password strength ─────────────────────────────────────────────────────
  const passwordChecks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ]
  const passwordPassed = passwordChecks.filter(Boolean).length
  const passwordLabel = passwordPassed <= 2 ? "Weak" : passwordPassed <= 3 ? "Fair" : passwordPassed === 4 ? "Good" : "Strong"
  const passwordColor = passwordPassed <= 2 ? "#EF4444" : passwordPassed <= 3 ? "#F59E0B" : passwordPassed === 4 ? "#3B82F6" : "#22C55E"

  return (
    <>
      <div className="min-h-screen bg-white">
        <SiteHeader />
        <section className="relative min-h-screen flex items-center justify-center px-4 py-24 md:py-32">
          <div className="container mx-auto">
            <div className="w-full max-w-2xl mx-auto p-10 rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
              <div className="mb-8">
                {/* Step progress bar */}
                {role === "head-coach" ? (
                  <div className="flex items-center gap-2 mb-6">
                    {[
                      { label: "Account", active: true },
                      { label: "Program", active: false },
                      { label: "Review", active: false },
                    ].map((step, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className={`h-1.5 w-full rounded-full ${step.active ? "bg-[#3B82F6]" : "bg-[#E5E7EB]"}`} />
                        <span className={`text-xs font-medium ${step.active ? "text-[#3B82F6]" : "text-[#9CA3AF]"}`}>
                          {step.label}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mb-6">
                    {[
                      { label: "Account", active: true },
                      { label: "Review", active: false },
                    ].map((step, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className={`h-1.5 w-full rounded-full ${step.active ? "bg-[#3B82F6]" : "bg-[#E5E7EB]"}`} />
                        <span className={`text-xs font-medium ${step.active ? "text-[#3B82F6]" : "text-[#9CA3AF]"}`}>
                          {step.label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {(role === "head-coach" || role === "assistant-coach") && (
                  <p className="text-center text-sm font-semibold uppercase tracking-wider text-[#6B7280] mb-1">
                    Coaches & staff
                  </p>
                )}
                {(role === "player" || role === "parent") && (
                  <p className="text-center text-sm font-semibold uppercase tracking-wider text-[#6B7280] mb-1">
                    Players & parents
                  </p>
                )}
                <h2 className="text-3xl md:text-4xl font-athletic font-bold text-center mb-2 text-[#212529] uppercase tracking-tight">
                  Sign up for Braik
                </h2>
                <p className="text-center text-[#495057]">
                  {role === "head-coach" ? "Step 1 of 3 — Personal Information" : "Step 1 of 2 — Personal Information"}
                </p>
              </div>

              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-xl font-athletic font-semibold text-[#212529] uppercase tracking-wide">Personal Information</h3>

                  {role && role !== "head-coach" && (
                    <div className="space-y-2">
                      <Label htmlFor="teamId" className="text-sm font-medium text-foreground">
                        {role === "parent"
                          ? "Player code"
                          : role === "player"
                            ? "Player / team code"
                            : "Team code"}{" "}
                        {role === "parent" ? (
                          <span className="font-normal text-[#9CA3AF]">(required)</span>
                        ) : role === "player" ? (
                          <span className="font-normal text-[#9CA3AF]">(required unless you use a coach invite link)</span>
                        ) : (
                          <span className="font-normal text-[#9CA3AF]">(optional)</span>
                        )}
                      </Label>
                      <Input
                        id="teamId"
                        type="text"
                        value={teamId}
                        onChange={(e) => setTeamId(e.target.value.toUpperCase())}
                        className="bg-background text-foreground placeholder:text-muted-foreground font-mono text-lg tracking-wider"
                        placeholder={
                          role === "parent"
                            ? "Your child's personal player code"
                            : role === "player"
                              ? "Personal player code from your coach"
                              : "Staff invite or team code from your head coach"
                        }
                        maxLength={20}
                      />
                      <p className="text-xs text-muted-foreground">
                        {role === "parent" ? (
                          <>
                            Parents should start at{" "}
                            <a href="/parent/join" className="font-medium text-[#3B82F6] hover:underline">
                              Parent sign up
                            </a>{" "}
                            to enter this code first (same code works here).
                          </>
                        ) : role === "player" ? (
                          "Coaches issue this from the team roster. If you opened an invite link from your coach, you can leave this blank and finish linking after you create your account."
                        ) : (
                          "Get a staff invite or team code from your head coach. You can also connect after signing up."
                        )}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName" className="text-sm font-medium text-foreground">First Name *</Label>
                      <Input
                        id="firstName"
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="bg-background text-foreground placeholder:text-muted-foreground"
                        placeholder="First name"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName" className="text-sm font-medium text-foreground">Last Name *</Label>
                      <Input
                        id="lastName"
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="bg-background text-foreground placeholder:text-muted-foreground"
                        placeholder="Last name"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium text-foreground">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-background text-foreground placeholder:text-muted-foreground"
                      placeholder="your.email@example.com"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-sm font-medium text-foreground">
                      Mobile phone <span className="font-normal text-[#9CA3AF]">(optional)</span>
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value)
                        if (!e.target.value.trim()) setSmsOptIn(false)
                      }}
                      className="bg-background text-foreground placeholder:text-muted-foreground"
                      placeholder="+1 (555) 123-4567"
                    />
                    <p className="text-xs text-muted-foreground">
                      Used only for transactional texts about your team (invites, schedule, roster, account alerts). Message frequency varies. Reply STOP to opt out.
                    </p>
                  </div>

                  {phone.trim() ? (
                    <SmsConsentCheckbox id="signup-sms-consent" checked={smsOptIn} onChange={setSmsOptIn} />
                  ) : null}

                  {role === "player" && (
                    <div className="space-y-2">
                      <Label htmlFor="dateOfBirth" className="text-sm font-medium text-foreground">
                        Date of birth *
                      </Label>
                      <Input
                        id="dateOfBirth"
                        type="date"
                        value={dateOfBirth}
                        onChange={(e) => setDateOfBirth(e.target.value)}
                        className="bg-background text-foreground placeholder:text-muted-foreground"
                        required
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium text-foreground">Password *</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-background text-foreground placeholder:text-muted-foreground"
                      placeholder="Enter password"
                      required
                    />
                    {/* Password strength meter */}
                    {password.length > 0 ? (
                      <div className="space-y-1.5">
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((seg) => (
                            <div
                              key={seg}
                              className="flex-1 h-1 rounded-full transition-colors duration-200"
                              style={{ backgroundColor: seg <= passwordPassed ? passwordColor : "#E5E7EB" }}
                            />
                          ))}
                        </div>
                        <p className="text-xs font-medium" style={{ color: passwordColor }}>
                          {passwordLabel} —{" "}
                          {["8+ chars", "uppercase", "lowercase", "number", "special char"]
                            .filter((_, i) => !passwordChecks[i])
                            .map((req) => `needs ${req}`)
                            .join(", ") || "All requirements met ✓"}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Must be 8+ characters with uppercase, lowercase, number, and special character
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">Confirm Password *</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="bg-background text-foreground placeholder:text-muted-foreground"
                      placeholder="Confirm password"
                      required
                    />
                  </div>
                </div>

                {/* ── Legal Acknowledgments (single checkbox + linked policies) ── */}
                <div className="space-y-2 border-t border-[#E5E7EB] pt-5">
                  <p className="text-sm font-semibold text-[#212529]">Legal</p>
                  <label className="flex items-start gap-3 rounded-lg bg-[#F9FAFB] border border-[#E5E7EB] px-3 py-3 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 shrink-0 rounded border-[#D1D5DB] text-[#2563EB] focus:ring-[#3B82F6]"
                      checked={acceptLegalBundle}
                      onChange={(e) => setAcceptLegalBundle(e.target.checked)}
                    />
                    <span className="text-sm text-[#495057] leading-relaxed">
                      I have read and agree to the{" "}
                      <Link href="/terms" target="_blank" rel="noopener noreferrer" className="text-[#2563EB] font-medium hover:underline">
                        Terms of Service
                      </Link>
                      ,{" "}
                      <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="text-[#2563EB] font-medium hover:underline">
                        Privacy Policy
                      </Link>
                      , and{" "}
                      <Link href="/acceptable-use" target="_blank" rel="noopener noreferrer" className="text-[#2563EB] font-medium hover:underline">
                        Acceptable Use Policy
                      </Link>
                      . I understand that Braik includes AI-powered features and that I must review{" "}
                      <Link href="/ai-transparency" target="_blank" rel="noopener noreferrer" className="text-[#2563EB] font-medium hover:underline">
                        AI-generated outputs
                      </Link>{" "}
                      before relying on them with my team.
                    </span>
                  </label>
                  <p className="text-xs text-[#6c757d]">
                    Links open in a new tab so you can review policies without losing your place on this form.
                  </p>

                </div>

                {/* Social Login — Coming Soon */}
                <div className="space-y-3 border-t border-[#E5E7EB] pt-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-[#E5E7EB]" />
                    <span className="text-xs text-[#9CA3AF] font-medium uppercase tracking-wide whitespace-nowrap">Coming soon</span>
                    <div className="flex-1 h-px bg-[#E5E7EB]" />
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-[#D1D5DB] bg-[#F9FAFB] text-[#9CA3AF] text-sm cursor-not-allowed select-none">
                      <svg className="w-4 h-4 opacity-50" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      Sign in with Google
                    </div>
                    <div className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-[#D1D5DB] bg-[#F9FAFB] text-[#9CA3AF] text-sm cursor-not-allowed select-none">
                      <svg className="w-4 h-4 opacity-50" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.61 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                      </svg>
                      Sign in with Apple
                    </div>
                  </div>
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
                    onClick={() => router.push("/signup/role")}
                    className="flex-1 bg-white border-[#E5E7EB] text-[#212529] hover:bg-[#F9FAFB]"
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    onClick={handleContinue}
                    className="flex-1 font-athletic uppercase tracking-wide"
                    size="lg"
                  >
                    Continue
                  </Button>
                </div>
              </div>

              <div className="mt-6 text-center text-sm">
                <span className="text-[#6c757d]">Already have an account? </span>
                <Link href="/login" className="text-[#3B82F6] hover:underline font-medium">
                  Sign in
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  )
}

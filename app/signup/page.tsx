"use client"

import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { SiteHeader } from "@/components/site-header"
import { LEGAL_POLICY_REVIEW_KEYS, LEGAL_POLICY_VERSIONS } from "@/lib/compliance-config"

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
  const [playerAge, setPlayerAge] = useState("")
  const [parentEmail, setParentEmail] = useState("")
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [acceptPrivacy, setAcceptPrivacy] = useState(false)
  const [acceptAcceptableUse, setAcceptAcceptableUse] = useState(false)
  const [acceptAiAcknowledgement, setAcceptAiAcknowledgement] = useState(false)
  const [confirmMinorConsent, setConfirmMinorConsent] = useState(false)

  const withErrorCode = (code: string, message: string) => `[${code}] ${message}`

  // Load from localStorage if available
  useEffect(() => {
    const saved = localStorage.getItem("signupData")
    if (saved) {
      const data = JSON.parse(saved)
      setRole(data.role || "")
      // Only set teamId if role is NOT head-coach
      if (data.role !== "head-coach") {
        setTeamId(data.teamId || "")
      }
      setFirstName(data.firstName || "")
      setLastName(data.lastName || "")
      setEmail(data.email || "")
      setPlayerAge(data.playerAge || "")
      setParentEmail(data.parentEmail || "")
      setAcceptTerms(Boolean(data?.compliance?.terms?.acceptedAt))
      setAcceptPrivacy(Boolean(data?.compliance?.privacy?.acceptedAt))
      setAcceptAcceptableUse(Boolean(data?.compliance?.acceptableUse?.acceptedAt))
      setAcceptAiAcknowledgement(Boolean(data?.compliance?.aiAcknowledgement?.acceptedAt))
      setConfirmMinorConsent(Boolean(data?.compliance?.minorParentalConsent?.acceptedAt))
    } else {
      // If no role selected, redirect to role selection
      router.push("/signup/role")
    }
  }, [router])

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

    // For non-Head-Coach roles, require Team Code
    if (role !== "head-coach" && !teamId) {
      setError(withErrorCode("SIGNUP-VALIDATION-004", "Team code is required for this role. Get the team code from your head coach."))
      return
    }

    const reviewedTerms = localStorage.getItem(LEGAL_POLICY_REVIEW_KEYS.terms)
    const reviewedPrivacy = localStorage.getItem(LEGAL_POLICY_REVIEW_KEYS.privacy)
    const reviewedAup = localStorage.getItem(LEGAL_POLICY_REVIEW_KEYS.acceptableUse)

    if (!acceptTerms || !reviewedTerms) {
      setError(withErrorCode("SIGNUP-COMPLIANCE-001", "Review and accept the Terms of Service before continuing."))
      return
    }
    if (!acceptPrivacy || !reviewedPrivacy) {
      setError(withErrorCode("SIGNUP-COMPLIANCE-002", "Review and accept the Privacy Policy before continuing."))
      return
    }
    if (!acceptAcceptableUse || !reviewedAup) {
      setError(withErrorCode("SIGNUP-COMPLIANCE-003", "Review and accept the Acceptable Use Policy before continuing."))
      return
    }
    if (!acceptAiAcknowledgement) {
      setError(withErrorCode("SIGNUP-COMPLIANCE-004", "You must acknowledge AI-assisted tools before continuing."))
      return
    }

    const isMinorPlayer = role === "player" && Number(playerAge) > 0 && Number(playerAge) < 18
    if (role === "player" && !playerAge) {
      setError(withErrorCode("SIGNUP-COMPLIANCE-005", "Player age is required for youth protection compliance."))
      return
    }
    if (isMinorPlayer && !confirmMinorConsent) {
      setError(withErrorCode("SIGNUP-COMPLIANCE-006", "Parental/guardian consent confirmation is required for minor players."))
      return
    }
    if (isMinorPlayer && !parentEmail.trim()) {
      setError(withErrorCode("SIGNUP-COMPLIANCE-007", "Parent/guardian email is required for minor verification."))
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
    signupData.playerAge = playerAge
    signupData.parentEmail = parentEmail
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
      minorParentalConsent: isMinorPlayer
        ? {
            version: LEGAL_POLICY_VERSIONS.privacy,
            acceptedAt: new Date().toISOString(),
            parentEmail: parentEmail.trim(),
            playerAge: Number(playerAge),
          }
        : null,
    }
    if (teamId) {
      signupData.teamId = teamId
    }
    localStorage.setItem("signupData", JSON.stringify(signupData))

    // Navigate based on role
    if (role === "head-coach") {
      router.push("/signup/program")
    } else {
      // For other roles, skip program/payment and go directly to account creation
      router.push("/signup/complete")
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <section className="relative min-h-screen flex items-center justify-center px-4 py-24 md:py-32">
        <div className="container mx-auto">
          <div className="w-full max-w-2xl mx-auto p-10 rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
            <div className="mb-8">
              <h2 className="text-3xl md:text-4xl font-athletic font-bold text-center mb-2 text-[#212529] uppercase tracking-tight">
                Sign up for Braik
              </h2>
              <p className="text-center text-[#495057]">
                {role === "head-coach" ? "Step 1 of 3" : "Personal Information"}
              </p>
            </div>

            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-xl font-athletic font-semibold text-[#212529] uppercase tracking-wide">Personal Information</h3>
                
                {role && role !== "head-coach" && (
                  <div className="space-y-2">
                    <Label htmlFor="teamId" className="text-sm font-medium text-[#495057]">
                      {role === "player" 
                        ? "Team Code *" 
                        : role === "parent" 
                        ? "Team Code *"
                        : "Team Code *"}
                    </Label>
                    <Input
                      id="teamId"
                      type="text"
                      value={teamId}
                      onChange={(e) => setTeamId(e.target.value.toUpperCase())}
                      className="bg-white text-[#212529] placeholder:text-[#6c757d] font-mono text-lg tracking-wider"
                      placeholder={
                        role === "player"
                          ? "Enter Team Code from your coach"
                          : role === "parent"
                          ? "Enter Team Code from your coach"
                          : "Enter Team Code from your Head Coach"
                      }
                      required
                      maxLength={8}
                    />
                    <p className="text-xs text-[#6c757d]">
                      {role === "player"
                        ? "Get your Team Code from your coach"
                        : role === "parent"
                        ? "Get your Team Code from your coach"
                        : "Get your Team Code from your Head Coach"}
                    </p>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-sm font-medium text-[#495057]">First Name *</Label>
                    <Input
                      id="firstName"
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="bg-white text-[#212529] placeholder:text-[#6c757d]"
                      placeholder="First name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-sm font-medium text-[#495057]">Last Name *</Label>
                    <Input
                      id="lastName"
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="bg-white text-[#212529] placeholder:text-[#6c757d]"
                      placeholder="Last name"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-[#495057]">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-white text-[#212529] placeholder:text-[#6c757d]"
                    placeholder="your.email@example.com"
                    required
                  />
                </div>

                {role === "player" && (
                  <div className="space-y-2">
                    <Label htmlFor="playerAge" className="text-sm font-medium text-[#495057]">Player Age *</Label>
                    <Input
                      id="playerAge"
                      type="number"
                      min={1}
                      max={99}
                      value={playerAge}
                      onChange={(e) => setPlayerAge(e.target.value)}
                      className="bg-white text-[#212529] placeholder:text-[#6c757d]"
                      placeholder="Enter player age"
                      required
                    />
                  </div>
                )}

                {role === "player" && Number(playerAge) > 0 && Number(playerAge) < 18 && (
                  <div className="space-y-2">
                    <Label htmlFor="parentEmail" className="text-sm font-medium text-[#495057]">Parent/Guardian Email *</Label>
                    <Input
                      id="parentEmail"
                      type="email"
                      value={parentEmail}
                      onChange={(e) => setParentEmail(e.target.value)}
                      className="bg-white text-[#212529] placeholder:text-[#6c757d]"
                      placeholder="parent.guardian@example.com"
                      required
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-[#495057]">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-white text-[#212529] placeholder:text-[#6c757d]"
                    placeholder="Enter password"
                    required
                  />
                  <p className="text-xs text-[#6c757d]">
                    Must be at least 8 characters with uppercase, lowercase, number, and special character
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-sm font-medium text-[#495057]">Confirm Password *</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="bg-white text-[#212529] placeholder:text-[#6c757d]"
                    placeholder="Confirm password"
                    required
                  />
                </div>
              </div>

              <div className="space-y-3 border-t border-[#E5E7EB] pt-4">
                <p className="text-sm font-medium text-[#212529]">Required Legal Acknowledgments</p>
                <label className="flex items-start gap-2 text-sm text-[#495057]">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                  />
                  <span>
                    I agree to the{" "}
                    <Link href="/terms" target="_blank" className="text-[#3B82F6] hover:underline">
                      Terms of Service
                    </Link>
                    .
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm text-[#495057]">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={acceptPrivacy}
                    onChange={(e) => setAcceptPrivacy(e.target.checked)}
                  />
                  <span>
                    I agree to the{" "}
                    <Link href="/privacy" target="_blank" className="text-[#3B82F6] hover:underline">
                      Privacy Policy
                    </Link>
                    .
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm text-[#495057]">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={acceptAcceptableUse}
                    onChange={(e) => setAcceptAcceptableUse(e.target.checked)}
                  />
                  <span>
                    I agree to the{" "}
                    <Link href="/acceptable-use" target="_blank" className="text-[#3B82F6] hover:underline">
                      Acceptable Use Policy
                    </Link>
                    .
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm text-[#495057]">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={acceptAiAcknowledgement}
                    onChange={(e) => setAcceptAiAcknowledgement(e.target.checked)}
                  />
                  <span>
                    I understand that Braik includes AI-powered tools and that AI-generated outputs must be reviewed before implementation.
                  </span>
                </label>
                {role === "player" && Number(playerAge) > 0 && Number(playerAge) < 18 && (
                  <label className="flex items-start gap-2 text-sm text-[#495057]">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={confirmMinorConsent}
                      onChange={(e) => setConfirmMinorConsent(e.target.checked)}
                    />
                    <span>
                      I confirm that parental or legal guardian consent has been obtained for this minor&apos;s participation.
                    </span>
                  </label>
                )}
                <p className="text-xs text-[#6c757d]">
                  Open each policy and scroll through it once to enable acceptance tracking.
                </p>
              </div>

              {/* Social Login Options */}
              <div className="space-y-4 border-t border-[#E5E7EB] pt-4">
                <p className="text-sm text-[#6c757d] text-center">Or sign up with</p>
                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 bg-white border-[#E5E7EB] text-[#212529] hover:bg-[#F9FAFB]"
                    onClick={() => {
                      setError(withErrorCode("SIGNUP-SOCIAL-001", "Google sign-in is not enabled yet for this environment."))
                    }}
                  >
                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Gmail
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1 bg-white border-[#E5E7EB] text-[#212529] hover:bg-[#F9FAFB]"
                    onClick={() => {
                      setError(withErrorCode("SIGNUP-SOCIAL-002", "Apple sign-in is not enabled yet for this environment."))
                    }}
                  >
                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.61 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                    </svg>
                    Apple
                  </Button>
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
                Login
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

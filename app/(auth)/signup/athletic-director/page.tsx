"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SiteHeader } from "@/components/marketing/site-header"
import Link from "next/link"
import { SmsConsentCheckbox } from "@/components/compliance/sms-consent-checkbox"

export default function AthleticDirectorSignupPage() {
  const router = useRouter()
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [schoolName, setSchoolName] = useState("")
  const [schoolType, setSchoolType] = useState("")
  const [mascot, setMascot] = useState("")
  const [city, setCity] = useState("")
  const [state, setState] = useState("")
  const [estimatedTeamCount, setEstimatedTeamCount] = useState<string>("")
  const [estimatedAthleteCount, setEstimatedAthleteCount] = useState<string>("")
  const [phone, setPhone] = useState("")
  const [smsOptIn, setSmsOptIn] = useState(false)
  const [website, setWebsite] = useState("")
  const [conferenceDistrict, setConferenceDistrict] = useState("")
  const [interestedInDemo, setInterestedInDemo] = useState(false)

  const validatePassword = (pwd: string) => {
    if (pwd.length < 8) return false
    if (!/[A-Z]/.test(pwd)) return false
    if (!/[a-z]/.test(pwd)) return false
    if (!/[0-9]/.test(pwd)) return false
    if (!/[^A-Za-z0-9]/.test(pwd)) return false
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!firstName?.trim() || !lastName?.trim() || !email?.trim() || !password || !schoolName?.trim() || !schoolType?.trim()) {
      setError("Please fill in all required fields: first name, last name, email, password, school name, and school type.")
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    if (!validatePassword(password)) {
      setError("Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.")
      return
    }

    if (phone.trim() && !smsOptIn) {
      setError(
        "You entered a mobile number — please agree to transactional SMS messages from Braik or clear the phone field."
      )
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/auth/signup-athletic-director", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim().toLowerCase(),
          password,
          schoolName: schoolName.trim(),
          schoolType: schoolType.trim(),
          mascot: mascot.trim() || undefined,
          city: city.trim() || undefined,
          state: state.trim() || undefined,
          estimatedTeamCount: estimatedTeamCount ? parseInt(estimatedTeamCount, 10) : undefined,
          estimatedAthleteCount: estimatedAthleteCount ? parseInt(estimatedAthleteCount, 10) : undefined,
          phone: phone.trim() || undefined,
          smsOptIn: phone.trim() ? smsOptIn : false,
          website: website.trim() || undefined,
          conferenceDistrict: conferenceDistrict.trim() || undefined,
          interestedInDemo: interestedInDemo || undefined,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? "Signup failed. Please try again.")
        return
      }

      router.push("/login?athletic_director=1")
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <SiteHeader />
      <section className="px-4 py-12 md:py-20 max-w-2xl mx-auto">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-[#6B7280] mb-1">
            Athletic Director / Department License
          </p>
          <h1 className="text-3xl md:text-4xl font-athletic font-bold text-[#212529] uppercase tracking-tight">
            Set up your athletic department
          </h1>
          <p className="text-[#495057] mt-2">
            Create your account and school to get started with Braik.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-[#212529]">Personal information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First name *</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last name *</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@school.edu"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password *</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone (optional)</Label>
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
                placeholder="+1 (555) 123-4567"
              />
              <p className="text-xs text-[#6B7280]">
                Transactional SMS only (team and account notices). Message frequency varies. Reply STOP to opt out.
              </p>
            </div>
            {phone.trim() ? (
              <SmsConsentCheckbox id="ad-signup-sms-consent" checked={smsOptIn} onChange={setSmsOptIn} />
            ) : null}
            <p className="text-sm text-[#495057]">
              By creating an account you agree to the{" "}
              <Link href="/terms" className="font-medium text-[#2563EB] hover:underline" target="_blank" rel="noopener noreferrer">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="font-medium text-[#2563EB] hover:underline" target="_blank" rel="noopener noreferrer">
                Privacy Policy
              </Link>
              .
            </p>
          </div>

          <div className="space-y-4 border-t border-[#E5E7EB] pt-8">
            <h2 className="text-lg font-semibold text-[#212529]">School information</h2>
            <div className="space-y-2">
              <Label htmlFor="schoolName">School name *</Label>
              <Input
                id="schoolName"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                placeholder="Lincoln High School"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="schoolType">School type *</Label>
              <select
                id="schoolType"
                value={schoolType}
                onChange={(e) => setSchoolType(e.target.value)}
                className="flex h-10 w-full rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#212529] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                required
              >
                <option value="">Select type</option>
                <option value="high_school">High School</option>
                <option value="middle_school">Middle School</option>
                <option value="college">College / University</option>
                <option value="youth">Youth / Club</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mascot">Mascot or nickname (optional)</Label>
              <Input
                id="mascot"
                value={mascot}
                onChange={(e) => setMascot(e.target.value)}
                placeholder="Eagles"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="State"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Website (optional)</Label>
              <Input
                id="website"
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="conferenceDistrict">Conference / district (optional)</Label>
              <Input
                id="conferenceDistrict"
                value={conferenceDistrict}
                onChange={(e) => setConferenceDistrict(e.target.value)}
                placeholder="Conference or district name"
              />
            </div>
          </div>

          <div className="space-y-4 border-t border-[#E5E7EB] pt-8">
            <h2 className="text-lg font-semibold text-[#212529]">Athletic department size</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="estimatedTeamCount">Number of teams</Label>
                <Input
                  id="estimatedTeamCount"
                  type="number"
                  min={1}
                  value={estimatedTeamCount}
                  onChange={(e) => setEstimatedTeamCount(e.target.value)}
                  placeholder="e.g. 12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="estimatedAthleteCount">Estimated athletes</Label>
                <Input
                  id="estimatedAthleteCount"
                  type="number"
                  min={0}
                  value={estimatedAthleteCount}
                  onChange={(e) => setEstimatedAthleteCount(e.target.value)}
                  placeholder="e.g. 400"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={interestedInDemo}
                onChange={(e) => setInterestedInDemo(e.target.checked)}
                className="rounded border-[#E5E7EB]"
              />
              <span className="text-sm text-[#495057]">I&apos;m interested in a demo</span>
            </label>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-[#3B82F6] hover:bg-[#2563EB] text-white"
            >
              {submitting ? "Creating account…" : "Create account"}
            </Button>
            <Link href="/signup/role" className="flex-1">
              <Button type="button" variant="outline" className="w-full" disabled={submitting}>
                Back
              </Button>
            </Link>
          </div>
        </form>

        <p className="text-center text-sm text-[#6c757d] mt-8">
          Already have an account?{" "}
          <Link href="/login" className="text-[#3B82F6] hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </section>
    </div>
  )
}

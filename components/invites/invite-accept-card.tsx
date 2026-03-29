"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { signIn, useSession } from "@/lib/auth/client-auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"

export type InviteDetails = {
  id: string
  token: string
  email: string
  role: string
  team: { id: string; name: string; sport: string | null }
  schoolName: string | null
  inviterName: string | null
  expiresAt: string
}

interface InviteAcceptCardProps {
  invite: InviteDetails
  onAcceptSuccess?: () => void
}

function roleLabel(role: string): string {
  const r = role?.toLowerCase().replace(/-/g, " ")
  if (r === "head_coach") return "Head Coach"
  return r || "Member"
}

export function InviteAcceptCard({ invite, onAcceptSuccess }: InviteAcceptCardProps) {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [step, setStep] = useState<"signup" | "login" | "accept">("signup")

  const inviteEmailLower = invite.email.trim().toLowerCase()
  const sessionEmailLower = session?.user?.email?.trim().toLowerCase()
  const isSignedInMatching = status === "authenticated" && sessionEmailLower === inviteEmailLower

  useEffect(() => {
    if (isSignedInMatching) setStep("accept")
  }, [isSignedInMatching])
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSignupAndAccept = async () => {
    if (!name.trim()) {
      setError("Name is required.")
      return
    }
    if (!password || password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/auth/signup-with-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: invite.token,
          name: name.trim(),
          password,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? "Sign up failed.")
        return
      }
      if (onAcceptSuccess) onAcceptSuccess()
      router.push("/login?invite_accepted=1")
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleLoginAndAccept = async () => {
    if (!password) {
      setError("Password is required.")
      return
    }
    setLoading(true)
    setError("")
    try {
      const loginResult = await signIn("credentials", {
        email: invite.email,
        password,
        redirect: false,
      })
      if (!loginResult.ok) {
        setError(loginResult.error ?? "Sign in failed.")
        return
      }
      const acceptRes = await fetch(`/api/invites/${invite.id}/accept`, {
        method: "POST",
        credentials: "include",
      })
      const acceptData = await acceptRes.json().catch(() => ({}))
      if (!acceptRes.ok) {
        setError(acceptData.error ?? "Failed to accept invitation.")
        return
      }
      if (onAcceptSuccess) onAcceptSuccess()
      router.push("/dashboard")
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleAcceptOnly = async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/invites/${invite.id}/accept`, {
        method: "POST",
        credentials: "include",
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? "Failed to accept invitation.")
        return
      }
      if (onAcceptSuccess) onAcceptSuccess()
      router.push("/dashboard")
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const expiresDate = (() => {
    try {
      return new Date(invite.expiresAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    } catch {
      return ""
    }
  })()

  return (
    <div className="w-full max-w-md rounded-xl border border-[#E5E7EB] bg-white shadow-sm overflow-hidden">
      <div className="p-6 border-b border-[#E5E7EB]">
        <h2 className="text-lg font-bold text-[#212529]">You&apos;re invited</h2>
        <p className="mt-1 text-sm text-[#6B7280]">
          Join as <strong>{roleLabel(invite.role)}</strong>
        </p>
        <dl className="mt-4 space-y-2 text-sm">
          {invite.schoolName && (
            <>
              <dt className="font-medium text-[#6B7280]">School</dt>
              <dd className="text-[#212529]">{invite.schoolName}</dd>
            </>
          )}
          <dt className="font-medium text-[#6B7280]">Team</dt>
          <dd className="text-[#212529]">{invite.team.name}</dd>
          {invite.team.sport && (
            <>
              <dt className="font-medium text-[#6B7280]">Sport</dt>
              <dd className="text-[#212529]">{invite.team.sport}</dd>
            </>
          )}
          {invite.inviterName && (
            <>
              <dt className="font-medium text-[#6B7280]">Invited by</dt>
              <dd className="text-[#212529]">{invite.inviterName}</dd>
            </>
          )}
          <dt className="font-medium text-[#6B7280]">Email</dt>
          <dd className="text-[#212529]">{invite.email}</dd>
          {expiresDate && (
            <>
              <dt className="font-medium text-[#6B7280]">Invitation expires</dt>
              <dd className="text-[#212529]">{expiresDate}</dd>
            </>
          )}
        </dl>
      </div>
      <div className="p-6 space-y-4">
        <p className="text-xs text-[#6B7280] leading-relaxed">
          By joining Braik you agree to the{" "}
          <Link href="/terms" className="font-medium text-[#3B82F6] hover:underline" target="_blank" rel="noopener noreferrer">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="font-medium text-[#3B82F6] hover:underline" target="_blank" rel="noopener noreferrer">
            Privacy Policy
          </Link>
          . If you add a mobile number later in your profile, transactional SMS requires a separate opt-in with carrier-compliant
          consent language.
        </p>
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        )}

        {step === "accept" ? (
          <>
            <p className="text-sm text-[#6B7280]">
              You&apos;re signed in as <strong>{invite.email}</strong>. Accept to join this team.
            </p>
            <Button
              onClick={handleAcceptOnly}
              disabled={loading}
              className="w-full bg-[#3B82F6] hover:bg-[#2563EB]"
            >
              {loading ? "Accepting…" : "Accept invitation"}
            </Button>
          </>
        ) : step === "signup" ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                minLength={8}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
              />
            </div>
            <Button
              onClick={handleSignupAndAccept}
              disabled={loading}
              className="w-full bg-[#3B82F6] hover:bg-[#2563EB]"
            >
              {loading ? "Creating account…" : "Create account & join team"}
            </Button>
            <p className="text-sm text-[#6B7280] text-center">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setStep("login")}
                className="font-medium text-[#3B82F6] hover:underline"
              >
                Sign in
              </button>
            </p>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
              />
            </div>
            <Button
              onClick={handleLoginAndAccept}
              disabled={loading}
              className="w-full bg-[#3B82F6] hover:bg-[#2563EB]"
            >
              {loading ? "Signing in…" : "Sign in & join team"}
            </Button>
            <p className="text-sm text-[#6B7280] text-center">
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => setStep("signup")}
                className="font-medium text-[#3B82F6] hover:underline"
              >
                Sign up
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  )
}

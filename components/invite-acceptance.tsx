"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { signIn } from "next-auth/react"

interface Invite {
  id: string
  email: string
  role: string
  team: {
    id: string
    name: string
    organization: {
      name: string
    }
  }
}

export function InviteAcceptance({ invite }: { invite: Invite }) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [step, setStep] = useState<"signup" | "login">("signup")

  const handleAccept = async () => {
    if (step === "signup") {
      if (!name || !password || !confirmPassword) {
        setError("All fields are required")
        return
      }

      if (password !== confirmPassword) {
        setError("Passwords do not match")
        return
      }

      if (password.length < 8) {
        setError("Password must be at least 8 characters")
        return
      }

      setLoading(true)
      setError("")

      try {
        // Create account
        const signupResponse = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            email: invite.email,
            password,
          }),
        })

        if (!signupResponse.ok) {
          const data = await signupResponse.json()
          throw new Error(data.error || "Failed to create account")
        }

        // Accept invite
        const acceptResponse = await fetch(`/api/invites/${invite.id}/accept`, {
          method: "POST",
        })

        if (!acceptResponse.ok) {
          throw new Error("Failed to accept invite")
        }

        // Auto login
        const loginResult = await signIn("credentials", {
          email: invite.email,
          password,
          redirect: false,
        })

        if (loginResult?.error) {
          router.push("/login")
        } else {
          router.push("/dashboard")
        }
      } catch (err: any) {
        setError(err.message || "An error occurred")
      } finally {
        setLoading(false)
      }
    } else {
      // Login flow
      if (!password) {
        setError("Password is required")
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

        if (loginResult?.error) {
          setError("Invalid password")
          return
        }

        // Accept invite
        const acceptResponse = await fetch(`/api/invites/${invite.id}/accept`, {
          method: "POST",
        })

        if (!acceptResponse.ok) {
          throw new Error("Failed to accept invite")
        }

        router.push("/dashboard")
      } catch (err: any) {
        setError(err.message || "An error occurred")
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>You're Invited!</CardTitle>
          <CardDescription>
            Join {invite.team.organization.name} - {invite.team.name} as {invite.role.replace("_", " ")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-surface-2 rounded-lg border border-border">
              <p className="text-sm text-text">
                <strong>Email:</strong> {invite.email}
              </p>
            </div>

            {step === "signup" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
                <p className="text-sm text-text-2">
                  Already have an account?{" "}
                  <button
                    onClick={() => setStep("login")}
                    className="text-primary hover:underline"
                  >
                    Login instead
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
                    required
                  />
                </div>
                <p className="text-sm text-text-2">
                  Don't have an account?{" "}
                  <button
                    onClick={() => setStep("signup")}
                    className="text-primary hover:underline"
                  >
                    Sign up instead
                  </button>
                </p>
              </>
            )}

            {error && <div className="text-sm text-danger">{error}</div>}

            <Button onClick={handleAccept} className="w-full" disabled={loading}>
              {loading ? "Processing..." : step === "signup" ? "Create Account & Join Team" : "Login & Join Team"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

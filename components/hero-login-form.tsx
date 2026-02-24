"use client"

import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function HeroLoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const getDetailedLoginError = (code?: string) => {
    if (!code) {
      return "[AUTH-UNKNOWN] Sign-in failed without an error code. This can happen if the auth response was interrupted. Please retry."
    }

    switch (code) {
      case "CredentialsSignin":
        return "[AUTH-CREDENTIALS-401] The email/password combination does not match an active account."
      case "Configuration":
        return "[AUTH-CONFIG-500] Server auth configuration is invalid or missing. Please contact support."
      case "AccessDenied":
        return "[AUTH-ACCESS-403] Your account does not have permission to sign in."
      default:
        return `[AUTH-${code}] Sign-in failed. Source code: ${code}.`
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const result = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
      })

      if (result?.error) {
        setError(getDetailedLoginError(result.error))
      } else if (result?.ok) {
        router.push("/dashboard")
        router.refresh()
      } else {
        setError("[AUTH-NO-RESULT] Sign-in returned no success or error flag. Please retry.")
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error"
      console.error("Login exception:", err)
      if (errorMessage.includes("Database") || errorMessage.includes("connection")) {
        setError(`[AUTH-DB-500] Database connection failed during sign-in. Details: ${errorMessage}`)
      } else if (errorMessage.includes("fetch")) {
        setError(`[AUTH-NETWORK-0] Network request failed before server response. Details: ${errorMessage}`)
      } else {
        setError(`[AUTH-UNEXPECTED-500] Unexpected sign-in exception. Details: ${errorMessage}`)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md bg-white rounded-2xl border border-[#E5E7EB] p-8 shadow-sm">
      <h2 className="text-xl font-athletic font-semibold mb-6 text-[#212529] uppercase tracking-wide text-center">
        Login
      </h2>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="hero-email" className="text-sm font-medium text-[#495057]">
            Email
          </Label>
          <Input
            id="hero-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="Enter your email"
            className="bg-white"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="hero-password" className="text-sm font-medium text-[#495057]">
            Password
          </Label>
          <Input
            id="hero-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Enter your password"
            className="bg-white"
          />
        </div>
        {error && (
          <div
            className="text-sm text-white bg-[#EF4444] border border-[#EF4444] rounded-lg p-3 font-medium"
            role="alert"
            aria-live="polite"
          >
            {error}
          </div>
        )}
        <Button type="submit" className="w-full font-athletic uppercase tracking-wide" disabled={loading} size="lg">
          {loading ? "Logging in..." : "Login"}
        </Button>
      </form>
    </div>
  )
}

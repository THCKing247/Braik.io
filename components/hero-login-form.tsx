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

      console.log("Sign in result:", result)

      if (result?.error) {
        console.error("Sign in error:", result.error)
        if (result.error === "CredentialsSignin") {
          setError("Invalid email or password. Please try again.")
        } else if (result.error === "Configuration") {
          setError("Server configuration error. Please contact support.")
        } else {
          setError(result.error || "Login failed. Please try again.")
        }
      } else if (result?.ok) {
        // Small delay to ensure session is set
        setTimeout(() => {
          window.location.href = "/dashboard"
        }, 100)
      } else {
        console.error("Unexpected result:", result)
        setError("Login failed. Please try again.")
      }
    } catch (err: any) {
      console.error("Login exception:", err)
      if (err?.message?.includes("Database") || err?.message?.includes("connection")) {
        setError("Database connection failed. Please ensure PostgreSQL is running.")
      } else if (err?.message?.includes("fetch")) {
        setError("Network error. Please check your connection and try again.")
      } else {
        setError(`An error occurred: ${err?.message || "Unknown error"}`)
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
          <div className="text-sm text-white bg-[#EF4444] border border-[#EF4444] rounded-lg p-3 font-medium">
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

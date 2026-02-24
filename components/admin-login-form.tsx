"use client"

import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function AdminLoginForm() {
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
        adminLogin: "true",
        redirect: false,
      })

      if (result?.error || !result?.ok) {
        setError("Admin sign in failed. This login is restricted to Platform Owner accounts.")
        return
      }

      router.push("/dashboard/admin")
      router.refresh()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error"
      console.error("Admin login exception:", err)
      setError(`Unable to sign in right now. ${message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md bg-white rounded-2xl border border-[#E5E7EB] p-8 shadow-sm">
      <h2 className="text-xl font-athletic font-semibold mb-2 text-[#212529] uppercase tracking-wide text-center">
        Admin Login
      </h2>
      <p className="text-sm text-[#6B7280] text-center mb-6">
        Platform Owner support and development access
      </p>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="admin-email" className="text-sm font-medium text-[#495057]">
            Email
          </Label>
          <Input
            id="admin-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="Enter admin email"
            className="bg-white"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="admin-password" className="text-sm font-medium text-[#495057]">
            Password
          </Label>
          <Input
            id="admin-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Enter admin password"
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
          {loading ? "Logging in..." : "Admin Login"}
        </Button>
      </form>
    </div>
  )
}


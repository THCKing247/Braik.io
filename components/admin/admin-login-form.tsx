"use client"

import { signIn } from "@/lib/auth/client-auth"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { authTimingClient } from "@/lib/auth/login-flow-timing"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff, Shield } from "lucide-react"
import { cn } from "@/lib/utils"
import { adminUi } from "@/lib/admin/admin-ui"

const ADMIN_CALLBACK_URL = "/admin/dashboard"

function getDetailedLoginError(code?: string) {
  if (!code) {
    return "Sign-in failed without an error code. Please retry."
  }
  switch (code) {
    case "CredentialsSignin":
      return "Invalid email or password."
    case "Configuration":
      return "Server auth is not configured. Please contact support."
    case "AccessDenied":
      return "This account does not have admin access."
    default:
      return `Sign-in failed: ${code}. Please retry.`
  }
}

export function AdminLoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
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
        callbackUrl: ADMIN_CALLBACK_URL,
      })

      if (result?.error) {
        setError(getDetailedLoginError(result.error))
      } else if (result?.ok) {
        const destination = result.url ?? ADMIN_CALLBACK_URL
        authTimingClient("admin_login_client_navigate_start", { destination })
        router.replace(destination)
        return
      } else {
        setError("Sign-in returned no result. Please retry.")
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error"
      setError(msg.includes("fetch") ? "Network error. Please retry." : `Error: ${msg}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className={cn(
        adminUi.panel,
        "w-full p-8 shadow-2xl shadow-black/40 backdrop-blur-md"
      )}
    >
      <div className="mb-6 flex items-center justify-center gap-2 text-orange-400">
        <Shield className="h-6 w-6" aria-hidden />
        <h2 className="font-athletic text-xl font-bold uppercase tracking-wide text-white">Admin portal</h2>
      </div>
      <p className="mb-6 text-center text-sm text-slate-400">Sign in with your platform owner or admin account</p>
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="admin-email" className="text-sm font-medium text-slate-300">
            Email
          </Label>
          <Input
            id="admin-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="admin@example.com"
            className="border-white/15 bg-[#060a12]/90 text-slate-100 placeholder:text-slate-500 focus-visible:border-orange-500/50 focus-visible:ring-orange-500/30"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="admin-password" className="text-sm font-medium text-slate-300">
            Password
          </Label>
          <div className="relative">
            <Input
              id="admin-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="border-white/15 bg-[#060a12]/90 pr-10 text-slate-100 placeholder:text-slate-500 focus-visible:border-orange-500/50 focus-visible:ring-orange-500/30"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-white/50 hover:text-white/80"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        {error && (
          <div
            className="rounded-lg border border-red-500/50 bg-red-500/20 px-3 py-2 text-sm text-red-200"
            role="alert"
          >
            {error}
          </div>
        )}
        <Button
          type="submit"
          className="w-full bg-orange-500 font-semibold text-white hover:bg-orange-400 focus-visible:ring-orange-500/50"
          disabled={loading}
          size="lg"
        >
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <p className="mt-5 text-center text-xs text-slate-500">
        Not an admin?{" "}
        <a href="/login" className={cn(adminUi.link, "text-xs")}>
          Go to main sign in
        </a>
      </p>
    </div>
  )
}

export default AdminLoginForm

"use client"

import { signIn } from "@/lib/auth/client-auth"
import { useRouter, useSearchParams } from "next/navigation"
import { authTimingClient } from "@/lib/auth/login-flow-timing"
import { useId, useState } from "react"
import { isWaitlistMode } from "@/lib/config/waitlist-mode"
import { getPublicJoinHref } from "@/lib/marketing/join-cta"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Eye, EyeOff } from "lucide-react"

type HeroLoginFormProps = {
  /** `app` = premium mobile/tablet shell (dark page, light card). */
  variant?: "default" | "entry" | "app"
}

const REMEMBER_APP_STORAGE_KEY = "braik_remember_session_app"

function readAppRememberDefault(): boolean {
  if (typeof window === "undefined") return true
  try {
    const v = window.localStorage.getItem(REMEMBER_APP_STORAGE_KEY)
    if (v === "0") return false
    if (v === "1") return true
    return true
  } catch {
    return true
  }
}

export function HeroLoginForm({ variant = "default" }: HeroLoginFormProps) {
  const uid = useId()
  const emailId = `${uid}-email`
  const passwordId = `${uid}-password`
  const rememberId = `${uid}-remember`
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(() =>
    variant === "app" ? readAppRememberDefault() : false
  )
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const normalizeCallbackUrl = (value: string | null) => {
    if (!value || !value.startsWith("/")) {
      return undefined
    }
    if (value === "/admin/login") {
      return "/admin/dashboard"
    }
    return value
  }

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

  const getFriendlyLoginError = (code?: string) => {
    if (!code) {
      return "Something went wrong. Please try again."
    }
    switch (code) {
      case "CredentialsSignin":
        return "That email or password doesn’t look right. Try again or reset your password."
      case "Configuration":
        return "Sign-in isn’t available right now. Please try again in a few minutes."
      case "AccessDenied":
        return "Your account can’t sign in here. Contact your program admin if you need help."
      default:
        return "We couldn’t sign you in. Please try again."
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const callbackUrl = normalizeCallbackUrl(searchParams.get("callbackUrl"))

      const result = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
        callbackUrl,
        rememberMe,
      })

      if (result?.error) {
        console.error("Login failed", {
          code: result.error,
          status: result.status,
          ok: result.ok,
          callbackUrl,
        })
        setError(
          variant === "app" ? getFriendlyLoginError(result.error) : getDetailedLoginError(result.error)
        )
      } else if (result?.ok) {
        const destination = callbackUrl ?? result.url ?? "/dashboard"
        authTimingClient("login_client_navigate_start", { destination })
        router.replace(destination)
        return
      } else {
        console.error("Login returned no explicit success/error", { result })
        setError(
          variant === "app"
            ? getFriendlyLoginError(undefined)
            : "[AUTH-NO-RESULT] Sign-in returned no success or error flag. Please retry."
        )
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error"
      console.error("Login exception:", err)
      if (variant === "app") {
        if (errorMessage.includes("fetch")) {
          setError("Check your connection and try again.")
        } else {
          setError("Something went wrong. Please try again.")
        }
      } else if (errorMessage.includes("Database") || errorMessage.includes("connection")) {
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

  const isEntry = variant === "entry"
  const isApp = variant === "app"

  const cardClass = isApp
    ? "w-full rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xl shadow-slate-900/[0.12] ring-1 ring-slate-900/[0.05] sm:p-8"
    : `w-full rounded-2xl border border-[#E5E7EB] bg-white shadow-sm ${isEntry ? "p-6 sm:p-7" : "p-8"}`

  const emailInputClass = isApp
    ? "min-h-[48px] rounded-xl border-slate-200 bg-white text-base"
    : "min-h-[44px] bg-white text-base sm:text-sm"

  const passwordInputClass = isApp
    ? "min-h-[48px] rounded-xl border-slate-200 bg-white text-base pr-12"
    : "min-h-[44px] bg-white pr-10 text-base sm:text-sm"

  return (
    <div className={cardClass}>
      {!isEntry && !isApp && (
        <h2 className="mb-6 text-center text-xl font-athletic font-semibold uppercase tracking-wide text-[#212529]">
          Sign In
        </h2>
      )}
      <form onSubmit={handleSubmit} className={isApp ? "space-y-6" : "space-y-5"}>
        <div className="space-y-2">
          <Label
            htmlFor={emailId}
            className={isApp ? "text-sm font-semibold text-[#374151]" : "text-sm font-medium text-[#495057]"}
          >
            Email
          </Label>
          <Input
            id={emailId}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            autoFocus={isApp}
            placeholder={isApp ? "you@school.edu" : "Enter your email"}
            className={emailInputClass}
          />
        </div>
        <div className="space-y-2">
          <Label
            htmlFor={passwordId}
            className={isApp ? "text-sm font-semibold text-[#374151]" : "text-sm font-medium text-[#495057]"}
          >
            Password
          </Label>
          <div className="relative">
            <Input
              id={passwordId}
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder={isApp ? "••••••••" : "Enter your password"}
              className={passwordInputClass}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className={`absolute inset-y-0 right-0 flex min-w-[44px] items-center justify-center rounded-r-xl text-[#6B7280] hover:text-[#212529] ${isApp ? "px-3" : "px-3"}`}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
        <div className={`flex items-center ${isApp ? "gap-3 py-1" : "space-x-2"}`}>
          <Checkbox
            id={rememberId}
            checked={rememberMe}
            onCheckedChange={(checked) => {
              const next = checked as boolean
              setRememberMe(next)
              if (variant === "app" && typeof window !== "undefined") {
                try {
                  window.localStorage.setItem(REMEMBER_APP_STORAGE_KEY, next ? "1" : "0")
                } catch {
                  /* ignore */
                }
              }
            }}
            className={
              isApp
                ? "h-5 w-5 rounded-md border-slate-300 text-blue-600"
                : "h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            }
          />
          <Label
            htmlFor={rememberId}
            className={`cursor-pointer font-medium text-[#374151] ${isApp ? "text-sm leading-snug" : "text-sm text-[#495057]"}`}
          >
            {isApp ? "Keep me signed in" : "Remember me"}
          </Label>
        </div>
        {error && (
          <div
            className={`rounded-xl border p-3.5 text-sm font-medium leading-relaxed ${
              isApp
                ? "border-red-200/80 bg-red-50 text-red-900"
                : "border-[#EF4444] bg-[#EF4444] text-white"
            }`}
            role="alert"
            aria-live="polite"
          >
            {error}
          </div>
        )}
        <Button
          type="submit"
          variant="signIn"
          className={`w-full font-athletic uppercase tracking-wide ${isApp ? "min-h-[52px] rounded-2xl text-base shadow-md shadow-blue-900/20" : "min-h-[48px]"}`}
          disabled={loading}
          size="lg"
        >
          {loading ? "Signing in…" : isApp ? "Sign in" : "Login"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className={`mt-3 w-full font-athletic uppercase tracking-wide ${isApp ? "min-h-[52px] rounded-2xl text-base" : "min-h-[48px]"}`}
          size="lg"
          onClick={() => router.push(getPublicJoinHref())}
          aria-label={isWaitlistMode() ? "Join the waitlist" : "Sign up"}
        >
          {isWaitlistMode() ? "Join the waitlist" : "Sign Up"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className={`mt-3 w-full font-athletic uppercase tracking-wide ${isApp ? "min-h-[52px] rounded-2xl text-base" : "min-h-[48px]"}`}
          size="lg"
          onClick={() => router.push("/enter-player-code")}
          aria-label={"Enter your child's player code"}
        >
          Enter your child&apos;s player code
        </Button>
      </form>
    </div>
  )
}

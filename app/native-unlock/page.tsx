"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Fingerprint, KeyRound } from "lucide-react"
import { useSession, signIn, signOut } from "@/lib/auth/client-auth"
import { getResumeOrDefaultAppPath } from "@/lib/navigation/last-visited-route"
import { promptBiometricUnlock } from "@/lib/auth/native-biometric-bridge"
import { isNativeAppSync } from "@/lib/native/app-environment"
import { getNativeBiometricUnlockEnabled } from "@/lib/native/native-biometric-prefs"
import { markNativeBiometricUnlockedThisLaunch } from "@/lib/native/native-unlock-session"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Phase = "biometric" | "password"

export default function NativeUnlockPage() {
  const router = useRouter()
  const { status, data } = useSession()
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>("biometric")
  const [password, setPassword] = useState("")
  const [passwordError, setPasswordError] = useState<string | null>(null)

  useEffect(() => {
    if (!isNativeAppSync()) {
      router.replace("/")
    }
  }, [router])

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login")
    }
  }, [status, router])

  useEffect(() => {
    if (status !== "authenticated" || !data?.user) return
    void (async () => {
      const bio = await getNativeBiometricUnlockEnabled()
      if (!bio) {
        markNativeBiometricUnlockedThisLaunch()
        router.replace(getResumeOrDefaultAppPath(data.user.role))
      }
    })()
  }, [status, data, router])

  const goDashboard = () => {
    if (!data?.user) return
    markNativeBiometricUnlockedThisLaunch()
    router.replace(getResumeOrDefaultAppPath(data.user.role))
  }

  const onUnlockBiometric = async () => {
    setBusy(true)
    setHint(null)
    try {
      const result = await promptBiometricUnlock("app_launch")
      if (result.ok) {
        goDashboard()
        return
      }
      setPhase("password")
      setPasswordError(null)
      if (result.cancelled) {
        setHint("Biometric cancelled — enter your password to continue.")
      } else {
        setHint("Biometrics unavailable — enter your password to continue.")
      }
    } finally {
      setBusy(false)
    }
  }

  const onPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!data?.user?.email) return
    setPasswordError(null)
    setBusy(true)
    try {
      const result = await signIn("credentials", {
        email: data.user.email,
        password,
        redirect: false,
        rememberMe: true,
      })
      if (result?.ok) {
        setPassword("")
        goDashboard()
        return
      }
      setPasswordError("That password doesn’t match this account. Try again or sign out.")
    } finally {
      setBusy(false)
    }
  }

  const onSignOutCompletely = async () => {
    setBusy(true)
    try {
      await signOut({ callbackUrl: "/login" })
    } finally {
      setBusy(false)
    }
  }

  if (status === "loading" || status === "unauthenticated") {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#0B1220]">
        <div className="h-10 w-10 animate-pulse rounded-full bg-white/10" />
      </div>
    )
  }

  return (
    <div
      className="relative flex min-h-[100dvh] flex-col bg-[#0B1220] px-6 py-10"
      style={{
        paddingTop: "max(2.5rem, env(safe-area-inset-top))",
        paddingBottom: "max(2rem, env(safe-area-inset-bottom))",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 120% 70% at 50% -15%, rgba(59,130,246,0.28), transparent 50%), linear-gradient(180deg, #0f172a 0%, #0B1220 100%)",
        }}
        aria-hidden
      />
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-center space-y-10">
        <div className="flex flex-col items-center space-y-3 text-center">
          <div className="flex h-12 w-[168px] items-center justify-center">
            <img
              src="/braik-logo.png"
              alt="Braik"
              className="h-auto w-full max-h-11 object-contain brightness-0 invert"
            />
          </div>
          {phase === "biometric" ? (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
                <Fingerprint className="h-8 w-8 text-sky-400" aria-hidden />
              </div>
              <h1 className="font-athletic text-2xl font-bold uppercase tracking-tight text-white">
                Unlock Braik
              </h1>
              <p className="text-sm leading-relaxed text-slate-400">
                Your session is still active. Use biometrics to open the app, or verify with your password.
              </p>
            </>
          ) : (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
                <KeyRound className="h-8 w-8 text-sky-400" aria-hidden />
              </div>
              <h1 className="font-athletic text-2xl font-bold uppercase tracking-tight text-white">
                Sign in to continue
              </h1>
              <p className="text-sm leading-relaxed text-slate-400">
                Enter your password for <span className="font-medium text-slate-200">{data?.user?.email}</span>{" "}
                to unlock this session.
              </p>
            </>
          )}
        </div>

        {hint && (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-100">
            {hint}
          </p>
        )}

        {phase === "biometric" && (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => void onUnlockBiometric()}
              className="min-h-[52px] w-full rounded-2xl bg-sky-500 px-4 text-base font-semibold uppercase tracking-wide text-white shadow-lg shadow-sky-900/30 transition-colors hover:bg-sky-400 disabled:opacity-60"
            >
              {busy ? "Please wait…" : "Unlock with biometrics"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setHint(null)
                setPhase("password")
                setPasswordError(null)
              }}
              className="min-h-[48px] w-full rounded-2xl border border-white/20 bg-white/5 px-4 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/10 disabled:opacity-60"
            >
              Use password instead
            </button>
          </div>
        )}

        {phase === "password" && (
          <form onSubmit={(e) => void onPasswordSubmit(e)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="unlock-email" className="text-slate-300">
                Email
              </Label>
              <Input
                id="unlock-email"
                type="email"
                value={data?.user?.email ?? ""}
                readOnly
                disabled
                className="min-h-[48px] border-white/20 bg-white/10 text-slate-200"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unlock-password" className="text-slate-300">
                Password
              </Label>
              <Input
                id="unlock-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="min-h-[48px] border-white/20 bg-white/10 text-white placeholder:text-slate-500"
                placeholder="••••••••"
                required
              />
            </div>
            {passwordError && (
              <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-center text-sm text-red-100">
                {passwordError}
              </p>
            )}
            <Button
              type="submit"
              disabled={busy}
              className="min-h-[52px] w-full rounded-2xl text-base font-semibold uppercase tracking-wide"
            >
              {busy ? "Verifying…" : "Unlock with password"}
            </Button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setPhase("biometric")
                setHint(null)
                setPasswordError(null)
                setPassword("")
              }}
              className="min-h-[48px] w-full rounded-2xl border border-white/20 bg-transparent px-4 text-sm font-semibold text-sky-300 transition-colors hover:bg-white/5 disabled:opacity-60"
            >
              Try biometrics again
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void onSignOutCompletely()}
              className="w-full text-center text-xs font-medium text-slate-500 underline-offset-4 hover:text-slate-400 hover:underline"
            >
              Sign out completely
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

"use client"

import Link from "next/link"
import { Suspense } from "react"
import { HeroLoginForm } from "@/components/marketing/hero-login-form"

function FormFallback() {
  return (
    <div
      className="w-full rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-900/5 ring-1 ring-slate-900/[0.04] sm:p-8"
      aria-hidden
    >
      <div className="space-y-4">
        <div className="h-12 w-full animate-pulse rounded-xl bg-slate-100" />
        <div className="h-12 w-full animate-pulse rounded-xl bg-slate-100" />
        <div className="h-12 w-full animate-pulse rounded-xl bg-slate-100" />
      </div>
    </div>
  )
}

/** Branded loading state aligned with the app login shell (session check or redirect). */
export function MobileAppEntryLoading({ message = "Loading…" }: { message?: string }) {
  return (
    <div className="flex min-h-[100dvh] flex-col overflow-x-hidden bg-[#0B1220]">
      <div
        className="pointer-events-none absolute inset-0 opacity-90"
        style={{
          background:
            "radial-gradient(ellipse 120% 80% at 50% -20%, rgba(59,130,246,0.22), transparent 55%), radial-gradient(ellipse 90% 60% at 100% 100%, rgba(15,23,42,0.9), #0B1220)",
        }}
        aria-hidden
      />
      <header className="relative z-10 flex shrink-0 flex-col items-center px-6 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4">
        <div className="flex h-11 w-[148px] items-center justify-center">
          <img
            src="/braik-logo.png"
            alt="Braik"
            className="h-auto w-full max-h-10 object-contain brightness-0 invert"
          />
        </div>
        <p className="mt-2 text-center text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400">
          Team workspace
        </p>
      </header>
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-11 w-11 animate-pulse rounded-full bg-white/10" />
          <p className="text-sm font-medium text-slate-400">{message}</p>
        </div>
      </main>
    </div>
  )
}

/**
 * Premium sign-in-first layout for phone & tablet (&lt; lg).
 * Reuses HeroLoginForm (same API/auth); presentation only.
 */
export function MobileAppLoginScreen() {
  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-x-hidden bg-[#0B1220]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 120% 70% at 50% -15%, rgba(59,130,246,0.28), transparent 50%), radial-gradient(ellipse 100% 55% at 100% 0%, rgba(30,64,175,0.15), transparent 45%), linear-gradient(180deg, #0f172a 0%, #0B1220 45%, #060a12 100%)",
        }}
        aria-hidden
      />

      <header className="relative z-10 flex shrink-0 flex-col items-center px-6 pt-[max(1.25rem,env(safe-area-inset-top))] pb-2">
        <div className="flex h-11 w-[160px] items-center justify-center">
          <img
            src="/braik-logo.png"
            alt="Braik"
            className="h-auto w-full max-h-10 object-contain brightness-0 invert"
          />
        </div>
        <p className="mt-2 text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
          Team workspace
        </p>
      </header>

      <main className="relative z-10 flex flex-1 flex-col justify-center px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 sm:px-6">
        <div className="mx-auto w-full max-w-md space-y-8">
          <div className="space-y-2 text-center">
            <h1 className="font-athletic text-3xl font-bold uppercase tracking-tight text-white sm:text-[2rem]">
              Welcome back
            </h1>
            <p className="text-base leading-relaxed text-slate-400">
              Sign in to your team workspace
            </p>
          </div>

          <Suspense fallback={<FormFallback />}>
            <HeroLoginForm variant="app" />
          </Suspense>

          <div className="space-y-5 text-center">
            <Link
              href="/forgot-password"
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-sm font-medium text-sky-400 transition-colors hover:text-sky-300"
            >
              Forgot password?
            </Link>

            <div className="border-t border-white/10 pt-5">
              <p className="text-sm text-slate-400">
                New to Braik?{" "}
                <Link
                  href="/signup/role"
                  className="font-semibold text-sky-400 transition-colors hover:text-sky-300"
                >
                  Create an account
                </Link>
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Coaches &amp; programs — request access to get started.
              </p>
            </div>

            <Link
              href="/admin/login"
              className="inline-flex min-h-[48px] w-full max-w-xs items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-5 text-sm font-semibold text-slate-200 backdrop-blur-sm transition-colors hover:border-white/25 hover:bg-white/10"
            >
              Staff admin sign-in
            </Link>
          </div>
        </div>
      </main>

      <footer className="relative z-10 shrink-0 px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
        <div className="mx-auto max-w-md text-center">
          <Link
            href="/faq"
            className="inline-flex min-h-[44px] items-center justify-center text-xs font-medium text-slate-400 transition-colors hover:text-slate-300"
          >
            Help &amp; FAQ
          </Link>
        </div>
      </footer>
    </div>
  )
}

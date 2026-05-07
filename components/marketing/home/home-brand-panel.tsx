"use client"

import { cn } from "@/lib/utils"
import { DiagonalStreaks } from "@/components/marketing/diagonal-streaks"

export type HomeBrandPanelVariant = "program-tiers" | "role-ecosystem" | "demo-walkthrough" | "faq-support"

const tierBase =
  "rounded-xl border border-white/20 bg-white/[0.12] px-5 py-4 shadow-lg shadow-slate-900/20 backdrop-blur-md"

export function HomeBrandPanel({
  variant,
  className,
}: {
  variant: HomeBrandPanelVariant
  className?: string
}) {
  if (variant === "program-tiers") {
    return (
      <div
        className={cn(
          "relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-slate-200/90 bg-gradient-to-br from-slate-50 via-white to-blue-50/80 shadow-md",
          className
        )}
      >
        <DiagonalStreaks className="opacity-80" />
        <div className="relative z-[1] flex h-full flex-col justify-center gap-4 p-6 md:p-8">
          <p className="text-center text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Program structure</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className={cn(tierBase, "border-blue-200/50 bg-gradient-to-br from-blue-600/90 to-blue-800/95 text-slate-50")}>
              <p className="font-athletic text-lg font-bold tracking-tight">Varsity</p>
              <p className="mt-1 text-sm leading-snug text-blue-100/95">Program oversight, roster authority, full visibility</p>
            </div>
            <div className={cn(tierBase, "border-slate-200/60 bg-white/90 text-slate-800")}>
              <p className="font-athletic text-lg font-bold tracking-tight text-slate-900">JV</p>
              <p className="mt-1 text-sm leading-snug text-slate-600">Team-scoped dashboards and communication</p>
            </div>
          </div>
          <p className="text-center text-xs font-medium text-slate-500">One Braik program — clear boundaries</p>
        </div>
      </div>
    )
  }

  if (variant === "role-ecosystem") {
    const roles = ["Head Coach", "Assistant", "Player", "Parent"] as const
    return (
      <div
        className={cn(
          "relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-slate-200/90 bg-gradient-to-b from-white via-slate-50/90 to-blue-50/50 shadow-md",
          className
        )}
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(37,99,235,0.08),transparent_65%)]" aria-hidden />
        <div className="relative z-[1] flex h-full flex-col items-center justify-center gap-4 p-6 md:p-8">
          <p className="text-center text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Who sees what</p>
          <div className="grid w-full max-w-sm grid-cols-2 gap-3">
            {roles.map((label) => (
              <div
                key={label}
                className="rounded-lg border border-slate-200/80 bg-white/95 px-4 py-3 text-center shadow-sm"
              >
                <span className="text-sm font-semibold text-slate-800">{label}</span>
              </div>
            ))}
          </div>
          <p className="max-w-xs text-center text-xs leading-relaxed text-slate-600">
            Scoped experiences — each role gets the right surfaces, not the whole stack.
          </p>
        </div>
      </div>
    )
  }

  if (variant === "demo-walkthrough") {
    return (
      <div
        className={cn(
          "relative aspect-video w-full overflow-hidden rounded-xl border border-slate-200/90 bg-gradient-to-br from-[#0f172a] via-[#1e3a5f] to-[#2563eb] shadow-lg shadow-slate-900/25",
          className
        )}
      >
        <div
          className="absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_70%_20%,rgba(96,165,250,0.25),transparent_55%)]"
          aria-hidden
        />
        <div className="relative z-[1] flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
          <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-100">
            Braik
          </span>
          <p className="font-athletic text-2xl font-bold tracking-tight text-white md:text-3xl">Program walkthrough</p>
          <p className="max-w-sm text-sm leading-relaxed text-blue-100/90">
            Tailored tour of scheduling, comms, payments, and staff workflows for your level.
          </p>
          <div className="mt-2 flex gap-2" aria-hidden>
            <span className="h-1.5 w-8 rounded-full bg-white/35" />
            <span className="h-1.5 w-8 rounded-full bg-white/20" />
            <span className="h-1.5 w-8 rounded-full bg-white/20" />
          </div>
        </div>
      </div>
    )
  }

  /* faq-support */
  return (
    <div
      className={cn(
        "relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-slate-200/90 bg-gradient-to-br from-white via-blue-50/40 to-slate-100/80 shadow-md",
        className
      )}
    >
      <div
        className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-blue-500/10 blur-2xl"
        aria-hidden
      />
      <div className="relative z-[1] flex h-full flex-col items-center justify-center gap-4 p-8">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-2xl border border-blue-200/60 bg-white shadow-inner shadow-blue-500/10"
          aria-hidden
        >
          <svg viewBox="0 0 32 32" className="h-10 w-10 text-blue-600" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 10h16M8 16h10M8 22h12"
            />
            <rect x="4" y="4" width="24" height="24" rx="4" className="opacity-40" />
          </svg>
        </div>
        <div className="text-center">
          <p className="font-athletic text-lg font-bold text-slate-900 md:text-xl">Answers in one place</p>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-slate-600">
            Pricing, setup, access, and program questions — organized for quick scanning.
          </p>
        </div>
      </div>
    </div>
  )
}

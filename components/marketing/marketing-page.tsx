import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { marketingSectionShell } from "@/components/marketing/marketing-layout"

/** Re-export for pages that only import marketing primitives from one module. */
export { marketingSectionShell } from "@/components/marketing/marketing-layout"

/** Vertical rhythm aligned with /pricing and /why-braik */
export const marketingSectionPadding = "py-14 md:py-20"

/** Hero top section — matches reference marketing heroes */
export const marketingHeroPadding = "pt-16 pb-10 md:pt-24 md:pb-14"

export const marketingBodyClass = "text-base md:text-lg text-[#212529]/80 leading-relaxed"
export const marketingBodySecondaryClass = "text-sm md:text-base text-[#212529]/75 leading-relaxed"
export const marketingMutedClass = "text-sm text-[#64748B]"

/** Standard page title (h1) — light background */
export const marketingPageTitleClass =
  "text-4xl md:text-5xl lg:text-6xl font-athletic font-bold text-[#212529] uppercase tracking-tight mb-6"

/** Section title (h2) — centered marketing sections */
export const marketingSectionTitleClass =
  "text-2xl md:text-3xl lg:text-4xl font-athletic font-bold text-[#212529] uppercase tracking-tight mb-3"

export function MarketingHeroBlobs({ className }: { className?: string }) {
  return (
    <div className={cn("absolute inset-0 pointer-events-none", className)} aria-hidden>
      <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-[#3B82F6]/10 blur-3xl" />
      <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-[#60A5FA]/10 blur-3xl" />
    </div>
  )
}

const sectionVariants = {
  white: "bg-white",
  muted: "bg-[#F9FAFB]",
  gradient: "bg-gradient-to-b from-[#F8FAFC]/80 to-white",
  dark: "bg-[#0F172A] text-white",
} as const

export function MarketingPageSection({
  id,
  variant = "white",
  children,
  className,
}: {
  id?: string
  variant?: keyof typeof sectionVariants
  children: ReactNode
  className?: string
}) {
  return (
    <section id={id} className={cn("relative scroll-mt-24", sectionVariants[variant], marketingSectionPadding, className)}>
      {children}
    </section>
  )
}

/** Full-bleed gradient hero shell (blobs + optional extra classes) */
export function MarketingHeroShell({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "relative overflow-hidden bg-gradient-to-b from-[#F8FAFC] via-white to-white",
        marketingHeroPadding,
        className
      )}
    >
      <MarketingHeroBlobs />
      {children}
    </section>
  )
}

type MarketingHeroProps = {
  title: string
  subtitle?: string
  strip?: readonly string[]
  className?: string
  innerClassName?: string
}

export function MarketingHero({ title, subtitle, strip, className, innerClassName }: MarketingHeroProps) {
  return (
    <MarketingHeroShell className={className}>
      <div className={cn(marketingSectionShell, "text-center max-w-3xl", innerClassName)}>
        <h1 className={marketingPageTitleClass}>{title}</h1>
        {subtitle ? <p className={cn(marketingBodyClass, "text-[#212529]/85")}>{subtitle}</p> : null}
        {strip && strip.length > 0 ? (
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 border-y border-slate-200/80 py-6 text-sm md:text-base font-medium text-[#334155]">
            {strip.map((label) => (
              <span key={label} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#3B82F6]" aria-hidden />
                {label}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </MarketingHeroShell>
  )
}

/** Constrained content column — use inside MarketingPageSection */
export function MarketingContentContainer({
  children,
  maxWidth = "3xl",
  className,
}: {
  children: ReactNode
  maxWidth?: "3xl" | "4xl" | "5xl" | "6xl" | "7xl"
  className?: string
}) {
  const mw = {
    "3xl": "max-w-3xl",
    "4xl": "max-w-4xl",
    "5xl": "max-w-5xl",
    "6xl": "max-w-6xl",
    "7xl": "max-w-7xl",
  }[maxWidth]
  return <div className={cn(mw, "mx-auto w-full", className)}>{children}</div>
}

/** Inner shell with marketing container + horizontal padding */
export function MarketingShell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn(marketingSectionShell, className)}>{children}</div>
}

/**
 * Long-form policy body on dark surface — replaces ad-hoc rgba(28,28,28) cards.
 * Keeps left accent bar and readable prose for legal content.
 */
export function MarketingLegalDocument({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "relative max-w-4xl mx-auto overflow-hidden rounded-2xl border border-white/10 bg-neutral-900 p-8 md:p-10 text-[#E5E7EB] shadow-md",
        "space-y-6 leading-relaxed",
        "[&_a]:text-[#93C5FD] [&_a]:underline [&_a:hover]:text-white",
        "[&_h2]:text-xl [&_h2]:font-athletic [&_h2]:font-semibold [&_h2]:uppercase [&_h2]:tracking-wide [&_h2]:text-[#3B82F6]",
        "[&_ul]:list-disc [&_ul]:list-inside [&_ul]:space-y-1",
        className
      )}
    >
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#3B82F6]" aria-hidden />
      <div className="relative space-y-6 pl-0">{children}</div>
    </div>
  )
}

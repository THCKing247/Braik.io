import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

/** Matches pricing and other marketing landing pages: container + horizontal padding + stacking context. */
export const marketingSectionShell = "container mx-auto px-4 relative z-10"

export function SectionHeading({
  eyebrow,
  title,
  description,
  className,
}: {
  eyebrow?: string
  title: string
  description?: string
  className?: string
}) {
  return (
    <div className={cn("max-w-3xl mb-10 md:mb-12", className)}>
      {eyebrow ? (
        <p className="text-sm font-semibold uppercase tracking-wider text-[#3B82F6] mb-2">{eyebrow}</p>
      ) : null}
      <h2 className="mb-3 font-athletic text-2xl font-bold uppercase tracking-tight text-gray-900 md:text-3xl lg:text-4xl">
        {title}
      </h2>
      {description ? <p className="text-base leading-relaxed text-gray-800 md:text-lg">{description}</p> : null}
    </div>
  )
}

/** White marketing card shell — same visual language as pricing tier cards. */
export function MarketingCard({
  title,
  children,
  badge,
  footerNote,
  subtitle,
  className,
  variant = "light",
}: {
  title: string
  children: ReactNode
  badge?: string
  footerNote?: string
  subtitle?: string
  className?: string
  /** `dark` = glass panel on navy/blue gradient sections (landing). */
  variant?: "light" | "dark"
}) {
  const isDark = variant === "dark"
  return (
    <div
      className={cn(
        "relative rounded-xl border p-6 md:p-8 transition-all duration-300",
        isDark
          ? [
              "border-white/15 bg-white/[0.06] backdrop-blur-md shadow-xl shadow-black/25",
              "hover:border-blue-400/25 hover:bg-white/[0.09] hover:shadow-2xl hover:shadow-blue-950/40 hover:-translate-y-0.5",
            ]
          : [
              "border-slate-200/90 bg-white shadow-sm",
              "hover:shadow-lg hover:border-[#3B82F6]/35 hover:-translate-y-0.5",
            ],
        badge && "pt-8 md:pt-9",
        className
      )}
    >
      {badge ? (
        <span className="absolute -top-3 left-6 inline-flex items-center rounded-full bg-[#3B82F6] px-3 py-1 text-xs font-bold uppercase tracking-wide text-white shadow-sm">
          {badge}
        </span>
      ) : null}
      <h3
        className={cn(
          "font-athletic text-lg font-semibold uppercase tracking-wide md:text-xl pr-2",
          subtitle ? "mb-2" : "mb-4",
          isDark ? "text-white" : "text-slate-900"
        )}
      >
        {title}
      </h3>
      {subtitle ? (
        <p className={cn("mb-6 text-2xl font-bold md:text-3xl", isDark ? "text-white" : "text-slate-900")}>{subtitle}</p>
      ) : null}
      <div
        className={cn(
          "space-y-4 text-base leading-relaxed",
          isDark ? "text-slate-100" : "text-slate-700"
        )}
      >
        {children}
      </div>
      {footerNote ? (
        <p className={cn("mt-4 text-xs leading-relaxed", isDark ? "text-slate-400" : "text-slate-600")}>{footerNote}</p>
      ) : null}
    </div>
  )
}

export function PriceCard({
  title,
  price,
  children,
  className,
  badge,
  footerNote,
}: {
  title: string
  price: string
  children: ReactNode
  className?: string
  badge?: string
  footerNote?: string
}) {
  return (
    <MarketingCard title={title} subtitle={price} badge={badge} footerNote={footerNote} className={className}>
      {children}
    </MarketingCard>
  )
}

export function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span className="text-[#3B82F6] font-bold shrink-0" aria-hidden>
            ✓
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

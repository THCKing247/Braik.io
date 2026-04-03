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
      <h2 className="text-2xl md:text-3xl lg:text-4xl font-athletic font-bold text-[#212529] uppercase tracking-tight mb-3">
        {title}
      </h2>
      {description ? <p className="text-base md:text-lg text-[#212529]/80 leading-relaxed">{description}</p> : null}
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
}: {
  title: string
  children: ReactNode
  badge?: string
  footerNote?: string
  subtitle?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "relative rounded-2xl border border-slate-200/90 bg-white p-6 md:p-8 shadow-sm transition-all duration-200",
        "hover:shadow-md hover:border-[#3B82F6]/30",
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
          "text-lg md:text-xl font-athletic font-semibold text-[#212529] uppercase tracking-wide pr-2",
          subtitle ? "mb-2" : "mb-4"
        )}
      >
        {title}
      </h3>
      {subtitle ? <p className="text-2xl md:text-3xl font-bold text-[#0F172A] mb-6">{subtitle}</p> : null}
      <div className="text-[#212529]/85 space-y-4 text-sm md:text-base leading-relaxed">{children}</div>
      {footerNote ? <p className="mt-4 text-xs text-[#64748B] leading-relaxed">{footerNote}</p> : null}
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

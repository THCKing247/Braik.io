import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { landingLightSection } from "@/lib/marketing/landing-visual-theme"

type PageCTAProps = {
  children: ReactNode
  className?: string
  id?: string
}

/** Full-width light band for marketing CTAs — add `landingContainerSplit` inside when needed. */
export function PageCTA({ children, className, id }: PageCTAProps) {
  return (
    <section
      id={id}
      className={cn(
        landingLightSection,
        "scroll-mt-24 [&_h2]:!text-slate-900 [&_h3]:!text-slate-900 [&_p]:text-slate-700",
        className
      )}
    >
      {children}
    </section>
  )
}

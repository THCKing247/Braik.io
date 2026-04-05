"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ScrollReveal } from "@/components/marketing/scroll-reveal"
import { ImagePlaceholder } from "@/components/marketing/image-placeholder"
import { SectionSplit } from "@/components/marketing/section-split"
import { PageCTA } from "@/components/marketing/page-cta"
import { landingContainerSplit } from "@/lib/marketing/landing-visual-theme"

export type FAQLinkCTAProps = {
  id?: string
  imagePosition?: "left" | "right"
  className?: string
}

export function FAQLinkCTA({ id = "faq-cta", imagePosition = "right", className }: FAQLinkCTAProps) {
  const copy = (
    <div className="min-w-0 space-y-6 text-slate-700 [&_h2]:!text-slate-900 [&_p]:text-slate-700">
      <h2 className="normal-case font-athletic text-2xl font-bold tracking-tight !text-slate-900 md:text-4xl">
        Have questions?
      </h2>
      <p className="text-base leading-relaxed text-slate-700 md:text-lg">
        Find answers about pricing, setup, access, and more on our FAQ page.
      </p>
      <Button
        asChild
        size="lg"
        className="bg-[#2563EB] font-semibold text-white shadow-md hover:bg-[#1d4ed8]"
      >
        <Link href="/faq">View FAQ</Link>
      </Button>
    </div>
  )

  const visual = (
    <div className="min-w-0">
      <ImagePlaceholder aspect="4/3" />
    </div>
  )

  return (
    <PageCTA id={id} className={className}>
      <div className={landingContainerSplit}>
        <ScrollReveal>
          <SectionSplit>
            {imagePosition === "right" ? (
              <>
                <div className="min-w-0">{copy}</div>
                <div className="min-w-0">{visual}</div>
              </>
            ) : (
              <>
                <div className="order-2 min-w-0 md:order-1">{visual}</div>
                <div className="order-1 min-w-0 md:order-2">{copy}</div>
              </>
            )}
          </SectionSplit>
        </ScrollReveal>
      </div>
    </PageCTA>
  )
}

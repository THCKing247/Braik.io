import Image from "next/image"
import { ScrollReveal } from "@/components/marketing/scroll-reveal"
import { SectionSplit } from "@/components/marketing/section-split"
import { landingOneSystemPanel } from "@/lib/marketing/landing-images"
import { landingContainerSplit, landingLightSection } from "@/lib/marketing/landing-visual-theme"
import { lightSectionBody, lightSectionColumn, lightSectionH2, lightSectionLead } from "./home-theme"

export function HomeOneSystemSection() {
  return (
    <section className={landingLightSection}>
      <div className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-slate-50/80 to-white" aria-hidden />
      <div className={landingContainerSplit}>
        <ScrollReveal>
          <SectionSplit>
            <div className="order-2 flex min-w-0 justify-center md:order-1 md:justify-start">
              <div className="w-full max-w-4xl">
                <Image
                  src={landingOneSystemPanel.src}
                  alt="Football field — Braik supports your program"
                  width={landingOneSystemPanel.width}
                  height={landingOneSystemPanel.height}
                  sizes="(max-width: 896px) 100vw, 896px"
                  quality={85}
                  loading="lazy"
                  className="h-auto w-full scale-105 object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.15)] md:scale-110"
                />
              </div>
            </div>
            <div className={`order-1 min-w-0 space-y-8 md:order-2 ${lightSectionColumn}`}>
              <h2 className={lightSectionH2}>One system. Less stress.</h2>
              <div className="space-y-6 pt-2">
                <p className={lightSectionLead}>
                  Most coaches don&apos;t need more apps. They need fewer responsibilities pulling them away from what
                  matters.
                </p>
                <p className={lightSectionBody}>
                  Instead of juggling spreadsheets, group texts, payment platforms, and document folders, Braik brings
                  everything into one system—designed around the head coach&apos;s workflow.
                </p>
                <p className={lightSectionBody}>
                  Braik steps in as a unified system and support layer, helping programs operate smoothly while allowing
                  coaches to focus on coaching.
                </p>
              </div>
            </div>
          </SectionSplit>
        </ScrollReveal>
      </div>
    </section>
  )
}

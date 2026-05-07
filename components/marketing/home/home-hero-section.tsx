import Image from "next/image"
import { ScrollReveal } from "@/components/marketing/scroll-reveal"
import { landingFogFieldHero } from "@/lib/marketing/landing-images"
import { landingContainerWide } from "@/lib/marketing/landing-visual-theme"
import { HomeHeroCtaRow } from "./home-hero-cta-row"
import { HomeHeroHeadlines } from "./home-hero-headlines"
import { HomeHeroSignInNote } from "./home-hero-sign-in-note"

export function HomeHeroSection() {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden text-slate-100">
      <div className="absolute inset-0 scale-[1.03] md:scale-105" aria-hidden>
        <div className="relative h-full w-full">
          <Image
            src={landingFogFieldHero.src}
            alt=""
            fill
            priority
            sizes="100vw"
            quality={80}
            className="object-cover object-center"
          />
        </div>
      </div>
      <div
        className="absolute inset-0 bg-gradient-to-b from-black/80 via-slate-950/70 to-[#0a1628]/92"
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-gradient-to-tr from-blue-600/25 via-transparent to-blue-900/10"
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_120%_85%_at_50%_100%,rgba(15,23,42,0.92),transparent_55%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[85%] max-w-4xl -translate-x-1/2 rounded-full bg-blue-500/20 blur-[80px]"
        aria-hidden
      />
      <div className={`${landingContainerWide} flex flex-1 flex-col justify-center py-20 md:py-28 lg:py-32`}>
        <div className="mx-auto max-w-4xl space-y-12 text-center">
          <ScrollReveal>
            <HomeHeroHeadlines />
          </ScrollReveal>
          <ScrollReveal delay={100}>
            <HomeHeroCtaRow />
          </ScrollReveal>
          <ScrollReveal delay={200}>
            <HomeHeroSignInNote />
          </ScrollReveal>
        </div>
      </div>
    </section>
  )
}

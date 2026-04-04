import type { CSSProperties } from "react"
import { cn } from "@/lib/utils"

type ParticleSpec = {
  className: string
  style: CSSProperties
}

const PARTICLES: ParticleSpec[] = [
  {
    className:
      "h-[6px] w-[6px] animate-landing-particle-drift-a bg-[rgba(255,106,0,0.18)] blur-[6px] [animation-delay:0s] [animation-duration:14s]",
    style: { left: "7%", top: "18%" },
  },
  {
    className:
      "h-3 w-3 animate-landing-particle-drift-b bg-[rgba(90,140,255,0.12)] blur-[8px] [animation-delay:1.2s] [animation-duration:18s]",
    style: { left: "78%", top: "28%" },
  },
  {
    className:
      "h-[10px] w-[10px] animate-landing-particle-drift-c bg-[rgba(255,106,0,0.16)] blur-[10px] [animation-delay:2.4s] [animation-duration:11s]",
    style: { left: "22%", top: "62%" },
  },
  {
    className:
      "h-1.5 w-1.5 animate-landing-particle-drift-a bg-[rgba(90,140,255,0.14)] blur-[4px] [animation-delay:0.5s] [animation-duration:16s]",
    style: { left: "88%", top: "55%" },
  },
  {
    className:
      "h-[14px] w-[14px] animate-landing-particle-drift-b bg-[rgba(255,106,0,0.12)] blur-[10px] [animation-delay:3s] [animation-duration:12s]",
    style: { left: "45%", top: "12%" },
  },
  {
    className:
      "h-2 w-2 animate-landing-particle-drift-c bg-[rgba(90,140,255,0.1)] blur-[6px] [animation-delay:1.8s] [animation-duration:15s] max-xl:hidden",
    style: { left: "92%", top: "72%" },
  },
  {
    className:
      "h-[7px] w-[7px] animate-landing-particle-drift-a bg-[rgba(255,106,0,0.15)] blur-[7px] [animation-delay:4.2s] [animation-duration:17s] max-xl:hidden",
    style: { left: "14%", top: "42%" },
  },
  {
    className:
      "h-2.5 w-2.5 animate-landing-particle-drift-b bg-[rgba(90,140,255,0.11)] blur-[5px] [animation-delay:2s] [animation-duration:13s] max-2xl:hidden",
    style: { left: "58%", top: "78%" },
  },
]

/**
 * Subtle HUD scan line + sparse floating particles (hero only).
 * z-index kept below content (`z-10`); `pointer-events: none` throughout.
 */
export function LandingHeroAtmosphere({ className }: { className?: string }) {
  return (
    <div
      className={cn("pointer-events-none absolute inset-0 z-[5] overflow-hidden", className)}
      aria-hidden
    >
      <div className="absolute inset-0">
        {PARTICLES.map((p, i) => (
          <span
            key={i}
            className={cn("landing-hero-particle absolute rounded-full will-change-transform", p.className)}
            style={p.style}
          />
        ))}
      </div>
      <div className="landing-hero-scan">
        <div className="landing-hero-scan__bar" />
      </div>
    </div>
  )
}

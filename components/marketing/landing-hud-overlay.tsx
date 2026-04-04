import { cn } from "@/lib/utils"

/**
 * Subtle HUD / playbook-style grid — orange + faint blue, low opacity.
 * Sits above darkened backgrounds, below text (parent should use relative + content z-10).
 */
export function LandingHudOverlay({ className }: { className?: string }) {
  return (
    <div
      className={cn("pointer-events-none absolute inset-0", className)}
      style={{
        backgroundImage: [
          "repeating-linear-gradient(45deg, rgba(255,106,0,0.07) 0px, rgba(255,106,0,0.07) 1px, transparent 1px, transparent 40px)",
          "repeating-linear-gradient(-35deg, rgba(96,165,250,0.05) 0px, rgba(96,165,250,0.05) 1px, transparent 1px, transparent 52px)",
          "repeating-linear-gradient(90deg, rgba(255,106,0,0.03) 0px, rgba(255,106,0,0.03) 1px, transparent 1px, transparent 64px)",
        ].join(","),
      }}
      aria-hidden
    />
  )
}

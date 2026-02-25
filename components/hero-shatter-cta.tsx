"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

interface HeroShatterCtaProps {
  className?: string
  size?: "default" | "sm" | "lg" | "icon"
  label?: string
}

type Shard = {
  x: number
  y: number
  w: number
  h: number
  vx: number
  vy: number
  rot: number
  vrot: number
  alpha: number
}

const ANIMATION_MS = 520

export function HeroShatterCta({
  className = "",
  size = "lg",
  label = "Braik into your season",
}: HeroShatterCtaProps) {
  const router = useRouter()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  const [useMobileFallback, setUseMobileFallback] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const updateMedia = () => {
      setUseMobileFallback(window.matchMedia("(max-width: 768px)").matches)
      setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    }

    updateMedia()
    window.addEventListener("resize", updateMedia)

    return () => {
      window.removeEventListener("resize", updateMedia)
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  const navigateToSignup = () => {
    router.push("/signup/role?fromHero=1")
  }

  const runDesktopShatter = () => {
    const wrapper = wrapperRef.current
    const canvas = canvasRef.current
    if (!wrapper || !canvas) {
      navigateToSignup()
      return
    }

    const rect = wrapper.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.max(1, Math.floor(rect.width * dpr))
    canvas.height = Math.max(1, Math.floor(rect.height * dpr))
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`

    const ctx = canvas.getContext("2d")
    if (!ctx) {
      navigateToSignup()
      return
    }

    const shards: Shard[] = []
    const count = 24
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() * 0.35 - 0.175)
      const speed = 2 + Math.random() * 3.5
      shards.push({
        x: rect.width * 0.5 + (Math.random() * 10 - 5),
        y: rect.height * 0.5 + (Math.random() * 8 - 4),
        w: 8 + Math.random() * 18,
        h: 4 + Math.random() * 10,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.8,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 0.35,
        alpha: 0.95,
      })
    }

    const start = performance.now()
    const gravity = 0.18
    const friction = 0.985

    const frame = (now: number) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / ANIMATION_MS, 1)

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, rect.width, rect.height)

      for (const shard of shards) {
        shard.vx *= friction
        shard.vy = shard.vy * friction + gravity
        shard.x += shard.vx
        shard.y += shard.vy
        shard.rot += shard.vrot
        shard.alpha = 1 - progress

        ctx.save()
        ctx.translate(shard.x, shard.y)
        ctx.rotate(shard.rot)
        ctx.globalAlpha = Math.max(0, shard.alpha)
        ctx.fillStyle = "rgba(255,255,255,0.9)"
        ctx.fillRect(-shard.w / 2, -shard.h / 2, shard.w, shard.h)
        ctx.restore()
      }

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(frame)
      } else {
        navigateToSignup()
      }
    }

    rafRef.current = requestAnimationFrame(frame)
  }

  const handleClick = () => {
    if (isAnimating) return
    setIsAnimating(true)

    if (reducedMotion) {
      setTimeout(navigateToSignup, 160)
      return
    }

    if (useMobileFallback) {
      setTimeout(navigateToSignup, 380)
      return
    }

    runDesktopShatter()
  }

  return (
    <div
      ref={wrapperRef}
      className={`relative inline-flex w-full sm:w-auto justify-center ${isAnimating && useMobileFallback ? "scale-[0.96]" : "scale-100"} transition-transform duration-300`}
    >
      <Button
        size={size}
        className={`${className} ${isAnimating ? "opacity-0" : "opacity-100"} transition-opacity duration-150`}
        onClick={handleClick}
        disabled={isAnimating}
      >
        {label}
      </Button>

      <canvas
        ref={canvasRef}
        className={`absolute inset-0 pointer-events-none ${isAnimating && !useMobileFallback ? "opacity-100" : "opacity-0"} transition-opacity duration-100`}
      />

      <div
        className={`absolute inset-0 pointer-events-none rounded-md border border-white/30 bg-white/10 ${
          isAnimating && useMobileFallback ? "-translate-x-[38%] -rotate-6 opacity-0" : "translate-x-0 rotate-0 opacity-0"
        } transition-all duration-300`}
      />
      <div
        className={`absolute inset-0 pointer-events-none rounded-md border border-white/30 bg-white/10 ${
          isAnimating && useMobileFallback ? "translate-x-[38%] rotate-6 opacity-0" : "translate-x-0 rotate-0 opacity-0"
        } transition-all duration-300`}
      />
    </div>
  )
}

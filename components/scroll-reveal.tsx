"use client"

import { useEffect, useRef, useState, ReactNode } from "react"

interface ScrollRevealProps {
  children: ReactNode
  delay?: number
  className?: string
}

export function ScrollReveal({ children, delay = 0, className = "" }: ScrollRevealProps) {
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setTimeout(() => {
              setIsVisible(true)
            }, delay)
            observer.disconnect()
          }
        })
      },
      { threshold: 0.05, rootMargin: "0px 0px -50px 0px" }
    )

    observer.observe(el)

    // If already in view on mount (e.g. hero at top), show immediately after a tick
    const raf = requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect()
      const inView = rect.top < (window.innerHeight ?? 0) * 0.9
      if (inView) {
        setTimeout(() => setIsVisible(true), delay)
        observer.disconnect()
      }
    })

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [delay])

  return (
    <div
      ref={ref}
      className={`transition-all duration-300 ease-out ${
        isVisible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-4"
      } ${className}`}
    >
      {children}
    </div>
  )
}

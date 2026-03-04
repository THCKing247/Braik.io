"use client"

import { useEffect, useMemo, useState } from "react"

interface LegalReadTrackerProps {
  storageKey: string
  policyVersion: string
}

export function LegalReadTracker({ storageKey, policyVersion }: LegalReadTrackerProps) {
  const [isEligible, setIsEligible] = useState(false)
  const [isComplete, setIsComplete] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      const scrollTop = window.scrollY
      const viewportHeight = window.innerHeight
      const docHeight = document.documentElement.scrollHeight
      const progress = (scrollTop + viewportHeight) / Math.max(docHeight, 1)
      if (progress >= 0.92) {
        setIsEligible(true)
      }
    }

    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    const existing = localStorage.getItem(storageKey)
    if (existing) {
      setIsComplete(true)
    }
  }, [storageKey])

  const helperText = useMemo(() => {
    if (isComplete) return "Policy marked as reviewed for this version."
    if (isEligible) return "You can now mark this policy as reviewed."
    return "Scroll near the bottom of this policy to enable review."
  }, [isComplete, isEligible])

  const markReviewed = () => {
    const payload = {
      policyVersion,
      reviewedAt: new Date().toISOString(),
    }
    localStorage.setItem(storageKey, JSON.stringify(payload))
    setIsComplete(true)
  }

  return (
    <div className="mt-8 border-t border-white/20 pt-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <button
          type="button"
          disabled={!isEligible || isComplete}
          onClick={markReviewed}
          className="rounded-md bg-[#3B82F6] px-4 py-2 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#2563EB]"
        >
          {isComplete ? "Reviewed" : "Mark as reviewed"}
        </button>
        <p className="text-sm text-white/80">{helperText}</p>
      </div>
    </div>
  )
}

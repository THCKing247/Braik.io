"use client"

import { useEffect, useState } from "react"
import { coachBRotatingInsight, coachBRotatingSubtitle } from "@/lib/braik-ai/coach-b-tips"

const DEFAULT_MS = 14_000

export function useCoachBRotatingCopy(intervalMs = DEFAULT_MS) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => {
      setTick((t) => t + 1)
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])

  return {
    subtitle: coachBRotatingSubtitle(tick),
    insight: coachBRotatingInsight(tick),
    tick,
  }
}

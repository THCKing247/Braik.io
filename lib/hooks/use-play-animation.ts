"use client"

import { useState, useCallback, useRef, useEffect } from "react"

/** Duration in ms for a full play at 1x speed. */
const BASE_DURATION_MS = 4000

export const SPEED_OPTIONS = [0.5, 1, 1.5, 2] as const
export type PlaybackSpeed = (typeof SPEED_OPTIONS)[number]

export type PlayAnimationState = "idle" | "playing" | "paused" | "ended"

export function usePlayAnimation() {
  const [progress, setProgress] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeedState] = useState<PlaybackSpeed>(1)
  const rafRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number>(0)

  const restart = useCallback(() => {
    setProgress(0)
    lastTimeRef.current = 0
    setIsPlaying(true)
  }, [])

  const play = useCallback(() => {
    if (progress >= 1) {
      setProgress(0)
      lastTimeRef.current = 0
    }
    setIsPlaying(true)
  }, [progress])

  const pause = useCallback(() => {
    setIsPlaying(false)
  }, [])

  const setSpeed = useCallback((s: PlaybackSpeed) => {
    setSpeedState(s)
  }, [])

  const stepToStart = useCallback(() => {
    setIsPlaying(false)
    setProgress(0)
    lastTimeRef.current = 0
  }, [])

  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      return
    }

    const durationMs = BASE_DURATION_MS / speed

    const tick = (now: number) => {
      if (lastTimeRef.current === 0) lastTimeRef.current = now
      const delta = now - lastTimeRef.current
      lastTimeRef.current = now

      setProgress((prev) => {
        const next = Math.min(1, prev + (delta / durationMs))
        if (next >= 1) {
          setIsPlaying(false)
          lastTimeRef.current = 0
        }
        return next
      })
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [isPlaying, speed])

  const state: PlayAnimationState =
    progress >= 1 ? "ended" : isPlaying ? "playing" : progress > 0 ? "paused" : "idle"

  return {
    progress,
    isPlaying,
    speed,
    state,
    play,
    pause,
    restart,
    setSpeed,
    stepToStart,
  }
}

"use client"

import { useEffect, useState } from "react"

/** Tailwind `lg` breakpoint (1024px). */
export function useIsLgUp(): boolean {
  const [lg, setLg] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)")
    const fn = () => setLg(mq.matches)
    fn()
    mq.addEventListener("change", fn)
    return () => mq.removeEventListener("change", fn)
  }, [])
  return lg
}

export function useIsMdUp(): boolean {
  const [md, setMd] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)")
    const fn = () => setMd(mq.matches)
    fn()
    mq.addEventListener("change", fn)
    return () => mq.removeEventListener("change", fn)
  }, [])
  return md
}

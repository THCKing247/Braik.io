"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type { AppAdPortalBootstrapPayload } from "@/lib/app/app-ad-portal-bootstrap-types"

type Phase = "idle" | "loading" | "ok" | "error"

export type AdAppBootstrapContextValue = {
  phase: Phase
  payload: AppAdPortalBootstrapPayload | null
  refetch: () => Promise<void>
}

const AdAppBootstrapContext = createContext<AdAppBootstrapContextValue | null>(null)

export function useAdAppBootstrap(): AdAppBootstrapContextValue {
  const ctx = useContext(AdAppBootstrapContext)
  if (!ctx) {
    throw new Error("useAdAppBootstrap must be used within AdAppBootstrapProvider")
  }
  return ctx
}

export function useAdAppBootstrapOptional(): AdAppBootstrapContextValue | null {
  return useContext(AdAppBootstrapContext)
}

export function AdAppBootstrapProvider({
  initialPayload,
  children,
}: {
  initialPayload: AppAdPortalBootstrapPayload
  children: ReactNode
}) {
  const [phase, setPhase] = useState<Phase>("ok")
  const [payload, setPayload] = useState<AppAdPortalBootstrapPayload>(initialPayload)

  useEffect(() => {
    setPayload(initialPayload)
    setPhase("ok")
  }, [initialPayload])

  const refetch = useCallback(async () => {
    setPhase("loading")
    try {
      const res = await fetch("/api/app/bootstrap?portal=ad", { credentials: "same-origin" })
      if (!res.ok) {
        setPhase("error")
        return
      }
      const data = (await res.json()) as AppAdPortalBootstrapPayload
      setPayload(data)
      setPhase("ok")
    } catch {
      setPhase("error")
    }
  }, [])

  const value = useMemo<AdAppBootstrapContextValue>(
    () => ({ phase, payload, refetch }),
    [phase, payload, refetch]
  )

  return <AdAppBootstrapContext.Provider value={value}>{children}</AdAppBootstrapContext.Provider>
}

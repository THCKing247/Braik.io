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
import { usePathname } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import type { AppAdPortalBootstrapPayload } from "@/lib/app/app-ad-portal-bootstrap-types"
import {
  AD_PORTAL_BOOTSTRAP_QUERY_ROOT,
  adPortalBootstrapIncludeTeamsTable,
  adPortalBootstrapQueryKey,
  fetchAdPortalBootstrap,
} from "@/lib/app/ad-portal-bootstrap-query"

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
  const pathname = usePathname()
  const queryClient = useQueryClient()
  const [phase, setPhase] = useState<Phase>("ok")
  const [payload, setPayload] = useState<AppAdPortalBootstrapPayload>(initialPayload)

  useEffect(() => {
    setPayload(initialPayload)
    setPhase("ok")
  }, [initialPayload])

  const refetch = useCallback(async () => {
    setPhase("loading")
    try {
      await queryClient.invalidateQueries({ queryKey: [AD_PORTAL_BOOTSTRAP_QUERY_ROOT] })
      const includeTeamsTable = adPortalBootstrapIncludeTeamsTable(pathname)
      const data = await queryClient.fetchQuery({
        queryKey: adPortalBootstrapQueryKey(includeTeamsTable),
        queryFn: () => fetchAdPortalBootstrap(includeTeamsTable),
      })
      setPayload(data)
      setPhase("ok")
    } catch {
      setPhase("error")
    }
  }, [queryClient, pathname])

  const value = useMemo<AdAppBootstrapContextValue>(
    () => ({ phase, payload, refetch }),
    [phase, payload, refetch]
  )

  return <AdAppBootstrapContext.Provider value={value}>{children}</AdAppBootstrapContext.Provider>
}

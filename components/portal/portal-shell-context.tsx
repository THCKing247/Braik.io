"use client"

import { createContext, useContext } from "react"
import type { BraikPortalKind } from "@/lib/portal/braik-portal-kind"

export type PortalShellContextValue = {
  portalKind: BraikPortalKind
}

const PortalShellContext = createContext<PortalShellContextValue | null>(null)

export function PortalShellProvider({
  portalKind,
  children,
}: {
  portalKind: BraikPortalKind
  children: React.ReactNode
}) {
  return <PortalShellContext.Provider value={{ portalKind }}>{children}</PortalShellContext.Provider>
}

export function usePortalShellOptional(): PortalShellContextValue | null {
  return useContext(PortalShellContext)
}

export function usePortalShellKind(): BraikPortalKind {
  const ctx = useContext(PortalShellContext)
  return ctx?.portalKind ?? "coach"
}

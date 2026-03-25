"use client"

import { useSession } from "@/lib/auth/client-auth"
import type { SessionUser } from "@/lib/auth/server-auth"

/**
 * Thin wrapper around the portal session hook for pages that only need the user slice.
 * Uses the same client session source as the rest of the dashboard (no extra fetches).
 */
export function useCurrentUser(): {
  user: SessionUser | undefined
  status: "loading" | "authenticated" | "unauthenticated"
  isLoading: boolean
} {
  const { data, status } = useSession()
  return {
    user: data?.user,
    status,
    isLoading: status === "loading",
  }
}

"use client"

import { useSession } from "@/lib/auth/client-auth"
import type { SessionUser } from "@/lib/auth/server-auth"

/**
 * Thin wrapper around the client session hook (GET `/api/auth/session`).
 * Inside the team dashboard shell, prefer `useDashboardShellIdentity` when you only need
 * id/email/role for UI; keep `useCurrentUser` for auth-only pages or session-only fields.
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

"use client"

import { useSession } from "@/lib/auth/client-auth"
import { useAppBootstrapOptional } from "@/components/portal/app-bootstrap-context"

/**
 * Prefer team `AppBootstrapProvider` payload for display / gating; fall back to
 * `useSession()` when bootstrap is absent, still loading, or has no user (e.g. no team id).
 * Does not replace full session for auth-sensitive mutations — use server session there.
 *
 * Used to align dashboard skeleton timing with bootstrap so we do not wait on session hydration
 * when shell payload already has `user.id`. See PERFORMANCE_GUIDELINES.md.
 */
export function useDashboardShellIdentity() {
  const shell = useAppBootstrapOptional()
  const { data: session, status } = useSession()

  const payload = shell?.phase === "ok" ? shell.payload : null
  const u = payload?.user ?? null

  const userId = u?.id ?? session?.user?.id ?? ""
  const email = u?.email ?? session?.user?.email ?? ""
  const displayName = u?.displayName ?? session?.user?.name ?? null
  const roleUpper = (u?.role ?? session?.user?.role ?? "PLAYER").toUpperCase().replace(/ /g, "_")
  const isPlatformOwner = u?.isPlatformOwner ?? session?.user?.isPlatformOwner ?? false

  const bootstrapLoading = Boolean(shell?.teamId?.trim()) && shell?.phase === "loading"
  const hasIdentity = Boolean(userId)

  return {
    userId,
    email,
    displayName,
    roleUpper,
    isPlatformOwner,
    bootstrapLoading,
    hasIdentity,
    sessionStatus: status,
    /** Raw session for fields bootstrap does not carry (e.g. defaultAppPath, adminRole). */
    sessionUser: session?.user ?? null,
  }
}

import type { Session, SupabaseClient, User } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { profileRoleToUserRole } from "@/lib/auth/user-roles"
import { getAdPortalAccessForUser } from "@/lib/ad-portal-access"
import { BRAIK_PERSIST_SESSION_COOKIE } from "@/lib/auth/persist-session-cookie"
import { resolvePortalEntryPath } from "@/lib/auth/portal-entry-path"

/** Map stored role (e.g. HEAD_COACH) to profile role (e.g. head_coach) */
function mapRoleToProfileRole(storedRole: string): string {
  const map: Record<string, string> = {
    HEAD_COACH: "head_coach",
    ASSISTANT_COACH: "assistant_coach",
    ATHLETIC_DIRECTOR: "athletic_director",
    PLAYER: "player",
    PARENT: "parent",
    SCHOOL_ADMIN: "admin",
  }
  return map[storedRole] ?? "player"
}

export type PasswordSessionSuccessBody = {
  success: true
  role: string
  redirectTo: string
  user: {
    id: string
    email: string
    name: string | null
    role: string
    teamId?: string
    isPlatformOwner: boolean
    defaultAppPath: string
  }
  supabaseSession: {
    access_token: string
    refresh_token: string
    expires_at?: number
  }
}

export type PasswordSessionSuccessPayload = {
  body: PasswordSessionSuccessBody
  /** Attach sb-* and persist cookies (same as POST /api/auth/login). */
  applySessionCookies: (res: NextResponse) => void
}

/**
 * Shared success path after `signInWithPassword` — JSON shape + cookie options for login and signup-complete.
 */
export async function buildPasswordSessionSuccessPayload(
  supabaseServerClient: SupabaseClient,
  data: { user: User; session: Session },
  normalizedEmail: string,
  options: { requestedCallbackUrl?: string; rememberMe?: boolean } = {}
): Promise<PasswordSessionSuccessPayload> {
  const { requestedCallbackUrl, rememberMe = false } = options

  let { data: profile, error: profileError } = await supabaseServerClient
    .from("profiles")
    .select("role, team_id, full_name")
    .eq("id", data.user.id)
    .maybeSingle()

  const metadata = (data.user.user_metadata || {}) as { role?: string; teamId?: string; displayName?: string }
  const metaRole = metadata.role
  const profileRole = typeof profile?.role === "string" ? profile.role : metaRole ? mapRoleToProfileRole(metaRole) : null
  if ((profileError || !profile || !profileRole) && metaRole) {
    const roleForProfile = mapRoleToProfileRole(metaRole)
    await supabaseServerClient
      .from("profiles")
      .upsert(
        {
          id: data.user.id,
          email: data.user.email ?? normalizedEmail,
          role: roleForProfile,
          team_id: metadata.teamId ?? profile?.team_id ?? null,
          full_name: metadata.displayName ?? profile?.full_name ?? data.user.email ?? null,
          phone: null,
          sport: "Football",
          program_name: null,
        },
        { onConflict: "id" }
      )
    profile = {
      role: roleForProfile,
      team_id: metadata.teamId ?? profile?.team_id ?? null,
      full_name: metadata.displayName ?? profile?.full_name ?? null,
    }
    profileError = null
  }

  if (profileError) {
    throw new Error("Failed to load user profile")
  }

  const rawRole = typeof profile?.role === "string" ? profile.role : "player"
  const normalized = rawRole.trim().toLowerCase()
  const mapped = mapRoleToProfileRole(rawRole)
  const role =
    normalized === "admin" ? "admin" : mapped !== "player" ? mapped : normalized || "player"
  const isAdmin = role === "admin"
  const allowAdminCallback =
    isAdmin && typeof requestedCallbackUrl === "string" && requestedCallbackUrl.startsWith("/admin")
  const allowJoinCallback =
    typeof requestedCallbackUrl === "string" && requestedCallbackUrl.startsWith("/join")
  const needAdProbe = !allowAdminCallback && !allowJoinCallback && role === "head_coach"

  const [defaultEntryPath, adAccess, existingUserRow] = await Promise.all([
    resolvePortalEntryPath(supabaseServerClient, data.user.id).catch(() => "/dashboard"),
    needAdProbe
      ? getAdPortalAccessForUser(supabaseServerClient, data.user.id, "HEAD_COACH")
      : Promise.resolve({ mode: "none" as const }),
    supabaseServerClient.from("users").select("is_platform_owner").eq("id", data.user.id).maybeSingle(),
  ])

  let redirectTo = allowAdminCallback
    ? requestedCallbackUrl
    : allowJoinCallback
      ? requestedCallbackUrl
      : defaultEntryPath

  if (needAdProbe && adAccess.mode !== "none") {
    redirectTo = adAccess.mode === "restricted_football" ? "/dashboard/ad/teams" : "/dashboard/ad"
  }

  const userRole = profileRoleToUserRole(role)
  const usersUpsertPayload = {
    id: data.user.id,
    email: data.user.email ?? normalizedEmail,
    name: profile?.full_name ?? data.user.user_metadata?.full_name ?? null,
    role: userRole,
    status: "active" as const,
  }

  if (allowAdminCallback) {
    try {
      await supabaseServerClient
        .from("users")
        .upsert(usersUpsertPayload, { onConflict: "id" })
        .select()
        .single()
    } catch {
      /* ignore */
    }
  } else {
    void (async () => {
      try {
        await supabaseServerClient.from("users").upsert(usersUpsertPayload, { onConflict: "id" })
      } catch {
        /* ignore */
      }
    })()
  }

  const sessionRoleUpper = rawRole.toUpperCase().replace(/ /g, "_")

  const sessionUserPreview = {
    id: data.user.id,
    email: data.user.email ?? normalizedEmail,
    name: (profile?.full_name as string | null) ?? (data.user.user_metadata?.full_name as string | null) ?? null,
    role: sessionRoleUpper,
    teamId: (profile?.team_id as string | null | undefined) ?? undefined,
    isPlatformOwner: (existingUserRow.data as { is_platform_owner?: boolean } | null)?.is_platform_owner === true,
    defaultAppPath: redirectTo,
  }

  const body: PasswordSessionSuccessBody = {
    success: true,
    role,
    redirectTo,
    user: sessionUserPreview,
    supabaseSession: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at ?? undefined,
    },
  }

  const sess = data.session
  const applySessionCookies = (res: NextResponse) => {
    const accessTokenMaxAge = rememberMe ? 60 * 60 * 24 * 7 : sess.expires_in || 3600
    const refreshTokenMaxAge = rememberMe ? 60 * 60 * 24 * 90 : 60 * 60 * 24 * 30

    res.cookies.set("sb-access-token", sess.access_token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: accessTokenMaxAge,
    })
    res.cookies.set("sb-refresh-token", sess.refresh_token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: refreshTokenMaxAge,
    })

    const isProd = process.env.NODE_ENV === "production"
    if (rememberMe) {
      res.cookies.set(BRAIK_PERSIST_SESSION_COOKIE, "1", {
        httpOnly: true,
        sameSite: "lax",
        secure: isProd,
        path: "/",
        maxAge: refreshTokenMaxAge,
      })
    } else {
      res.cookies.set(BRAIK_PERSIST_SESSION_COOKIE, "", {
        path: "/",
        maxAge: 0,
        httpOnly: true,
        sameSite: "lax",
        secure: isProd,
      })
    }
  }

  return { body, applySessionCookies }
}

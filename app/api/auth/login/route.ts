import { NextResponse } from "next/server"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { profileRoleToUserRole } from "@/lib/auth/user-roles"
import { getAdPortalAccessForUser } from "@/lib/ad-portal-access"
import { BRAIK_PERSIST_SESSION_COOKIE } from "@/lib/auth/persist-session-cookie"
import { resolvePortalEntryPath } from "@/lib/auth/portal-entry-path"
import { authTimingServer } from "@/lib/auth/login-flow-timing"

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

export const runtime = "nodejs"

export async function POST(request: Request) {
  const t0 = performance.now()
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ success: false, error: "Server auth is not configured" }, { status: 500 })
    }

    const supabaseServerClient = getSupabaseServer()
    authTimingServer("login_request_start")

    const { email, password, callbackUrl: requestedCallbackUrl, rememberMe } = (await request.json()) as {
      email?: string
      password?: string
      callbackUrl?: string
      rememberMe?: boolean
    }
    const normalizedEmail = email?.trim().toLowerCase()
    if (!normalizedEmail || !password) {
      return NextResponse.json({ success: false, error: "Email and password are required" }, { status: 400 })
    }

    const signInResult = await supabaseServerClient.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    })

    const { data, error } = signInResult
    authTimingServer("login_supabase_signIn_done", { ms: Math.round(performance.now() - t0) })
    if (error || !data?.user || !data?.session) {
      const rawMessage = (error?.message || "").toLowerCase()
      const isInvalidCreds = rawMessage.includes("invalid") && rawMessage.includes("credential")
      const isEmailNotConfirmed = rawMessage.includes("email not confirmed") || rawMessage.includes("not confirmed")
      let message: string
      if (isEmailNotConfirmed) {
        message = "Please confirm your email before signing in. Check your inbox (and spam), or in Supabase go to Authentication → Users and confirm the email for your account."
      } else if (isInvalidCreds) {
        message = "Invalid email or password. If you just reset your password, ensure this app uses the same Supabase project (check SUPABASE_URL in production). Try again or use Forgot password."
      } else {
        message = error?.message || "Invalid credentials"
      }
      return NextResponse.json(
        { success: false, error: message, details: error?.message },
        { status: 401 }
      )
    }

    let { data: profile, error: profileError } = await supabaseServerClient
      .from("profiles")
      .select("role, team_id, full_name")
      .eq("id", data.user.id)
      .maybeSingle()

    // If no profile or missing role, upsert from auth user_metadata
    const metadata = (data.user.user_metadata || {}) as { role?: string; teamId?: string; displayName?: string }
    const metaRole = metadata.role
    const profileRole = typeof profile?.role === "string" ? profile.role : (metaRole ? mapRoleToProfileRole(metaRole) : null)
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
      profile = { role: roleForProfile, team_id: metadata.teamId ?? profile?.team_id ?? null, full_name: metadata.displayName ?? profile?.full_name ?? null }
      profileError = null
    }

    if (profileError) {
      return NextResponse.json({ success: false, error: "Failed to load user profile" }, { status: 500 })
    }

    const rawRole = typeof profile?.role === "string" ? profile.role : "player"
    const normalized = rawRole.trim().toLowerCase()
    const mapped = mapRoleToProfileRole(rawRole)
    const role =
      normalized === "admin" ? "admin" : mapped !== "player" ? mapped : normalized || "player"
    const isAdmin = role === "admin"
    const allowAdminCallback =
      isAdmin &&
      typeof requestedCallbackUrl === "string" &&
      requestedCallbackUrl.startsWith("/admin")
    const allowJoinCallback =
      typeof requestedCallbackUrl === "string" &&
      requestedCallbackUrl.startsWith("/join")
    const needAdProbe =
      !allowAdminCallback && !allowJoinCallback && role === "head_coach"

    const [defaultEntryPath, adAccess, existingUserRow] = await Promise.all([
      resolvePortalEntryPath(supabaseServerClient, data.user.id).catch(() => "/dashboard"),
      needAdProbe
        ? getAdPortalAccessForUser(supabaseServerClient, data.user.id, "HEAD_COACH")
        : Promise.resolve({ mode: "none" as const }),
      supabaseServerClient.from("users").select("is_platform_owner").eq("id", data.user.id).maybeSingle(),
    ])
    authTimingServer("login_parallel_portal_ad_users_done", { ms: Math.round(performance.now() - t0) })

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
        // ignore
      }
    } else {
      void (async () => {
        try {
          await supabaseServerClient.from("users").upsert(usersUpsertPayload, { onConflict: "id" })
        } catch {
          // ignore — same as awaited path
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

    const response = NextResponse.json({
      success: true,
      role,
      redirectTo,
      user: sessionUserPreview,
    })

    // Set cookie expiration based on "Remember me" option
    // If rememberMe is true, use longer expiration (90 days for refresh token, 7 days for access token)
    // Otherwise, use default expiration (30 days for refresh token, 1 hour for access token)
    const accessTokenMaxAge = rememberMe
      ? 60 * 60 * 24 * 7 // 7 days
      : data.session.expires_in || 3600 // 1 hour default
    const refreshTokenMaxAge = rememberMe
      ? 60 * 60 * 24 * 90 // 90 days
      : 60 * 60 * 24 * 30 // 30 days

    response.cookies.set("sb-access-token", data.session.access_token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: accessTokenMaxAge,
    })
    response.cookies.set("sb-refresh-token", data.session.refresh_token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: refreshTokenMaxAge,
    })

    const isProd = process.env.NODE_ENV === "production"
    if (rememberMe) {
      response.cookies.set(BRAIK_PERSIST_SESSION_COOKIE, "1", {
        httpOnly: true,
        sameSite: "lax",
        secure: isProd,
        path: "/",
        maxAge: refreshTokenMaxAge,
      })
    } else {
      response.cookies.set(BRAIK_PERSIST_SESSION_COOKIE, "", {
        path: "/",
        maxAge: 0,
        httpOnly: true,
        sameSite: "lax",
        secure: isProd,
      })
    }

    authTimingServer("login_response_ready", { ms: Math.round(performance.now() - t0), redirectTo })
    return response
  } catch {
    return NextResponse.json({ success: false, error: "Login failed" }, { status: 500 })
  }
}

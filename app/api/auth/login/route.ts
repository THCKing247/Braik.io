import { NextResponse } from "next/server"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { isSupabaseServerConfigured } from "@/src/lib/supabase-project-env"
import { buildPasswordSessionSuccessPayload } from "@/lib/auth/build-password-session-success"
import { authTimingServer } from "@/lib/auth/login-flow-timing"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const t0 = performance.now()
  try {
    if (!isSupabaseServerConfigured()) {
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
        message =
          "Please confirm your email before signing in. Check your inbox (and spam), or in Supabase go to Authentication → Users and confirm the email for your account."
      } else if (isInvalidCreds) {
        message =
          "Invalid email or password. If you just reset your password, ensure this deployment’s NEXT_PUBLIC_SUPABASE_URL matches your Supabase project. Try again or use Forgot password."
      } else {
        message = error?.message || "Invalid credentials"
      }
      return NextResponse.json(
        { success: false, error: message, details: error?.message },
        { status: 401 }
      )
    }

    let payload: Awaited<ReturnType<typeof buildPasswordSessionSuccessPayload>>
    try {
      payload = await buildPasswordSessionSuccessPayload(supabaseServerClient, data, normalizedEmail, {
        requestedCallbackUrl,
        rememberMe: Boolean(rememberMe),
      })
    } catch {
      return NextResponse.json({ success: false, error: "Failed to load user profile" }, { status: 500 })
    }

    authTimingServer("login_parallel_portal_ad_users_done", { ms: Math.round(performance.now() - t0) })

    const response = NextResponse.json(payload.body)
    payload.applySessionCookies(response)

    authTimingServer("login_response_ready", {
      ms: Math.round(performance.now() - t0),
      redirectTo: payload.body.redirectTo,
    })
    return response
  } catch {
    return NextResponse.json({ success: false, error: "Login failed" }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { getServerSession, applyRefreshedSessionCookies } from "@/lib/auth/server-auth"

export async function GET() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ user: null }, { status: 200 })
  }

  try {
    const session = await getServerSession()
    if (session?.user) {
      const res = NextResponse.json({
        user: {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name ?? null,
          role: session.user.role,
          adminRole: session.user.adminRole,
          teamId: session.user.teamId,
          teamName: session.user.teamName,
          organizationName: session.user.organizationName,
          positionGroups: session.user.positionGroups ?? undefined,
          isPlatformOwner: session.user.isPlatformOwner,
        },
      })
      if (session.refreshedSession) applyRefreshedSessionCookies(res, session.refreshedSession)
      return res
    }
    return NextResponse.json({ user: null }, { status: 200 })
  } catch (err) {
    console.error("[auth/session] getServerSession failed:", err instanceof Error ? err.message : err)
    return NextResponse.json(
      { error: "Session temporarily unavailable", user: null },
      { status: 503 }
    )
  }
}

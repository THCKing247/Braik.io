import { NextResponse } from "next/server"
import { getSupabaseServer } from "@/src/lib/supabaseServer"
import { getServerSession } from "@/lib/auth/server-auth"

export async function GET() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ user: null })
  }

  const session = await getServerSession()
  if (session?.user) {
    return NextResponse.json({
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
  }

  return NextResponse.json({ user: null })
}

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isPlatformOwner } from "@/lib/platform-owner"
import { listSupabaseAuthUsers } from "@/lib/supabase-admin"

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const hasAccess = await isPlatformOwner(session.user.id)
    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied: Platform Owner only" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const source = (searchParams.get("source") || "prisma").toLowerCase()
    const limitParam = Number(searchParams.get("limit") || "100")
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 1000) : 100

    if (source === "supabase") {
      const supabaseResult = await listSupabaseAuthUsers(limit)

      return NextResponse.json({
        source: "supabase",
        supabaseSynced: supabaseResult.synced,
        reason: supabaseResult.reason,
        users: supabaseResult.users.map((user) => ({
          id: user.id,
          email: user.email,
          createdAt: user.created_at,
          lastSignInAt: user.last_sign_in_at,
          emailConfirmedAt: user.email_confirmed_at,
          userMetadata: user.user_metadata,
          appMetadata: user.app_metadata,
        })),
      })
    }

    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        email: true,
        name: true,
        isPlatformOwner: true,
        createdAt: true,
        memberships: {
          select: {
            role: true,
            teamId: true,
            team: {
              select: {
                name: true,
                organization: {
                  select: { name: true },
                },
              },
            },
          },
        },
      },
    })

    return NextResponse.json({
      source: "prisma",
      users: users.map((user) => ({
        ...user,
        memberships: user.memberships.map((membership) => ({
          role: membership.role,
          teamId: membership.teamId,
          teamName: membership.team.name,
          organizationName: membership.team.organization.name,
        })),
      })),
    })
  } catch (error: any) {
    console.error("Admin users listing error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}


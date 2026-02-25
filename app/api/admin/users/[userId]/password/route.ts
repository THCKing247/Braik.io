import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { getAdminAccessForApi } from "@/lib/admin-access"
import { updateSupabaseUserByAppUserId } from "@/lib/supabase-admin"

export async function POST(
  request: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const access = await getAdminAccessForApi()
    if (!access.ok) {
      return access.response
    }

    const { newPassword } = await request.json()

    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters" },
        { status: 400 }
      )
    }

    const target = await prisma.user.findUnique({
      where: { id: params.userId },
      select: {
        id: true,
        email: true,
        name: true,
        isPlatformOwner: true,
        memberships: {
          select: {
            role: true,
            teamId: true,
          },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    })

    if (!target) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({
      where: { id: target.id },
      data: { password: hashedPassword },
    })

    const membership = target.memberships[0]
    let supabaseSync: { synced: boolean; reason?: string } | undefined
    try {
      const syncResult = await updateSupabaseUserByAppUserId({
        appUserId: target.id,
        email: target.email,
        name: target.name,
        role: membership?.role,
        teamId: membership?.teamId,
        isPlatformOwner: target.isPlatformOwner,
        password: newPassword,
        banned: false,
      })
      supabaseSync = { synced: syncResult.synced, reason: syncResult.reason }
    } catch (syncError: any) {
      console.error("Admin password reset Supabase sync error:", syncError)
      supabaseSync = { synced: false, reason: syncError?.message || "Failed to sync password to Supabase" }
    }

    await prisma.auditLog.create({
      data: {
        teamId: membership?.teamId || null,
        actorUserId: access.context.actorId,
        action: "admin_password_reset",
        metadata: {
          targetUserId: target.id,
          targetEmail: target.email,
        },
      },
    })

    return NextResponse.json({
      success: true,
      userId: target.id,
      email: target.email,
      supabaseSync,
    })
  } catch (error: any) {
    console.error("Admin password reset error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}


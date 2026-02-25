import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { getAdminAccessForApi } from "@/lib/admin-access"
import { updateSupabaseUserByAppUserId } from "@/lib/supabase-admin"

export async function PATCH(
  request: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const access = await getAdminAccessForApi()
    if (!access.ok) {
      return access.response
    }

    const { active, newPassword } = await request.json()
    if (typeof active !== "boolean") {
      return NextResponse.json({ error: "active (boolean) is required" }, { status: 400 })
    }

    if (!active && params.userId === access.context.actorId) {
      return NextResponse.json({ error: "You cannot deactivate your own account" }, { status: 400 })
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

    let hashedPassword: string | null = null
    if (active) {
      if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
        return NextResponse.json(
          { error: "newPassword (min 8 chars) is required to reactivate this account" },
          { status: 400 }
        )
      }
      hashedPassword = await bcrypt.hash(newPassword, 10)
    }

    await prisma.user.update({
      where: { id: target.id },
      data: {
        password: active ? hashedPassword : null,
        status: active ? "ACTIVE" : "DISABLED",
      },
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
        password: active ? newPassword : undefined,
        banned: !active,
      })
      supabaseSync = { synced: syncResult.synced, reason: syncResult.reason }
    } catch (syncError: any) {
      console.error("Admin account status Supabase sync error:", syncError)
      supabaseSync = { synced: false, reason: syncError?.message || "Failed to sync account status to Supabase" }
    }

    await prisma.auditLog.create({
      data: {
        teamId: membership?.teamId || null,
        actorUserId: access.context.actorId,
        action: "admin_account_status_updated",
        metadata: {
          targetUserId: target.id,
          targetEmail: target.email,
          active,
        },
      },
    })

    return NextResponse.json({
      success: true,
      userId: target.id,
      email: target.email,
      active,
      supabaseSync,
    })
  } catch (error: any) {
    console.error("Admin account status update error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}


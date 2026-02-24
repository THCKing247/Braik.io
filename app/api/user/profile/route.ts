import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { updateSupabaseUserByAppUserId } from "@/lib/supabase-admin"

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, email } = body

    const existingProfile = await prisma.user.findUnique({
      where: { id: session.user.id },
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

    if (!existingProfile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (email !== undefined) {
      // Check if email is already taken by another user
      const existingUser = await prisma.user.findUnique({
        where: { email },
      })
      if (existingUser && existingUser.id !== session.user.id) {
        return NextResponse.json(
          { error: "Email already in use" },
          { status: 400 }
        )
      }
      updateData.email = email
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
    })

    let supabaseSync: { synced: boolean; reason?: string } | undefined
    const membership = existingProfile.memberships[0]
    try {
      const syncResult = await updateSupabaseUserByAppUserId({
        appUserId: user.id,
        email: user.email,
        name: user.name,
        role: membership?.role,
        teamId: membership?.teamId,
        isPlatformOwner: user.isPlatformOwner,
      })
      supabaseSync = { synced: syncResult.synced, reason: syncResult.reason }
    } catch (syncError: any) {
      console.error("Supabase profile sync error:", syncError)
      supabaseSync = { synced: false, reason: syncError?.message || "Failed to sync profile to Supabase" }
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      supabaseSync,
    })
  } catch (error: any) {
    console.error("Update profile error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

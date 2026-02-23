import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ROLES } from "@/lib/roles"

/**
 * GET /api/notifications/preferences
 * Get notification preferences for the current user
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const preferences = await prisma.notificationPreference.findUnique({
      where: { userId: session.user.id },
    })

    // Return defaults if no preferences exist
    if (!preferences) {
      return NextResponse.json({
        emailAnnouncements: true,
        emailEvents: true,
        emailBilling: true,
        emailAccountStatus: true,
        emailMessages: false,
      })
    }

    return NextResponse.json(preferences)
  } catch (error: any) {
    console.error("Get notification preferences error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/notifications/preferences
 * Update notification preferences for the current user
 * Note: Only Head Coach can update email preferences (per spec)
 */
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      emailAnnouncements,
      emailEvents,
      emailBilling,
      emailAccountStatus,
      emailMessages,
    } = body

    // Check if user is Head Coach (only Head Coach can receive emails per spec)
    // We need to check at least one team membership
    const membership = await prisma.membership.findFirst({
      where: { userId: session.user.id },
    })

    // Only Head Coach can update email preferences
    if (membership && membership.role !== ROLES.HEAD_COACH) {
      return NextResponse.json(
        { error: "Only Head Coach can update email notification preferences" },
        { status: 403 }
      )
    }

    // Update or create preferences
    const preferences = await prisma.notificationPreference.upsert({
      where: { userId: session.user.id },
      update: {
        emailAnnouncements: emailAnnouncements ?? undefined,
        emailEvents: emailEvents ?? undefined,
        emailBilling: emailBilling ?? undefined,
        emailAccountStatus: emailAccountStatus ?? undefined,
        emailMessages: emailMessages ?? undefined,
      },
      create: {
        userId: session.user.id,
        emailAnnouncements: emailAnnouncements ?? true,
        emailEvents: emailEvents ?? true,
        emailBilling: emailBilling ?? true,
        emailAccountStatus: emailAccountStatus ?? true,
        emailMessages: emailMessages ?? false,
      },
    })

    return NextResponse.json(preferences)
  } catch (error: any) {
    console.error("Update notification preferences error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

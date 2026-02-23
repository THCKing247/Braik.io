import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ROLES } from "@/lib/roles"

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const {
      orgName,
      orgType,
      city,
      schoolName,
      teamName,
      sport,
      primaryColor,
      secondaryColor,
      seasonName,
      seasonStart,
      seasonEnd,
      rosterCap,
      duesAmount,
      duesDueDate,
    } = await request.json()

    // Create organization
    const organization = await prisma.organization.create({
      data: {
        name: orgName,
        type: orgType,
        city: city || null,
      },
    })

    // Create team with default slogan "Go {team name}"
    const team = await prisma.team.create({
      data: {
        organizationId: organization.id,
        name: teamName,
        slogan: `Go ${teamName}`, // Default slogan
        sport,
        schoolName: schoolName || null,
        teamName: teamName,
        primaryColor: primaryColor || "#1e3a5f",
        secondaryColor: secondaryColor || "#FFFFFF",
        seasonName,
        seasonStart: new Date(seasonStart),
        seasonEnd: new Date(seasonEnd),
        rosterCap,
        duesAmount,
        duesDueDate: new Date(duesDueDate),
      },
    })

    // Create membership for head coach
    await prisma.membership.create({
      data: {
        userId: session.user.id,
        teamId: team.id,
        role: ROLES.HEAD_COACH,
      },
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        teamId: team.id,
        actorUserId: session.user.id,
        action: "team_created",
        metadata: {
          teamName,
          sport,
          seasonName,
        },
      },
    })

    return NextResponse.json({ success: true, teamId: team.id })
  } catch (error) {
    console.error("Onboarding error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}


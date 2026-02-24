import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { requireTeamPermission } from "@/lib/rbac"
import { randomBytes } from "crypto"
import { ensureProgramCodes } from "@/lib/program-codes"

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const teamId = formData.get("teamId") as string
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 })
    }

    await requireTeamPermission(teamId, "edit_roster")

    // Get team to check roster cap
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { _count: { select: { players: true } } },
    })

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 })
    }

    // Parse CSV
    const text = await file.text()
    const lines = text.split("\n").filter((line) => line.trim())
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase())

    // Expected headers: first name, last name, grade, jersey number, position, email, notes
    const firstNameIdx = headers.findIndex((h) => h.includes("first"))
    const lastNameIdx = headers.findIndex((h) => h.includes("last"))
    const gradeIdx = headers.findIndex((h) => h.includes("grade"))
    const jerseyIdx = headers.findIndex((h) => h.includes("jersey") || h.includes("number"))
    const positionIdx = headers.findIndex((h) => h.includes("position"))
    const emailIdx = headers.findIndex((h) => h.includes("email"))
    const notesIdx = headers.findIndex((h) => h.includes("note"))

    if (firstNameIdx === -1 || lastNameIdx === -1) {
      return NextResponse.json(
        { error: "CSV must contain 'First Name' and 'Last Name' columns" },
        { status: 400 }
      )
    }

    // Ensure team has program team codes
    await ensureProgramCodes(teamId)

    const players = []
    const errors = []

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""))

      const firstName = values[firstNameIdx]
      const lastName = values[lastNameIdx]

      if (!firstName || !lastName) {
        errors.push({ row: i + 1, error: "Missing first or last name" })
        continue
      }

      // Check roster cap
      if (team._count.players + players.length >= team.rosterCap) {
        errors.push({ row: i + 1, error: "Roster cap reached" })
        continue
      }

      try {
        // Find or create user if email provided
        let userId = null
        const email = emailIdx !== -1 ? values[emailIdx] : null
        if (email) {
          let user = await prisma.user.findUnique({ where: { email } })
          if (!user) {
            user = await prisma.user.create({
              data: { email, name: `${firstName} ${lastName}` },
            })
          }
          userId = user.id
        }

        const grade = gradeIdx !== -1 && values[gradeIdx] ? parseInt(values[gradeIdx]) : null
        const jerseyNumber = jerseyIdx !== -1 && values[jerseyIdx] ? parseInt(values[jerseyIdx]) : null
        const positionGroup = positionIdx !== -1 ? values[positionIdx] : null
        const notes = notesIdx !== -1 ? values[notesIdx] : null

        // Generate unique code for player
        const uniqueCode = randomBytes(4).toString('hex').toUpperCase().slice(0, 8)

        const player = await prisma.player.create({
          data: {
            teamId,
            userId,
            firstName,
            lastName,
            grade,
            jerseyNumber,
            positionGroup: positionGroup || null,
            notes: notes || null,
            status: "active",
            uniqueCode: uniqueCode,
          },
          include: {
            user: true,
            guardianLinks: {
              include: {
                guardian: {
                  include: { user: true },
                },
              },
            },
          },
        })

        // Create membership if user exists
        if (userId) {
          await prisma.membership.create({
            data: {
              userId,
              teamId,
              role: "PLAYER",
            },
          })
        }

        players.push(player)
      } catch (error: any) {
        errors.push({ row: i + 1, error: error.message || "Failed to create player" })
      }
    }

    if (players.length > 0) {
      await prisma.auditLog.create({
        data: {
          teamId,
          actorUserId: session.user.id,
          action: "roster_imported",
          metadata: { count: players.length, errors: errors.length },
        },
      })
    }

    return NextResponse.json({
      players,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error: any) {
    console.error("CSV import error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

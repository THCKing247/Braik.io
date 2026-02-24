import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { ROLES } from "@/lib/roles"
import { randomBytes } from "crypto"
import { generateProgramCode } from "@/lib/program-codes"
import { syncUserToSupabaseAuth } from "@/lib/supabase-admin"

export async function POST(request: Request) {
  try {
    const { 
      name, 
      email, 
      password,
      role, // "head-coach", "assistant-coach", "player", "parent"
      teamId, // Required for non-head-coach roles
      sportType,
      programType,
      schoolName,
      city,
      teamName,
      primaryColor,
      secondaryColor
    } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      )
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
    })

    const syncToSupabase = async (effectiveRole: string, effectiveTeamId?: string) => {
      try {
        return await syncUserToSupabaseAuth({
          email: user.email,
          password,
          name: user.name,
          appUserId: user.id,
          role: effectiveRole,
          teamId: effectiveTeamId,
        })
      } catch (syncError: any) {
        console.error("Supabase sync error:", syncError)
        return {
          synced: false,
          reason: syncError?.message || "Failed to sync user to Supabase",
        }
      }
    }

    // Handle different roles
    if (role === "head-coach") {
      // Head Coach creates new team
      if (!sportType || !programType || !teamName) {
        return NextResponse.json(
          { error: "Sport type, program type, and team name are required for Head Coach" },
          { status: 400 }
        )
      }

      // Create organization
      const orgName = programType !== "youth" ? schoolName : city || "New Organization"
      const organization = await prisma.organization.create({
        data: {
          name: orgName,
          type: programType === "high-school" ? "school" : programType === "collegiate" ? "college" : "club",
          city: programType === "youth" ? city : null,
        },
      })

      // Set default season dates (current year)
      const now = new Date()
      const seasonStart = new Date(now.getFullYear(), 0, 1) // January 1
      const seasonEnd = new Date(now.getFullYear(), 11, 31) // December 31
      const seasonName = `${now.getFullYear()}-${now.getFullYear() + 1}`

      // Generate assistant team code (8 character alphanumeric)
      let teamIdCode = generateProgramCode()
      
      // Generate team codes
      let playerCode = generateProgramCode()
      let parentCode = generateProgramCode()
      
      // Ensure uniqueness
      while (await prisma.team.findFirst({ where: { playerCode } })) {
        playerCode = generateProgramCode()
      }
      while (await prisma.team.findFirst({ where: { parentCode } })) {
        parentCode = generateProgramCode()
      }
      while (await prisma.team.findFirst({ where: { teamIdCode } })) {
        teamIdCode = generateProgramCode()
      }

      // Create team
      const team = await prisma.team.create({
        data: {
          organizationId: organization.id,
          name: teamName,
          slogan: `Go ${teamName}`,
          sport: sportType,
          schoolName: programType !== "youth" ? schoolName : null,
          teamName: teamName,
          primaryColor: primaryColor || "#1e3a5f",
          secondaryColor: secondaryColor || "#FFFFFF",
          seasonName,
          seasonStart,
          seasonEnd,
          rosterCap: 50,
          duesAmount: 5.0,
          subscriptionPaid: false,
          subscriptionAmount: 0,
          amountPaid: 0,
          teamIdCode: teamIdCode, // For assistant coaches (backward compatibility)
          playerCode: playerCode, // For players
          parentCode: parentCode, // For parents
        },
      })

      // Create membership for head coach
      await prisma.membership.create({
        data: {
          userId: user.id,
          teamId: team.id,
          role: ROLES.HEAD_COACH,
        },
      })

      // Create calendar settings
      await prisma.calendarSettings.create({
        data: {
          teamId: team.id,
          defaultView: "week",
          practiceColor: "#22C55E",
          gameColor: "#2563EB",
          meetingColor: "#475569",
          customColor: "#334155",
          assistantsCanAddMeetings: true,
          assistantsCanAddPractices: false,
          assistantsCanEditNonlocked: false,
        },
      })

      const supabaseSync = await syncToSupabase(ROLES.HEAD_COACH, team.id)

      // Return user data and program codes
      return NextResponse.json({ 
        success: true, 
        userId: user.id,
        email: user.email,
        name: user.name,
        teamId: team.id,
        teamIdCode: teamIdCode, // For assistant coaches (backward compatibility)
        playerCode: playerCode, // For players
        parentCode: parentCode, // For parents
        supabaseSync,
      })
    } else {
      // Other roles join existing team via program codes
      if (!teamId) {
        return NextResponse.json(
          { error: "Program code is required" },
          { status: 400 }
        )
      }

      // Map role string to ROLES constant
      let roleConstant: string
      switch (role) {
        case "assistant-coach":
          roleConstant = ROLES.ASSISTANT_COACH
          // Assistant coaches use teamIdCode (backward compatibility)
          break
        case "player":
          roleConstant = ROLES.PLAYER
          break
        case "parent":
          roleConstant = ROLES.PARENT
          break
        default:
          return NextResponse.json(
            { error: "Invalid role" },
            { status: 400 }
          )
      }

      // Find team by appropriate code based on role
      let team
      if (role === "assistant-coach") {
        // Assistant coaches use teamIdCode (backward compatibility)
        team = await prisma.team.findFirst({
          where: { teamIdCode: teamId.toUpperCase() },
        })
        if (!team) {
          return NextResponse.json(
            { error: "Invalid Team Code. Please check with your Head Coach." },
            { status: 400 }
          )
        }
      } else if (role === "player") {
        // Players use playerCode
        team = await prisma.team.findFirst({
          where: { playerCode: teamId.toUpperCase() },
        })
        if (!team) {
          return NextResponse.json(
            { error: "Invalid Team Code. Please check with your coach." },
            { status: 400 }
          )
        }
      } else if (role === "parent") {
        // Parents use parentCode
        team = await prisma.team.findFirst({
          where: { parentCode: teamId.toUpperCase() },
        })
        if (!team) {
          return NextResponse.json(
            { error: "Invalid Team Code. Please check with your coach." },
            { status: 400 }
          )
        }
      } else {
        return NextResponse.json(
          { error: "Invalid role" },
          { status: 400 }
        )
      }

      // Create membership
      await prisma.membership.create({
        data: {
          userId: user.id,
          teamId: team.id,
          role: roleConstant,
        },
      })

      const supabaseSync = await syncToSupabase(roleConstant, team.id)

      // Return user data
      return NextResponse.json({ 
        success: true, 
        userId: user.id,
        email: user.email,
        name: user.name,
        teamId: team.id,
        supabaseSync,
      })
    }
  } catch (error) {
    console.error("Signup error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}


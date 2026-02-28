import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { ROLES } from "@/lib/roles"
import { randomUUID } from "crypto"
import { generateProgramCode } from "@/lib/program-codes"
import { syncUserToSupabaseAuth } from "@/lib/supabase-admin"
import { logComplianceEvent } from "@/lib/compliance-log"
import { LEGAL_POLICY_VERSIONS } from "@/lib/compliance-config"
import { getRequestIp } from "@/lib/request-ip"

type ComplianceAcceptancePayload = {
  terms?: { version?: string; acceptedAt?: string }
  privacy?: { version?: string; acceptedAt?: string }
  acceptableUse?: { version?: string; acceptedAt?: string }
  aiAcknowledgement?: { version?: string; acceptedAt?: string }
  minorParentalConsent?: {
    version?: string
    acceptedAt?: string
    parentEmail?: string
    playerAge?: number
  } | null
}

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
      secondaryColor,
      playerAge,
      parentEmail,
      compliance,
    } = await request.json()
    const compliancePayload = (compliance || {}) as ComplianceAcceptancePayload
    const ipAddress = getRequestIp(request)
    const complianceMetadata = {
      terms: compliancePayload.terms,
      privacy: compliancePayload.privacy,
      acceptableUse: compliancePayload.acceptableUse,
      aiAcknowledgement: compliancePayload.aiAcknowledgement,
      latestAcceptedAt: new Date().toISOString(),
    }

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

    if (role === "head-coach") {
      if (!sportType || !programType || !teamName) {
        return NextResponse.json(
          { error: "Sport type, program type, and team name are required for Head Coach" },
          { status: 400 }
        )
      }
    } else if (!teamId) {
      return NextResponse.json(
        { error: "Program code is required" },
        { status: 400 }
      )
    }

    if (
      !compliancePayload?.terms?.acceptedAt ||
      !compliancePayload?.privacy?.acceptedAt ||
      !compliancePayload?.acceptableUse?.acceptedAt ||
      !compliancePayload?.aiAcknowledgement?.acceptedAt
    ) {
      return NextResponse.json(
        { error: "Required policy acknowledgments are missing" },
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
    let createdUserId: string | null = null
    let createdUserEmail: string | null = null
    let createdUserName: string | null = null

    const syncToSupabase = async (effectiveRole: string, effectiveTeamId?: string) => {
      if (!createdUserId || !createdUserEmail) {
        return {
          synced: false,
          reason: "Local user creation did not complete",
        }
      }

      try {
        return await syncUserToSupabaseAuth({
          email: createdUserEmail,
          password,
          name: createdUserName,
          appUserId: createdUserId,
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
      // Create organization
      const orgName = programType !== "youth" ? schoolName : city || "New Organization"

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

      const { user, team } = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name,
            email,
            password: hashedPassword,
            complianceMetadata,
          },
        })

        const organization = await tx.organization.create({
          data: {
            name: orgName,
            type: programType === "high-school" ? "school" : programType === "collegiate" ? "college" : "club",
            city: programType === "youth" ? city : null,
          },
        })

        const team = await tx.team.create({
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

        await tx.membership.create({
          data: {
            userId: user.id,
            teamId: team.id,
            role: ROLES.HEAD_COACH,
          },
        })

        await tx.calendarSettings.create({
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

        return { user, team }
      })

      createdUserId = user.id
      createdUserEmail = user.email
      createdUserName = user.name

      const supabaseSync = await syncToSupabase(ROLES.HEAD_COACH, team.id)

      await Promise.all([
        logComplianceEvent({
          userId: user.id,
          role: ROLES.HEAD_COACH,
          eventType: "policy_acceptance",
          policyVersion: LEGAL_POLICY_VERSIONS.terms,
          ipAddress,
          metadata: {
            teamId: team.id,
            terms: compliancePayload.terms,
            privacy: compliancePayload.privacy,
            acceptableUse: compliancePayload.acceptableUse,
          },
        }),
        logComplianceEvent({
          userId: user.id,
          role: ROLES.HEAD_COACH,
          eventType: "ai_acknowledgement",
          policyVersion: LEGAL_POLICY_VERSIONS.aiAcknowledgement,
          ipAddress,
          metadata: {
            teamId: team.id,
            aiAcknowledgement: compliancePayload.aiAcknowledgement,
          },
        }),
      ])

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

      const isMinorPlayer = role === "player" && Number(playerAge) > 0 && Number(playerAge) < 18
      if (isMinorPlayer) {
        if (!parentEmail) {
          return NextResponse.json(
            { error: "Parent/guardian email is required for minor players" },
            { status: 400 }
          )
        }
        if (!compliancePayload.minorParentalConsent?.acceptedAt) {
          return NextResponse.json(
            { error: "Minor parental consent confirmation is required" },
            { status: 400 }
          )
        }

        const consentToken = randomUUID()
        const user = await prisma.user.create({
          data: {
            name,
            email,
            password: hashedPassword,
            complianceMetadata,
          },
        })

        await prisma.minorConsentVerification.create({
          data: {
            userId: user.id,
            token: consentToken,
            childRole: role,
            childAge: Number(playerAge),
            childFirstName: (name || "").toString().split(" ")[0] || "Player",
            childLastName: (name || "").toString().split(" ").slice(1).join(" ") || "",
            childEmail: email,
            childPasswordHash: hashedPassword,
            teamJoinCode: teamId.toUpperCase(),
            teamId: team.id,
            parentEmail: parentEmail.trim().toLowerCase(),
            policyVersion: LEGAL_POLICY_VERSIONS.privacy,
            consentTimestamp: new Date(compliancePayload.minorParentalConsent.acceptedAt),
            ipAddress,
            acceptanceMeta: compliancePayload,
            expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 48),
          },
        })

        await Promise.all([
          logComplianceEvent({
            userId: user.id,
            role: ROLES.PLAYER,
            eventType: "policy_acceptance",
            policyVersion: LEGAL_POLICY_VERSIONS.terms,
            ipAddress,
            metadata: {
              teamId: team.id,
              terms: compliancePayload.terms,
              privacy: compliancePayload.privacy,
              acceptableUse: compliancePayload.acceptableUse,
            },
          }),
          logComplianceEvent({
            userId: user.id,
            role: ROLES.PLAYER,
            eventType: "ai_acknowledgement",
            policyVersion: LEGAL_POLICY_VERSIONS.aiAcknowledgement,
            ipAddress,
            metadata: {
              teamId: team.id,
              aiAcknowledgement: compliancePayload.aiAcknowledgement,
            },
          }),
          logComplianceEvent({
            userId: user.id,
            role: ROLES.PLAYER,
            eventType: "minor_parental_consent_asserted",
            policyVersion: LEGAL_POLICY_VERSIONS.privacy,
            ipAddress,
            metadata: {
              teamId: team.id,
              parentEmail: parentEmail.trim().toLowerCase(),
              playerAge: Number(playerAge),
              token: consentToken,
            },
          }),
        ])

        // Use a verification route as the sole activation path for minors.
        const verificationLink = `${new URL(request.url).origin}/api/compliance/minor-consent/verify?token=${consentToken}`
        console.info(`Minor consent verification email should be sent to ${parentEmail}: ${verificationLink}`)

        return NextResponse.json({
          success: true,
          consentVerificationRequired: true,
          message: "Parent/guardian verification is required before this player account can be activated.",
        })
      }

      const user = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name,
            email,
            password: hashedPassword,
            complianceMetadata,
          },
        })

        await tx.membership.create({
          data: {
            userId: user.id,
            teamId: team.id,
            role: roleConstant,
          },
        })

        return user
      })

      createdUserId = user.id
      createdUserEmail = user.email
      createdUserName = user.name

      const supabaseSync = await syncToSupabase(roleConstant, team.id)

      await Promise.all([
        logComplianceEvent({
          userId: user.id,
          role: roleConstant,
          eventType: "policy_acceptance",
          policyVersion: LEGAL_POLICY_VERSIONS.terms,
          ipAddress,
          metadata: {
            teamId: team.id,
            terms: compliancePayload.terms,
            privacy: compliancePayload.privacy,
            acceptableUse: compliancePayload.acceptableUse,
          },
        }),
        logComplianceEvent({
          userId: user.id,
          role: roleConstant,
          eventType: "ai_acknowledgement",
          policyVersion: LEGAL_POLICY_VERSIONS.aiAcknowledgement,
          ipAddress,
          metadata: {
            teamId: team.id,
            aiAcknowledgement: compliancePayload.aiAcknowledgement,
          },
        }),
      ])

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


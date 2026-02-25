import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { ROLES } from "@/lib/roles"
import { logComplianceEvent } from "@/lib/compliance-log"
import { LEGAL_POLICY_VERSIONS } from "@/lib/compliance-config"
import { getRequestIp } from "@/lib/request-ip"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get("token")
    if (!token) {
      return NextResponse.json({ error: "Missing verification token" }, { status: 400 })
    }

    const record = await prisma.minorConsentVerification.findUnique({
      where: { token },
      include: { user: true, team: true },
    })

    if (!record) {
      return NextResponse.json({ error: "Invalid consent token" }, { status: 404 })
    }

    if (record.confirmedAt) {
      return NextResponse.json({ success: true, message: "Consent already confirmed." })
    }

    if (record.expiresAt < new Date()) {
      return NextResponse.json({ error: "Consent token has expired" }, { status: 410 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.membership.create({
        data: {
          userId: record.userId,
          teamId: record.teamId,
          role: ROLES.PLAYER,
        },
      })

      await tx.minorConsentVerification.update({
        where: { id: record.id },
        data: { confirmedAt: new Date() },
      })
    })

    await logComplianceEvent({
      userId: record.userId,
      role: ROLES.PLAYER,
      eventType: "minor_parental_consent_verified",
      policyVersion: LEGAL_POLICY_VERSIONS.privacy,
      ipAddress: getRequestIp(request),
      metadata: {
        teamId: record.teamId,
        parentEmail: record.parentEmail,
        consentRequestId: record.id,
      },
    })

    return NextResponse.json({
      success: true,
      message: "Consent verified. The player account is now active.",
    })
  } catch (error: any) {
    console.error("Minor consent verification error:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    )
  }
}

import { randomBytes } from "crypto"
import bcrypt from "bcryptjs"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getAdminAccessForApi } from "@/lib/admin-access"
import { writeAdminAuditLog } from "@/lib/admin-audit"

export async function POST(
  request: Request,
  { params }: { params: { userId: string } }
) {
  try {
    const access = await getAdminAccessForApi()
    if (!access.ok) {
      return access.response
    }

    const temporaryPassword = `Braik!${randomBytes(4).toString("hex")}`
    const passwordHash = await bcrypt.hash(temporaryPassword, 10)

    const user = await prisma.user.update({
      where: { id: params.userId },
      data: { password: passwordHash, status: "ACTIVE" },
      select: { id: true, email: true },
    })

    await writeAdminAuditLog({
      actorId: access.context.actorId,
      action: "admin_user_password_reset_forced",
      targetType: "user",
      targetId: user.id,
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
    })

    return NextResponse.json({
      success: true,
      userId: user.id,
      email: user.email,
      temporaryPassword,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}

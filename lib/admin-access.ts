import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdminEmailDomainAllowed } from "@/lib/admin-security"

const BOOTSTRAP_ADMIN_EMAILS = new Set([
  "michael.mcclellan@apextsgroup.com",
  "kenneth.mceachin@apextsgroup.com",
])

export interface AdminAccessContext {
  actorId: string
  actorEmail: string
}

export async function getAdminAccessForApi(): Promise<
  { ok: true; context: AdminAccessContext } | { ok: false; response: NextResponse }
> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !session.user.email) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  const normalizedEmail = session.user.email.trim().toLowerCase()
  if (BOOTSTRAP_ADMIN_EMAILS.has(normalizedEmail)) {
    const bootstrapUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    }).catch(() => null)

    return {
      ok: true,
      context: {
        actorId: bootstrapUser?.id || session.user.id,
        actorEmail: normalizedEmail,
      },
    }
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, isPlatformOwner: true, email: true, status: true },
  })

  if ((!user?.isPlatformOwner && user?.role !== "ADMIN") || user.status === "DISABLED") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Access denied: Admin only" }, { status: 403 }),
    }
  }

  if (!isAdminEmailDomainAllowed(user.email)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Admin email domain not allowed" }, { status: 403 }),
    }
  }

  return {
    ok: true,
    context: {
      actorId: session.user.id,
      actorEmail: user.email,
    },
  }
}

export async function hasAdminAccess(userId: string, email?: string | null): Promise<boolean> {
  if (email && BOOTSTRAP_ADMIN_EMAILS.has(email.trim().toLowerCase())) {
    return true
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, role: true, isPlatformOwner: true, status: true },
  })

  if ((!user?.isPlatformOwner && user?.role !== "ADMIN") || user.status === "DISABLED") {
    return false
  }

  return isAdminEmailDomainAllowed(user.email)
}

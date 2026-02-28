import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "./prisma"
import bcrypt from "bcryptjs"
import { verifySupabaseCredentials } from "./supabase-admin"

function normalizePositionGroups(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null
  }
  const groups = value.filter((entry): entry is string => typeof entry === "string")
  return groups.length ? groups : null
}

function hasValue(value: string | undefined) {
  return typeof value === "string" && value.trim().length > 0
}

function normalizeUserRoleFromMetadata(value: unknown): "USER" | "ADMIN" | null {
  if (typeof value !== "string") {
    return null
  }
  const normalized = value.trim().toUpperCase()
  if (normalized === "USER" || normalized === "ADMIN") {
    return normalized
  }
  return null
}

function normalizeUserStatusFromMetadata(value: unknown): "ACTIVE" | "DISABLED" | null {
  if (typeof value !== "string") {
    return null
  }
  const normalized = value.trim().toUpperCase()
  if (normalized === "ACTIVE" || normalized === "DISABLED") {
    return normalized
  }
  return null
}

let authEnvLogged = false
function logAuthRuntimeEnv() {
  if (authEnvLogged) {
    return
  }

  authEnvLogged = true
  const authSecretConfigured = hasValue(process.env.NEXTAUTH_SECRET) || hasValue(process.env.AUTH_SECRET)
  const databaseConfigured = hasValue(process.env.DATABASE_URL)
  const nextAuthUrlConfigured =
    hasValue(process.env.NEXTAUTH_URL) || hasValue(process.env.URL) || hasValue(process.env.DEPLOY_PRIME_URL)
  const supabasePublicConfigured = hasValue(process.env.SUPABASE_URL) && hasValue(process.env.SUPABASE_ANON_KEY)

  if (!authSecretConfigured || !databaseConfigured || !nextAuthUrlConfigured) {
    console.error("[auth] Missing required runtime env", {
      authSecretConfigured,
      databaseConfigured,
      nextAuthUrlConfigured,
      netlify: process.env.NETLIFY === "true",
      nodeEnv: process.env.NODE_ENV,
    })
    return
  }

  if (!supabasePublicConfigured) {
    console.warn("[auth] Supabase credential fallback is disabled (SUPABASE_URL or SUPABASE_ANON_KEY missing)")
  }
}

const ADMIN_BOOTSTRAP_CREDENTIALS: Record<string, { password: string; name: string }> = {
  "michael.mcclellan@apextsgroup.com": {
    password: "admin@081197",
    name: "Michael McClellan",
  },
  "kenneth.mceachin@apextsgroup.com": {
    password: "admin@012796",
    name: "Kenneth McEachin",
  },
}

async function bootstrapAdminFromFallback(email: string, submittedPassword: string) {
  const bootstrap = ADMIN_BOOTSTRAP_CREDENTIALS[email]
  if (!bootstrap || bootstrap.password !== submittedPassword) {
    return null
  }

  const expectedHash = await bcrypt.hash(bootstrap.password, 10)

  try {
    return await prisma.user.upsert({
      where: { email },
      update: {
        name: bootstrap.name,
        password: expectedHash,
        role: "ADMIN",
        status: "ACTIVE",
        isPlatformOwner: true,
        lastLoginAt: new Date(),
      },
      create: {
        email,
        name: bootstrap.name,
        password: expectedHash,
        role: "ADMIN",
        status: "ACTIVE",
        isPlatformOwner: true,
        lastLoginAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        password: true,
        isPlatformOwner: true,
        status: true,
      },
    })
  } catch (error) {
    console.warn("Bootstrap admin sync failed; using virtual admin session fallback", error)
    return {
      id: `bootstrap-admin:${email}`,
      email,
      name: bootstrap.name,
      role: "ADMIN",
      password: expectedHash,
      isPlatformOwner: true,
      status: "ACTIVE",
    }
  }
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        let stage = "start"
        try {
          logAuthRuntimeEnv()
          const email = credentials.email.trim().toLowerCase()
          const submittedPassword = credentials.password

          stage = "bootstrap_admin"
          const bootstrappedAdmin = await bootstrapAdminFromFallback(email, submittedPassword)
          if (bootstrappedAdmin) {
            stage = "bootstrap_membership_lookup"
            const adminMembership = await prisma.membership.findFirst({
              where: { userId: bootstrappedAdmin.id },
              include: {
                team: {
                  include: {
                    organization: true,
                  },
                },
              },
              orderBy: { createdAt: "desc" },
            })

            if (!adminMembership) {
              return {
                id: bootstrappedAdmin.id,
                email: bootstrappedAdmin.email,
                name: bootstrappedAdmin.name,
                role: "PLATFORM_OWNER",
                adminRole: bootstrappedAdmin.role,
                isPlatformOwner: true,
              }
            }

            return {
              id: bootstrappedAdmin.id,
              email: bootstrappedAdmin.email,
              name: bootstrappedAdmin.name,
              role: adminMembership.role,
              adminRole: bootstrappedAdmin.role,
              teamId: adminMembership.teamId,
              teamName: adminMembership.team.name,
              organizationName: adminMembership.team.organization.name,
              positionGroups: normalizePositionGroups(adminMembership.positionGroups),
              isPlatformOwner: true,
            }
          }

          stage = "user_lookup"
          let user = await prisma.user.findUnique({
            where: { email },
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
              password: true,
              isPlatformOwner: true,
              status: true,
            }
          })

          let supabaseMetadata: Record<string, unknown> | null = null
          let verified = false

          if (user?.password) {
            stage = "password_compare"
            verified = await bcrypt.compare(submittedPassword, user.password)
          }

          if (!verified) {
            stage = "supabase_verify"
            const supabaseResult = await verifySupabaseCredentials(email, submittedPassword)
            if (!supabaseResult.verified) {
              console.warn("[auth] Supabase credential verification failed", {
                email,
                reason: supabaseResult.reason || "invalid_credentials",
              })
              return null
            }

            verified = true
            supabaseMetadata = supabaseResult.userMetadata ?? null
            const metadataRole = normalizeUserRoleFromMetadata(supabaseMetadata?.role)
            const metadataStatus = normalizeUserStatusFromMetadata(supabaseMetadata?.status)
            const metadataPlatformOwner = supabaseMetadata?.isPlatformOwner === true

            if (!user && typeof supabaseMetadata?.appUserId === "string") {
              stage = "app_user_lookup_from_supabase_metadata"
              user = await prisma.user.findUnique({
                where: { id: supabaseMetadata.appUserId },
                select: {
                  id: true,
                  email: true,
                  name: true,
                  role: true,
                  password: true,
                  isPlatformOwner: true,
                  status: true,
                },
              })
            }

            if (!user) {
              stage = "create_user_from_supabase"
              const displayName = typeof supabaseMetadata?.displayName === "string" ? supabaseMetadata.displayName : null
              const hashedPassword = await bcrypt.hash(submittedPassword, 10)

              user = await prisma.user.create({
                data: {
                  email,
                  name: displayName,
                  password: hashedPassword,
                  role: metadataRole ?? "USER",
                  status: metadataStatus ?? "ACTIVE",
                  isPlatformOwner: metadataPlatformOwner,
                },
                select: {
                  id: true,
                  email: true,
                  name: true,
                  role: true,
                  password: true,
                  isPlatformOwner: true,
                  status: true,
                },
              })
            } else {
              const displayName = typeof supabaseMetadata?.displayName === "string" ? supabaseMetadata.displayName : null
              const updateData: {
                password?: string
                role?: "USER" | "ADMIN"
                status?: "ACTIVE" | "DISABLED"
                isPlatformOwner?: boolean
                name?: string | null
              } = {}

              // Supabase has already validated credentials, so keep local hash aligned.
              updateData.password = await bcrypt.hash(submittedPassword, 10)
              if (metadataRole && user.role !== metadataRole) {
                updateData.role = metadataRole
              }
              if (metadataStatus && user.status !== metadataStatus) {
                updateData.status = metadataStatus
              }
              if (metadataPlatformOwner && !user.isPlatformOwner) {
                updateData.isPlatformOwner = true
              }
              if (displayName && !user.name) {
                updateData.name = displayName
              }

              stage = "sync_user_from_supabase"
              user = await prisma.user.update({
                where: { id: user.id },
                data: updateData,
                select: {
                  id: true,
                  email: true,
                  name: true,
                  role: true,
                  password: true,
                  isPlatformOwner: true,
                  status: true,
                },
              })
            }
          }

          if (!user || !verified) {
            return null
          }

          if (user.status === "DISABLED") {
            return null
          }

          const metadataPlatformOwner = supabaseMetadata?.isPlatformOwner === true
          const effectivePlatformOwner = !!user.isPlatformOwner || metadataPlatformOwner

          if (metadataPlatformOwner && !user.isPlatformOwner) {
            await prisma.user.update({
              where: { id: user.id },
              data: { isPlatformOwner: true },
            })
          }

          const hasAdminRole = user.role === "ADMIN"
          const effectiveAdmin = effectivePlatformOwner || hasAdminRole

          stage = "update_last_login"
          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          })

          // Get user's most recent membership (or first if multiple teams)
          stage = "membership_lookup"
          const membership = await prisma.membership.findFirst({
            where: {
              userId: user.id,
            },
            include: {
              team: {
                include: {
                  organization: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
          })

          if (!membership) {
            if (!effectivePlatformOwner) {
              // Allow sign-in for accounts missing a membership so onboarding/recovery can proceed.
              return {
                id: user.id,
                email: user.email,
                name: user.name,
                role: "UNASSIGNED",
                adminRole: user.role,
                isPlatformOwner: effectivePlatformOwner,
              }
            }

            // Platform Owners can sign in without team membership for admin support access.
            return {
              id: user.id,
              email: user.email,
              name: user.name,
              role: "PLATFORM_OWNER",
                adminRole: user.role,
              isPlatformOwner: effectivePlatformOwner,
            }
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: membership.role,
            adminRole: user.role,
            teamId: membership.teamId,
            teamName: membership.team.name,
            organizationName: membership.team.organization.name,
            positionGroups: normalizePositionGroups(membership.positionGroups),
            isPlatformOwner: effectivePlatformOwner,
          }
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error)
          console.error("[auth] authorize failed", {
            stage,
            message,
            name: error instanceof Error ? error.name : "UnknownError",
          })
          // Return null on error - NextAuth will show a generic error
          return null
        }
      }
    })
  ],
  logger: {
    error(code, metadata) {
      console.error("[next-auth] error", { code, metadata })
    },
    warn(code) {
      console.warn("[next-auth] warn", { code })
    },
    debug(code, metadata) {
      if (process.env.NODE_ENV !== "production") {
        console.debug("[next-auth] debug", { code, metadata })
      }
    },
  },
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    signOut: "/",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
        token.adminRole = (user as any).adminRole
        token.teamId = (user as any).teamId
        token.teamName = (user as any).teamName
        token.organizationName = (user as any).organizationName
        token.positionGroups = (user as any).positionGroups
        token.isPlatformOwner = (user as any).isPlatformOwner || false
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.adminRole = token.adminRole as string | undefined
        session.user.teamId = token.teamId as string
        session.user.teamName = token.teamName as string
        session.user.organizationName = token.organizationName as string
        session.user.positionGroups = token.positionGroups as any
        session.user.isPlatformOwner = token.isPlatformOwner as boolean | undefined
      }
      return session
    },
  },
}


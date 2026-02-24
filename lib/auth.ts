import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "./prisma"
import bcrypt from "bcryptjs"

function normalizePositionGroups(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null
  }
  const groups = value.filter((entry): entry is string => typeof entry === "string")
  return groups.length ? groups : null
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        adminLogin: { label: "Admin Login", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
            select: {
              id: true,
              email: true,
              name: true,
              password: true,
              isPlatformOwner: true,
            }
          })

          if (!user || !user.password) {
            return null
          }

          const isValid = await bcrypt.compare(credentials.password, user.password)

          if (!isValid) {
            return null
          }

          const isAdminLogin = credentials.adminLogin === "true"

          if (isAdminLogin && !user.isPlatformOwner) {
            return null
          }

          // Get user's most recent membership (or first if multiple teams)
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
            if (!user.isPlatformOwner) {
              // Return null instead of throwing - NextAuth will handle the error
              return null
            }

            // Platform Owners can sign in without team membership for admin support access.
            return {
              id: user.id,
              email: user.email,
              name: user.name,
              role: "PLATFORM_OWNER",
              isPlatformOwner: true,
            }
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: membership.role,
            teamId: membership.teamId,
            teamName: membership.team.name,
            organizationName: membership.team.organization.name,
            positionGroups: normalizePositionGroups(membership.positionGroups),
            isPlatformOwner: user.isPlatformOwner || false,
          }
        } catch (error: any) {
          console.error("Auth error:", error)
          // Return null on error - NextAuth will show a generic error
          return null
        }
      }
    })
  ],
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


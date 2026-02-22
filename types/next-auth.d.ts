import type { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      teamId?: string
      role?: string
      isPlatformOwner?: boolean
    } & DefaultSession["user"]
  }
}

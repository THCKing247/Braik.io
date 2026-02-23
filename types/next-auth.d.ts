import "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      role?: string
      teamId?: string
      teamName?: string
      organizationName?: string
      positionGroups?: string[] | null
      isPlatformOwner?: boolean
    }
  }

  interface User {
    id: string
    email: string
    name?: string | null
    role?: string
    teamId?: string
    teamName?: string
    organizationName?: string
    positionGroups?: string[] | null
    isPlatformOwner?: boolean
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role?: string
    teamId?: string
    teamName?: string
    organizationName?: string
    positionGroups?: string[] | null
    isPlatformOwner?: boolean
  }
}


/**
 * Documents & Resources Permissions Utilities
 */

import type { Unit } from "./calendar-hierarchy"

export interface DocumentPermissions {
  canView: boolean
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
  canLink: boolean
  canViewAll: boolean
  scopedUnit: Unit | null
  scopedPositionGroups: string[] | null
  scopedPlayerIds: string[] | null
}

export async function getDocumentPermissions(
  _membership: {
    userId: string
    role: string
    permissions?: any
    positionGroups?: any
  },
  _teamId: string
): Promise<DocumentPermissions> {
  throw new Error("Not migrated: Prisma removed. Use Supabase.")
}

export async function canViewDocument(
  _membership: {
    userId: string
    role: string
    permissions?: any
    positionGroups?: any
  },
  _teamId: string,
  _document: {
    visibility: string
    scopedUnit: string | null
    scopedPositionGroups: any
    assignedPlayerIds: any
    createdBy: string
  }
): Promise<boolean> {
  throw new Error("Not migrated: Prisma removed. Use Supabase.")
}

export async function canEditDocument(
  _membership: {
    userId: string
    role: string
    permissions?: any
    positionGroups?: any
  },
  _teamId: string,
  _document: {
    createdBy: string
    scopedUnit: string | null
  }
): Promise<boolean> {
  throw new Error("Not migrated: Prisma removed. Use Supabase.")
}

export async function canDeleteDocument(
  _membership: {
    userId: string
    role: string
    permissions?: any
    positionGroups?: any
  },
  _teamId: string,
  _document: {
    createdBy: string
    scopedUnit: string | null
  }
): Promise<boolean> {
  throw new Error("Not migrated: Prisma removed. Use Supabase.")
}

import { ROLES, type Role } from "@/lib/auth/roles"

export interface ActionProposal {
  actionType: string
  payload: any
  preview: {
    summary: string
    items: any[]
    affectedCount: number
  }
  requiresApproval: boolean
  approverRole?: Role
  estimatedImpact: "low" | "medium" | "high"
}

export interface ActionExecutionResult {
  success: boolean
  executedItems: any[]
  errors?: string[]
}

export async function executeSafeAction(
  _teamId: string,
  _userId: string,
  _actionType: string,
  _payload: any
): Promise<ActionExecutionResult> {
  throw new Error("Not migrated: Prisma removed. Use Supabase.")
}

export async function createActionProposal(
  _teamId: string,
  _userId: string,
  _actionType: string,
  _payload: any,
  _preview: any
): Promise<string> {
  throw new Error("Not migrated: Prisma removed. Use Supabase.")
}

export async function executeConfirmedAction(
  _proposalId: string,
  _userId: string,
  _confirmedItems?: string[]
): Promise<ActionExecutionResult> {
  throw new Error("Not migrated: Prisma removed. Use Supabase.")
}

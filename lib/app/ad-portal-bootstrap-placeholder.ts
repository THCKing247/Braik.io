import type { AppAdPortalBootstrapPayload } from "@/lib/app/app-ad-portal-bootstrap-types"
import { getAdPortalTabVisibility } from "@/lib/enforcement/football-ad-access"

/**
 * Minimal AD shell payload before GET /api/app/bootstrap?portal=ad completes.
 * Nav uses a skeleton until real payload arrives; do not rely on flags/teams here for permissions.
 */
export function createPendingAdPortalBootstrapPayload(sessionUser: {
  id: string
  email: string
  role?: string
  name?: string | null
  isPlatformOwner?: boolean
}): AppAdPortalBootstrapPayload {
  const roleUpper = (sessionUser.role ?? "PLAYER").toUpperCase().replace(/ /g, "_")
  const uid = sessionUser.id || "pending"
  return {
    portal: "ad",
    user: {
      id: uid,
      email: sessionUser.email,
      role: roleUpper,
      displayName: sessionUser.name?.trim() || null,
      isPlatformOwner: sessionUser.isPlatformOwner === true,
    },
    organization: {
      athleticDepartmentId: null,
      departmentStatus: null,
      organizationIds: [],
      primaryOrganizationName: null,
    },
    school: { id: null, name: null },
    program: null,
    teamsSummary: [],
    scope: {
      userId: uid,
      profileSchoolId: null,
      profileRole: null,
      athleticDepartmentId: null,
      organizationIds: [],
      linkedProgramIds: [],
    },
    orFilter: null,
    teamsQueryError: null,
    adPortalAccess: { mode: "none", footballProgramIds: [], teamQuery: "department" },
    flags: {
      tabVisibility: getAdPortalTabVisibility({
        state: "no_ad_access",
        programId: null,
        primaryTeamId: null,
        departmentOwnerUserId: null,
        isDepartmentAthleticDirector: false,
      }),
      canPerformDepartmentOwnerActions: false,
      accessState: "no_ad_access",
      programId: null,
      primaryTeamId: null,
    },
    generatedAt: new Date().toISOString(),
  }
}

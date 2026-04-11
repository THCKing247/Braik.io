/** Admin Athletic Departments / Schools API + UI types. */

export type AthleticDepartmentListRow = {
  id: string
  schoolName: string
  organizationSummary: string | null
  teamCount: number
  teamsAllowed: number
  assistantCoachesAllowed: number
  videoFeatureEnabled: boolean
  /** School (AD) master toggle for Coach B+ (actions + voice). */
  coachBPlusFeatureEnabled: boolean
  totalUsers: number
  status: string
}

export type AthleticDepartmentDetailOverview = {
  id: string
  schoolName: string
  schoolId: string
  teamsAllowed: number
  assistantCoachesAllowed: number
  videoFeatureEnabled: boolean
  coachBPlusFeatureEnabled: boolean
  activeTeamCount: number
  assistantCoachUsageCount: number
  organizationNames: string[]
}

export type AthleticDepartmentTeamRow = {
  id: string
  name: string
  sport: string | null
  level: string | null
  headCoachName: string | null
  assistantCoachCount: number
  teamStatus: string
  /** Team toggle (may be on while product is off if school/org is off). */
  videoFeatureEnabled: boolean
  /** Organization (program) video flag when linked; null if no program/org. */
  organizationVideoEnabled: boolean | null
  /** School AD ∧ org (if any) ∧ team — matches product gate. */
  videoEffectiveEnabled: boolean
  /** Team-level Coach B+ flag. */
  coachBPlusFeatureEnabled: boolean
  organizationCoachBPlusEnabled: boolean | null
  /** AD ∧ org (if any) ∧ team — matches Coach B+ product gate. */
  coachBPlusEffectiveEnabled: boolean
}

export type AthleticDepartmentUserRow = {
  id: string
  name: string | null
  email: string | null
  role: string
  teamLabels: string
  status: string
  lastLoginAt: string | null
}

export type PatchAthleticDepartmentBody = {
  teams_allowed?: number
  assistant_coaches_allowed?: number
  video_clips_enabled?: boolean
  coach_b_plus_enabled?: boolean
  confirm_reduce_teams_below_active?: boolean
  confirm_reduce_assistants_below_usage?: boolean
}

export type PatchAthleticDepartmentTeamBody = {
  video_clips_enabled?: boolean
  coach_b_plus_enabled?: boolean
}

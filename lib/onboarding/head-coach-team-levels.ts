/**
 * Team levels to provision for a new head-coach program at signup.
 * Keep in sync with /api/onboarding teamLevels behavior where possible.
 */

export type ProgramTeamLevel = "varsity" | "jv" | "freshman"

/**
 * Football high school / collegiate programs typically run Varsity + JV + Freshman.
 * Other sports or youth programs default to Varsity only to avoid empty teams.
 */
export function headCoachSignupTeamLevels(
  sport: string | null | undefined,
  programType: string | null | undefined
): ProgramTeamLevel[] {
  const s = (sport ?? "").toLowerCase().trim()
  const p = (programType ?? "").toLowerCase().trim().replace(/_/g, "-")
  if (s === "football" && (p === "high-school" || p === "collegiate")) {
    return ["varsity", "jv", "freshman"]
  }
  return ["varsity"]
}

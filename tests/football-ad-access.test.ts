import assert from "node:assert"
import {
  canAccessAdPortalRoutes,
  canPerformDepartmentOwnerActions,
  getAdPortalTabVisibility,
  isFootballProgramSport,
  type FootballAdAccessContext,
} from "@/lib/enforcement/football-ad-access"
import { mergeAdPortalScope, type AthleticDirectorScope } from "@/lib/ad-team-scope"

assert.strictEqual(isFootballProgramSport("football"), true)
assert.strictEqual(isFootballProgramSport(""), true)
assert.strictEqual(isFootballProgramSport(null), true)
assert.strictEqual(isFootballProgramSport("basketball"), false)

const fullAd: FootballAdAccessContext = {
  state: "full_owner_ad",
  programId: null,
  primaryTeamId: null,
  departmentOwnerUserId: "u1",
  isDepartmentAthleticDirector: true,
}
assert.strictEqual(canAccessAdPortalRoutes(fullAd), true)
assert.strictEqual(canPerformDepartmentOwnerActions(fullAd), true)

const fullHc: FootballAdAccessContext = {
  state: "full_owner_ad",
  programId: "p1",
  primaryTeamId: "t1",
  departmentOwnerUserId: null,
  isDepartmentAthleticDirector: false,
}
assert.strictEqual(canAccessAdPortalRoutes(fullHc), true)
assert.strictEqual(canPerformDepartmentOwnerActions(fullHc), false)

const restricted: FootballAdAccessContext = {
  state: "restricted_football_ad",
  programId: "p1",
  primaryTeamId: "t1",
  departmentOwnerUserId: "ad1",
  isDepartmentAthleticDirector: false,
}
assert.strictEqual(canAccessAdPortalRoutes(restricted), true)
assert.strictEqual(canPerformDepartmentOwnerActions(restricted), false)

const tabsFull = getAdPortalTabVisibility(fullAd)
assert.strictEqual(tabsFull.showOverview, true)
assert.strictEqual(tabsFull.showSettings, true)
assert.strictEqual(tabsFull.homeHref, "/dashboard/ad")

const tabsRestricted = getAdPortalTabVisibility(restricted)
assert.strictEqual(tabsRestricted.showOverview, false)
assert.strictEqual(tabsRestricted.showSettings, false)
assert.strictEqual(tabsRestricted.showTeams, true)
assert.strictEqual(tabsRestricted.showCoaches, true)
assert.strictEqual(tabsRestricted.homeHref, "/dashboard/ad/teams")

const jvHc: FootballAdAccessContext = {
  state: "team_head_coach_only",
  programId: "p1",
  primaryTeamId: "t1",
  departmentOwnerUserId: null,
  isDepartmentAthleticDirector: false,
}
assert.strictEqual(canAccessAdPortalRoutes(jvHc), false)

const base: AthleticDirectorScope = {
  userId: "u",
  profileSchoolId: null,
  profileRole: "head_coach",
  athleticDepartmentId: null,
  organizationIds: [],
  linkedProgramIds: [],
}
const merged = mergeAdPortalScope(base, restricted)
assert.deepStrictEqual(merged.linkedProgramIds, ["p1"])
assert.strictEqual(mergeAdPortalScope(base, fullAd).linkedProgramIds.length, 0)

console.log("football-ad-access tests ok")

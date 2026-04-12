/**
 * Roster signup error parsing. Run: npx tsx tests/signup-route-error.test.ts
 */
import { parseRosterFullFromSupabaseError } from "../lib/auth/signup-route-error"

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

const r1 = parseRosterFullFromSupabaseError({ message: "BRAIK_ROSTER_FULL", code: "P0001" })
assert(r1.isRosterFull === true, "BRAIK_ROSTER_FULL in message")

const r2 = parseRosterFullFromSupabaseError({
  message: "duplicate key",
  code: "23505",
})
assert(r2.isRosterFull === false, "unrelated error")

const r3 = parseRosterFullFromSupabaseError({
  message: "error",
  code: "P0001",
})
assert(r3.isRosterFull === true, "P0001 code")

const r4 = parseRosterFullFromSupabaseError({
  message: "x",
  code: "P0001",
  details: '{"code":"ROSTER_FULL","scope":"team","limit":100,"current":100}',
})
assert(r4.isRosterFull === true && r4.limit === 100 && r4.current === 100, "json detail parse")

console.log("signup-route-error: ok")

// Integration (manual / CI with DB): two concurrent self-reg signups for the last roster slot —
// expect one HTTP success and one failure with code ROSTER_FULL; DB active count must stay <= limit.

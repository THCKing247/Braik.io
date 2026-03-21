/**
 * Phase 6: server-aligned rules for thread composition (parent/player/coach boundaries).
 * Run: npx tsx tests/messaging-thread-validation.test.ts
 */
import { validateThreadComposition, type UserRole, type UserType } from "../lib/enforcement/messaging-permissions"

function p(role: UserRole, type: UserType) {
  return { role, type }
}

const cases: Array<{
  name: string
  creator: UserRole
  participants: Array<{ role: UserRole; type: UserType }>
  expectValid: boolean
}> = [
  {
    name: "HC + parent + player + coach is allowed",
    creator: "HEAD_COACH",
    participants: [p("PARENT", "parent"), p("PLAYER", "player"), p("HEAD_COACH", "coach")],
    expectValid: true,
  },
  {
    name: "parent + player without coach is blocked",
    creator: "HEAD_COACH",
    participants: [p("PARENT", "parent"), p("PLAYER", "player")],
    expectValid: false,
  },
  {
    name: "parent cannot create multi-participant thread",
    creator: "PARENT",
    participants: [p("HEAD_COACH", "coach"), p("ASSISTANT_COACH", "coach")],
    expectValid: false,
  },
  {
    name: "AC cannot create parent-only thread",
    creator: "ASSISTANT_COACH",
    participants: [p("PARENT", "parent")],
    expectValid: false,
  },
  {
    name: "HC alone with assistant is allowed",
    creator: "HEAD_COACH",
    participants: [p("ASSISTANT_COACH", "coach")],
    expectValid: true,
  },
]

let failed = 0
for (const c of cases) {
  const r = validateThreadComposition(c.creator, c.participants)
  const ok = r.valid === c.expectValid
  if (!ok) {
    failed++
    console.error(`FAIL: ${c.name} — expected valid=${c.expectValid}, got ${r.valid}`, r.reason ?? "")
  } else {
    console.log(`ok: ${c.name}`)
  }
}

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`)
  process.exit(1)
}
console.log("\nAll messaging-thread-validation tests passed.")

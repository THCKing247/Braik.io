/**
 * Player team join code normalization (teams.player_code).
 * Run: npx tsx tests/join-code-normalize.test.ts
 */
import { normalizePlayerJoinCode } from "../lib/players/join-code-normalize"

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

const cases: Array<{ input: string; expected: string }> = [
  { input: "  ab12cd34  ", expected: "AB12CD34" },
  { input: "ab12 cd34", expected: "AB12CD34" },
  { input: "ab12\tcd34", expected: "AB12CD34" },
  { input: "", expected: "" },
]

for (const { input, expected } of cases) {
  const out = normalizePlayerJoinCode(input)
  assert(out === expected, `normalizePlayerJoinCode(${JSON.stringify(input)}) => ${JSON.stringify(out)}, want ${JSON.stringify(expected)}`)
}

console.log("join-code-normalize: ok", cases.length, "cases")

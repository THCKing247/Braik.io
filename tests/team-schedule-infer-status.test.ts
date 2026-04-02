/**
 * inferScheduleStatus + parseGameNumericField edge cases.
 * Run: npx tsx tests/team-schedule-infer-status.test.ts
 */
import {
  inferScheduleStatus,
  parseGameNumericField,
  type TeamGameRow,
} from "../lib/team-schedule-games"

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("Fail:", msg)
    process.exit(1)
  }
}

function baseRow(over: Partial<TeamGameRow> = {}): TeamGameRow {
  return {
    id: "1",
    opponent: "X",
    gameDate: "2025-09-01T12:00:00.000Z",
    location: "Home",
    gameType: "regular",
    result: null,
    notes: null,
    seasonYear: 2025,
    ...over,
  }
}

function run() {
  assert(parseGameNumericField(null) === null, "null")
  assert(parseGameNumericField(undefined) === null, "undefined")
  assert(parseGameNumericField("") === null, "empty string")
  assert(parseGameNumericField("  ") === null, "whitespace string")
  assert(parseGameNumericField("14") === 14, "numeric string")
  assert(parseGameNumericField(0) === 0, "zero")
  assert(parseGameNumericField("0") === 0, "zero string")
  assert(parseGameNumericField(NaN) === null, "NaN")

  assert(inferScheduleStatus(baseRow({ teamScore: 21, opponentScore: 14 })) === "completed", "both scores")
  assert(
    inferScheduleStatus(baseRow({ teamScore: "21" as unknown as number, opponentScore: 14 })) === "completed",
    "coerced string scores via row type fuzz"
  )
  assert(inferScheduleStatus(baseRow({ result: "win" })) === "completed", "result only")
  assert(inferScheduleStatus(baseRow({ result: "W" })) === "completed", "W")
  assert(inferScheduleStatus(baseRow({ teamScore: 7, opponentScore: null })) === "scheduled", "one score null")

  console.log("All inferScheduleStatus tests passed.")
}

run()

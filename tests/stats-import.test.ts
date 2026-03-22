/**
 * Stats bulk import: CSV parsing, validation, merge logic.
 * Run: npx tsx tests/stats-import.test.ts
 */
import {
  parseCsvToRows,
  parseAndValidateStatsCsv,
  mergeStatsIntoSeasonStats,
  rowErrorsToCsv,
  seasonStatsEqualForImportKeys,
  STATS_IMPORT_HEADERS,
} from "../lib/stats-import"
import { STAT_DB_KEYS } from "../lib/stats-import-fields"

const HEADER = STATS_IMPORT_HEADERS.join(",")

/** Build one data row; omitted headers become blank cells (correct column alignment). */
function makeDataRow(cells: Record<string, string>): string {
  return STATS_IMPORT_HEADERS.map((h) => cells[h] ?? "").join(",")
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

function testBom() {
  const withBom =
    "\uFEFF" +
    HEADER +
    "\n" +
    makeDataRow({
      player_id: "abc",
      first_name: "John",
      last_name: "Doe",
      jersey_number: "12",
      position: "QB",
      games_played: "5",
      passing_yards: "100",
      passing_touchdowns: "2",
    })
  const { rows, errors } = parseAndValidateStatsCsv(withBom)
  assert(errors.length === 0, "BOM: expected no errors")
  assert(rows.length === 1, "BOM: expected one row")
  assert(rows[0].first_name === "John", "BOM: expected first_name John")
  console.log("  BOM: ok")
}

function testQuotedValues() {
  const id = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  const statsTail = STATS_IMPORT_HEADERS.slice(5).map((h) => {
    if (h === "games_played") return "5"
    if (h === "passing_yards") return "100"
    if (h === "passing_touchdowns") return "2"
    return ""
  })
  const csv = `${HEADER}\n"${id}","John, Jr.",Doe,12,QB,${statsTail.join(",")}`
  const { rows, errors } = parseAndValidateStatsCsv(csv)
  assert(errors.length === 0, "Quoted: expected no errors")
  assert(rows.length === 1, "Quoted: expected one row")
  assert(rows[0].first_name === "John, Jr.", "Quoted: expected first_name with comma")
  console.log("  Quoted values: ok")
}

function testBlankRows() {
  const csv =
    HEADER +
    "\n" +
    makeDataRow({
      first_name: "Jane",
      last_name: "Doe",
      jersey_number: "12",
      games_played: "1",
    }) +
    "\n\n" +
    makeDataRow({
      first_name: "Bob",
      last_name: "Smith",
      jersey_number: "5",
      games_played: "2",
    })
  const { rows, errors } = parseAndValidateStatsCsv(csv)
  assert(rows.length === 2, "Blank rows: expected two data rows")
  assert(rows[0].last_name === "Doe", "Blank rows: first row last_name")
  assert(rows[1].last_name === "Smith", "Blank rows: second row last_name")
  console.log("  Blank rows: ok")
}

function testWindowsLineEndings() {
  const csv =
    HEADER +
    "\r\n" +
    makeDataRow({
      first_name: "John",
      last_name: "Doe",
      jersey_number: "7",
      games_played: "3",
    })
  const { rows, errors } = parseAndValidateStatsCsv(csv)
  assert(errors.length === 0, "CRLF: expected no errors")
  assert(rows.length === 1, "CRLF: expected one row")
  assert(rows[0].jersey_number === "7", "CRLF: jersey 7")
  console.log("  Windows line endings: ok")
}

function testValidPlayerId() {
  const id = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  const csv =
    HEADER +
    "\n" +
    makeDataRow({
      player_id: id,
      first_name: "John",
      last_name: "Doe",
      jersey_number: "12",
      position: "QB",
      games_played: "5",
      passing_yards: "100",
      passing_touchdowns: "2",
      int_thrown: "1",
      rushing_yards: "10",
    })
  const { rows, errors } = parseAndValidateStatsCsv(csv)
  assert(errors.length === 0, "Valid player_id: no errors")
  assert(rows[0].player_id === id, "Valid player_id: id preserved")
  assert(rows[0].stats.passing_yards === 100, "Valid player_id: passing_yards")
  assert(rows[0].stats.int_thrown === 1, "Valid player_id: int_thrown")
  console.log("  Valid player_id: ok")
}

function testValidNameJersey() {
  const csv =
    HEADER +
    "\n" +
    makeDataRow({
      first_name: "Alice",
      last_name: "Smith",
      jersey_number: "99",
      position: "WR",
      games_played: "10",
      receiving_yards: "500",
      receiving_touchdowns: "5",
    })
  const { rows, errors } = parseAndValidateStatsCsv(csv)
  assert(errors.length === 0, "Valid name+jersey: no errors")
  assert(
    rows[0].first_name === "Alice" && rows[0].last_name === "Smith" && rows[0].jersey_number === "99",
    "Valid name+jersey: fields"
  )
  assert(rows[0].stats.receiving_yards === 500, "Valid name+jersey: receiving_yards")
  console.log("  Valid name+jersey: ok")
}

function testMissingJerseyWhenNoPlayerId() {
  const csv =
    HEADER +
    "\n" +
    makeDataRow({
      first_name: "Alice",
      last_name: "Smith",
      position: "WR",
      games_played: "1",
    })
  const { rows, errors } = parseAndValidateStatsCsv(csv)
  assert(errors.length >= 1, "Missing jersey: expected row error")
  assert(
    rows.length === 0 || errors.some((e) => e.message.includes("jersey") || e.message.includes("Missing")),
    "Missing jersey: message"
  )
  console.log("  Missing jersey when no player_id: ok")
}

function testInvalidInteger() {
  const csv =
    HEADER +
    "\n" +
    makeDataRow({
      first_name: "John",
      last_name: "Doe",
      jersey_number: "12",
      games_played: "1",
      passing_yards: "abc",
    })
  const { rows, errors } = parseAndValidateStatsCsv(csv)
  assert(errors.length >= 1, "Invalid integer: expected error")
  assert(errors.some((e) => e.message.includes("non-negative integer")), "Invalid integer: message")
  console.log("  Invalid integer: ok")
}

function testBlankStatOmitted() {
  const csv =
    HEADER +
    "\n" +
    makeDataRow({
      first_name: "John",
      last_name: "Doe",
      jersey_number: "12",
      games_played: "1",
      passing_touchdowns: "2",
    })
  const { rows, errors } = parseAndValidateStatsCsv(csv)
  assert(errors.length === 0, "Blank stat: no errors")
  assert(rows[0].stats.passing_touchdowns === 2, "Blank stat: passing_touchdowns set")
  assert(!("passing_yards" in rows[0].stats), "Blank stat: passing_yards omitted")
  console.log("  Blank stat omitted: ok")
}

function testZeroStatValue() {
  const csv =
    HEADER +
    "\n" +
    makeDataRow({
      first_name: "John",
      last_name: "Doe",
      jersey_number: "12",
      games_played: "5",
      passing_yards: "0",
    })
  const { rows, errors } = parseAndValidateStatsCsv(csv)
  assert(errors.length === 0, "Zero stat: no errors")
  assert(rows[0].stats.passing_yards === 0, "Zero stat: passing_yards 0")
  assert(rows[0].stats.games_played === 5, "Zero stat: games_played 5")
  console.log("  Zero stat value: ok")
}

function testScientificNotationRejected() {
  const csv =
    HEADER +
    "\n" +
    makeDataRow({
      first_name: "John",
      last_name: "Doe",
      jersey_number: "12",
      games_played: "1",
      passing_yards: "1e2",
    })
  const { rows, errors } = parseAndValidateStatsCsv(csv)
  assert(errors.length >= 1, "Scientific: expected error")
  assert(errors.some((e) => e.message.includes("non-negative integer")), "Scientific: message")
  console.log("  Scientific notation rejected: ok")
}

function testNegativeRejected() {
  const csv =
    HEADER +
    "\n" +
    makeDataRow({
      first_name: "John",
      last_name: "Doe",
      jersey_number: "12",
      games_played: "1",
      passing_yards: "-5",
    })
  const { rows, errors } = parseAndValidateStatsCsv(csv)
  assert(errors.length >= 1, "Negative: expected error")
  assert(errors.some((e) => e.message.includes("non-negative")), "Negative: message")
  console.log("  Negative rejected: ok")
}

function testHalfSacksAndTflAccepted() {
  const csv =
    HEADER +
    "\n" +
    makeDataRow({
      first_name: "John",
      last_name: "Doe",
      jersey_number: "12",
      games_played: "1",
      sacks: "0.5",
      tackles_for_loss: "1.5",
    })
  const { rows, errors } = parseAndValidateStatsCsv(csv)
  assert(errors.length === 0, "Half sacks/TFL: expected no errors")
  assert(rows.length === 1, "Half sacks/TFL: one row")
  assert(rows[0].stats.sacks === 0.5, "Half sacks: value")
  assert(rows[0].stats.tackles_for_loss === 1.5, "TFL: decimal value")
  console.log("  Half sacks / TFL accepted: ok")
}

function testDecimalRejectedForIntegerStat() {
  const csv =
    HEADER +
    "\n" +
    makeDataRow({
      first_name: "John",
      last_name: "Doe",
      jersey_number: "12",
      games_played: "1",
      passing_yards: "100.5",
    })
  const { rows, errors } = parseAndValidateStatsCsv(csv)
  assert(errors.length >= 1, "Decimal on int stat: expected error")
  assert(errors.some((e) => e.message.includes("non-negative integer")), "Decimal on int stat: message")
  console.log("  Decimal rejected for integer stat: ok")
}

function testMergePreservesOtherKeys() {
  const existing = { passing_yards: 100, receptions: 5, custom_key: "keep" } as Record<string, unknown>
  const fromRow = { passing_yards: 200, passing_touchdowns: 3 }
  const merged = mergeStatsIntoSeasonStats(existing, fromRow)
  assert(merged.passing_yards === 200, "Merge: passing_yards updated")
  assert(merged.passing_touchdowns === 3, "Merge: passing_touchdowns set")
  assert(merged.receptions === 5, "Merge: receptions preserved")
  assert(merged.custom_key === "keep", "Merge: custom_key preserved")
  console.log("  Merge preserves other keys: ok")
}

function testTrailingNewline() {
  const csv = HEADER + "\na,b,c,1,,1\n"
  const rows = parseCsvToRows(csv)
  assert(rows.length === 2, "Trailing newline: two rows (header + data)")
  console.log("  Trailing newline: ok")
}

function testMissingRequiredColumn() {
  const badHeader = "player_id,first_name\nx,John"
  const { rows, errors } = parseAndValidateStatsCsv(badHeader)
  assert(errors.length >= 1, "Missing column: expected error")
  assert(
    errors.some((e) => e.message.includes("last_name") || e.message.includes("Missing")),
    "Missing column: message"
  )
  console.log("  Missing required column: ok")
}

function testEmptyFile() {
  const { rows, errors, dataRowCount } = parseAndValidateStatsCsv("")
  assert(rows.length === 0, "Empty: no rows")
  assert(dataRowCount === 0, "Empty: dataRowCount 0")
  assert(errors.length >= 1, "Empty: has error")
  assert(errors.some((e) => e.message.includes("empty") || e.message.includes("header")), "Empty: message")
  console.log("  Empty file: ok")
}

function testRowErrorsToCsv() {
  const errors = [
    { row: 2, message: "No matching player" },
    { row: 3, field: "passing_yards", message: "must be a non-negative integer" },
  ]
  const csv = rowErrorsToCsv(errors)
  assert(csv.startsWith("row,field,message"), "Error CSV: header")
  assert(csv.includes("2,"), "Error CSV: row 2")
  assert(csv.includes("passing_yards"), "Error CSV: field")
  console.log("  rowErrorsToCsv: ok")
}

function testSeasonStatsEqualForImportKeys() {
  const a = { passing_yards: 100, passing_touchdowns: 2 }
  const b = { passing_yards: 100, passing_touchdowns: 2 }
  assert(
    seasonStatsEqualForImportKeys(a, b, ["passing_yards", "passing_touchdowns"]) === true,
    "Equal: same"
  )
  const c = { passing_yards: 99, passing_touchdowns: 2 }
  assert(
    seasonStatsEqualForImportKeys(a, c, ["passing_yards", "passing_touchdowns"]) === false,
    "Equal: diff"
  )
  assert(seasonStatsEqualForImportKeys(null, {}, STAT_DB_KEYS as string[]) === true, "Equal: empty")
  console.log("  seasonStatsEqualForImportKeys: ok")
}

function run() {
  console.log("Stats import tests\n")
  testBom()
  testQuotedValues()
  testBlankRows()
  testWindowsLineEndings()
  testTrailingNewline()
  testValidPlayerId()
  testValidNameJersey()
  testMissingJerseyWhenNoPlayerId()
  testMissingRequiredColumn()
  testEmptyFile()
  testRowErrorsToCsv()
  testSeasonStatsEqualForImportKeys()
  testInvalidInteger()
  testBlankStatOmitted()
  testZeroStatValue()
  testScientificNotationRejected()
  testNegativeRejected()
  testHalfSacksAndTflAccepted()
  testDecimalRejectedForIntegerStat()
  testMergePreservesOtherKeys()
  console.log("\nAll stats-import tests passed.")
}

run()

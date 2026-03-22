/**
 * Bulk player stats import: CSV parsing, validation, and season_stats merge.
 * Used by POST /api/stats/import. Multi-tenant safe; team-scoped only.
 * Stat field names and DB keys come from lib/stats-import-fields.ts.
 *
 * Why blank stats do not overwrite: We only add to the merged object the keys that were
 * present (non-blank) in the CSV row. So a blank cell is never sent to mergeStatsIntoSeasonStats,
 * and the existing season_stats value for that key is left unchanged.
 *
 * Template column order: Must stay in sync with STATS_IMPORT_HEADERS in stats-import-fields.ts
 * so that template downloads and CSV validation use the same column order and names.
 */
import { STATS_IMPORT_HEADERS, CSV_HEADER_TO_DB_KEY } from "./stats-import-fields"

export { STATS_IMPORT_HEADERS }

export type ParsedStatsRow = {
  rowIndex: number
  player_id: string
  first_name: string
  last_name: string
  jersey_number: string
  position: string
  /** Keys are DB field names (e.g. int_thrown); values are integers. Only present if cell was non-blank. */
  stats: Record<string, number>
}

export type RowError = { row: number; field?: string; message: string }

/** Build a CSV string for row errors (row, field, message). Used for "Download errors" in UI. */
export function rowErrorsToCsv(errors: RowError[]): string {
  const header = "row,field,message"
  const rows = errors.map((e) => {
    const field = e.field ?? ""
    const message = (e.message ?? "").replace(/"/g, '""')
    return `${e.row},"${field}","${message}"`
  })
  return [header, ...rows].join("\n")
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Strip UTF-8 BOM if present so spreadsheet exports parse correctly. */
export function stripBom(text: string): string {
  if (text.charCodeAt(0) === 0xfeff) return text.slice(1)
  return text
}

/**
 * Simple CSV parse: split by newlines, then by comma (respecting quoted fields).
 * Handles ", "", \r\n, blank rows in the middle. Caller should strip BOM before passing.
 */
export function parseCsvToRows(csvText: string): string[][] {
  const rows: string[][] = []
  let current: string[] = []
  let field = ""
  let inQuotes = false
  for (let i = 0; i < csvText.length; i++) {
    const c = csvText[i]
    if (inQuotes) {
      if (c === '"') {
        if (csvText[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
      continue
    }
    if (c === '"') {
      inQuotes = true
      continue
    }
    if (c === ",") {
      current.push(field.trim())
      field = ""
      continue
    }
    if (c === "\n" || c === "\r") {
      if (c === "\r" && csvText[i + 1] === "\n") i++
      current.push(field.trim())
      field = ""
      if (current.some((cell) => cell.length > 0)) rows.push(current)
      current = []
      continue
    }
    field += c
  }
  current.push(field.trim())
  if (current.some((cell) => cell.length > 0)) rows.push(current)
  return rows
}

/** Normalize header: lowercase, trim. Accept both interceptions_thrown and int_thrown. */
function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_")
}

/**
 * Parse a stat cell to a non-negative integer. Rejects decimals, scientific notation, negatives.
 * Returns null if invalid; error message for row errors.
 */
function parseStatInteger(value: string, rowIndex: number, fieldName: string): { value: number } | { error: RowError } {
  const trimmed = value.trim()
  if (trimmed === "") return { value: 0 }
  if (/[eE]/.test(trimmed)) {
    return { error: { row: rowIndex, field: fieldName, message: `${fieldName} must be a non-negative integer` } }
  }
  const num = Number(trimmed)
  if (!Number.isFinite(num)) {
    return { error: { row: rowIndex, field: fieldName, message: `${fieldName} must be a non-negative integer` } }
  }
  if (num < 0) {
    return { error: { row: rowIndex, field: fieldName, message: `${fieldName} must be a non-negative integer` } }
  }
  if (!Number.isInteger(num)) {
    return { error: { row: rowIndex, field: fieldName, message: `${fieldName} must be a non-negative integer` } }
  }
  return { value: num }
}

/**
 * Parse and validate CSV into typed rows.
 * - Each row must have either: valid player_id OR (first_name + last_name + jersey_number).
 * - Stat fields must be non-negative integers.
 * - Blank stat cells are omitted (leave existing); 0 is stored as 0.
 */
export function parseAndValidateStatsCsv(csvText: string): {
  rows: ParsedStatsRow[]
  errors: RowError[]
  headerRow?: string[]
  dataRowCount: number
} {
  const errors: RowError[] = []
  const normalized = stripBom(csvText)
  const allRows = parseCsvToRows(normalized)
  const dataRowCount = Math.max(0, allRows.length - 1)
  if (allRows.length === 0) {
    return { rows: [], errors: [{ row: 1, message: "CSV is empty or has no header" }], headerRow: undefined, dataRowCount: 0 }
  }

  const headerRow = allRows[0]
  const headerMap = new Map<string, number>()
  headerRow.forEach((h, i) => {
    const n = normalizeHeader(h)
    if (!headerMap.has(n)) headerMap.set(n, i)
  })

  const requiredHeaders = ["first_name", "last_name"]
  for (const r of requiredHeaders) {
    if (!headerMap.has(r)) {
      return {
        rows: [],
        errors: [{ row: 1, message: `Missing required column: ${r}` }],
        headerRow,
        dataRowCount,
      }
    }
  }

  const get = (row: string[], col: string): string => {
    const i = headerMap.get(normalizeHeader(col))
    return i !== undefined ? (row[i] ?? "").trim() : ""
  }

  const rows: ParsedStatsRow[] = []
  for (let r = 1; r < allRows.length; r++) {
    const raw = allRows[r]
    const rowIndex = r + 1
    const player_id = get(raw, "player_id").trim()
    const first_name = get(raw, "first_name")
    const last_name = get(raw, "last_name")
    const jersey_number = get(raw, "jersey_number")
    const position = get(raw, "position")

    const hasValidPlayerId = player_id.length > 0 && UUID_REGEX.test(player_id)
    const hasNameJersey = first_name.length > 0 && last_name.length > 0 && jersey_number.length > 0

    if (!hasValidPlayerId && !hasNameJersey) {
      const missing: string[] = []
      if (!hasValidPlayerId) {
        if (first_name.length === 0) missing.push("first_name")
        if (last_name.length === 0) missing.push("last_name")
        if (jersey_number.length === 0) missing.push("jersey_number")
      }
      errors.push({
        row: rowIndex,
        message: missing.length
          ? `Row must have either a valid player_id or first_name, last_name, and jersey_number. Missing: ${missing.join(", ")}`
          : "Row must have either a valid player_id or first_name, last_name, and jersey_number.",
      })
      continue
    }

    const stats: Record<string, number> = {}
    for (const [csvCol, dbKey] of Object.entries(CSV_HEADER_TO_DB_KEY)) {
      const idx = headerMap.get(normalizeHeader(csvCol))
      if (idx === undefined) continue
      const cell = (raw[idx] ?? "").trim()
      if (cell === "") continue
      const parsed = parseStatInteger(cell, rowIndex, csvCol)
      if ("error" in parsed) {
        errors.push(parsed.error)
        continue
      }
      stats[dbKey] = parsed.value
    }

    rows.push({
      rowIndex,
      player_id,
      first_name,
      last_name,
      jersey_number,
      position,
      stats,
    })
  }

  return { rows, errors, headerRow, dataRowCount }
}

export type ParsedWeeklyImportRow = {
  rowIndex: number
  player_id: string
  first_name: string
  last_name: string
  jersey_number: string
  position: string
  season_year: number | null
  week_number: number | null
  game_id: string | null
  opponent: string | null
  game_date: string | null
  stats: Record<string, number>
}

/**
 * Weekly/game CSV: same player matching as season import, plus season_year, week_number, game_id, opponent, game_date.
 */
export function parseAndValidateWeeklyStatsCsv(csvText: string): {
  rows: ParsedWeeklyImportRow[]
  errors: RowError[]
  headerRow?: string[]
  dataRowCount: number
} {
  const errors: RowError[] = []
  const normalized = stripBom(csvText)
  const allRows = parseCsvToRows(normalized)
  const dataRowCount = Math.max(0, allRows.length - 1)
  if (allRows.length === 0) {
    return { rows: [], errors: [{ row: 1, message: "CSV is empty or has no header" }], headerRow: undefined, dataRowCount: 0 }
  }

  const headerRow = allRows[0]
  const headerMap = new Map<string, number>()
  headerRow.forEach((h, i) => {
    const n = normalizeHeader(h)
    if (!headerMap.has(n)) headerMap.set(n, i)
  })

  const requiredHeaders = ["first_name", "last_name"]
  for (const r of requiredHeaders) {
    if (!headerMap.has(r)) {
      return {
        rows: [],
        errors: [{ row: 1, message: `Missing required column: ${r}` }],
        headerRow,
        dataRowCount,
      }
    }
  }

  const get = (row: string[], col: string): string => {
    const i = headerMap.get(normalizeHeader(col))
    return i !== undefined ? (row[i] ?? "").trim() : ""
  }

  const parseOptionalYear = (raw: string, rowIndex: number, field: string): number | null | RowError => {
    const t = raw.trim()
    if (t === "") return null
    const n = parseInt(t, 10)
    if (!Number.isFinite(n)) return { row: rowIndex, field, message: `${field} must be an integer year` }
    return n
  }

  const parseOptionalWeek = (raw: string, rowIndex: number, field: string): number | null | RowError => {
    const t = raw.trim()
    if (t === "") return null
    const n = parseInt(t, 10)
    if (!Number.isFinite(n) || n < 0) return { row: rowIndex, field, message: `${field} must be a non-negative integer` }
    return n
  }

  const rows: ParsedWeeklyImportRow[] = []
  for (let r = 1; r < allRows.length; r++) {
    const raw = allRows[r]
    const rowIndex = r + 1
    const player_id = get(raw, "player_id").trim()
    const first_name = get(raw, "first_name")
    const last_name = get(raw, "last_name")
    const jersey_number = get(raw, "jersey_number")
    const position = get(raw, "position")

    const hasValidPlayerId = player_id.length > 0 && UUID_REGEX.test(player_id)
    const hasNameJersey = first_name.length > 0 && last_name.length > 0 && jersey_number.length > 0

    if (!hasValidPlayerId && !hasNameJersey) {
      const missing: string[] = []
      if (!hasValidPlayerId) {
        if (first_name.length === 0) missing.push("first_name")
        if (last_name.length === 0) missing.push("last_name")
        if (jersey_number.length === 0) missing.push("jersey_number")
      }
      errors.push({
        row: rowIndex,
        message: missing.length
          ? `Row must have either a valid player_id or first_name, last_name, and jersey_number. Missing: ${missing.join(", ")}`
          : "Row must have either a valid player_id or first_name, last_name, and jersey_number.",
      })
      continue
    }

    const seasonRaw = get(raw, "season_year")
    const weekRaw = get(raw, "week_number")
    const gameIdRaw = get(raw, "game_id").trim()
    const opponent = get(raw, "opponent").trim() || null
    const gameDateRaw = get(raw, "game_date").trim()

    const sy = parseOptionalYear(seasonRaw, rowIndex, "season_year")
    if (typeof sy === "object" && sy !== null && "row" in sy) {
      errors.push(sy)
      continue
    }
    const wn = parseOptionalWeek(weekRaw, rowIndex, "week_number")
    if (typeof wn === "object" && wn !== null && "row" in wn) {
      errors.push(wn)
      continue
    }

    let game_id: string | null = null
    if (gameIdRaw !== "") {
      if (!UUID_REGEX.test(gameIdRaw)) {
        errors.push({ row: rowIndex, field: "game_id", message: "game_id must be a valid UUID or blank" })
        continue
      }
      game_id = gameIdRaw
    }

    let game_date: string | null = null
    if (gameDateRaw !== "") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(gameDateRaw)) {
        errors.push({ row: rowIndex, field: "game_date", message: "game_date must be YYYY-MM-DD or blank" })
        continue
      }
      game_date = gameDateRaw
    }

    const stats: Record<string, number> = {}
    for (const [csvCol, dbKey] of Object.entries(CSV_HEADER_TO_DB_KEY)) {
      const idx = headerMap.get(normalizeHeader(csvCol))
      if (idx === undefined) continue
      const cell = (raw[idx] ?? "").trim()
      if (cell === "") continue
      const parsed = parseStatInteger(cell, rowIndex, csvCol)
      if ("error" in parsed) {
        errors.push(parsed.error)
        continue
      }
      stats[dbKey] = parsed.value
    }

    if (Object.keys(stats).length === 0) {
      errors.push({ row: rowIndex, message: "At least one stat column must be non-blank" })
      continue
    }

    rows.push({
      rowIndex,
      player_id,
      first_name,
      last_name,
      jersey_number,
      position,
      season_year: sy as number | null,
      week_number: wn as number | null,
      game_id,
      opponent,
      game_date,
      stats,
    })
  }

  return { rows, errors, headerRow, dataRowCount }
}

/**
 * Merge imported stat values into existing season_stats.
 * - Only keys in CSV_HEADER_TO_DB_KEY values are updated.
 * - Blank/absent in parsed row = leave existing value.
 * - Present in parsed row (including 0) = set that value.
 * - Preserve any other keys already in season_stats (e.g. receptions, custom).
 */
export function mergeStatsIntoSeasonStats(
  existing: Record<string, unknown> | null | undefined,
  fromRow: Record<string, number>
): Record<string, unknown> {
  const out =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? ({ ...existing } as Record<string, unknown>)
      : {}
  for (const [key, value] of Object.entries(fromRow)) {
    out[key] = value
  }
  return out
}

/**
 * True if the stat keys we write have the same values in a and b.
 * Used to skip no-op updates (same-value detection): avoids DB write when imported values
 * match current season_stats, and keeps noChangeReason accurate for coaches.
 */
export function seasonStatsEqualForImportKeys(
  a: Record<string, unknown> | null | undefined,
  b: Record<string, unknown> | null | undefined,
  keys: string[]
): boolean {
  const ax = a && typeof a === "object" && !Array.isArray(a) ? a : {}
  const bx = b && typeof b === "object" && !Array.isArray(b) ? b : {}
  for (const k of keys) {
    const va = ax[k]
    const vb = bx[k]
    if (va !== vb && (va == null || vb == null || Number(va) !== Number(vb))) return false
  }
  return true
}

export { CSV_HEADER_TO_DB_KEY as SEASON_STAT_COLUMNS }

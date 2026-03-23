/**
 * Parse CSV for bulk game import (Schedule tab).
 * Expected header (case-insensitive, extra columns ignored):
 * opponent, game_date, location (optional), game_type (optional), conference_game (optional), notes (optional)
 */

export type ParsedGameImportRow = {
  opponent: string
  gameDateIso: string
  location: string | null
  gameType: string | null
  conferenceGame: boolean
  notes: string | null
}

export type GameImportParseResult = {
  rows: ParsedGameImportRow[]
  errors: Array<{ row: number; message: string }>
}

const ALLOWED_TYPES = new Set(["regular", "playoff", "scrimmage", "tournament"])

function parseBool(s: string): boolean {
  const x = s.trim().toLowerCase()
  return x === "1" || x === "true" || x === "yes" || x === "y"
}

function parseGameDate(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  const ms = Date.parse(t)
  if (!Number.isFinite(ms)) return null
  return new Date(ms).toISOString()
}

export function parseGamesScheduleCsv(text: string): GameImportParseResult {
  const errors: Array<{ row: number; message: string }> = []
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  if (lines.length < 2) {
    return { rows: [], errors: [{ row: 0, message: "CSV must include a header row and at least one data row." }] }
  }

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase())
  const idx = (name: string) => header.indexOf(name)

  const iOpp = idx("opponent")
  const iDate = idx("game_date")
  if (iOpp < 0 || iDate < 0) {
    return {
      rows: [],
      errors: [{ row: 1, message: "Header must include columns: opponent, game_date" }],
    }
  }

  const iLoc = idx("location")
  const iType = idx("game_type")
  const iConf = idx("conference_game")
  const iNotes = idx("notes")

  const rows: ParsedGameImportRow[] = []

  for (let r = 1; r < lines.length; r++) {
    const line = lines[r]
    const cells = splitCsvLine(line)
    const opponent = (cells[iOpp] ?? "").trim()
    const dateRaw = (cells[iDate] ?? "").trim()
    const location = iLoc >= 0 ? (cells[iLoc] ?? "").trim() || null : null
    const gtRaw = iType >= 0 ? (cells[iType] ?? "").trim() : ""
    const confRaw = iConf >= 0 ? (cells[iConf] ?? "").trim() : ""
    const notes = iNotes >= 0 ? (cells[iNotes] ?? "").trim() || null : null

    const rowNum = r + 1
    if (!opponent) {
      errors.push({ row: rowNum, message: "Missing opponent" })
      continue
    }
    const gameDateIso = parseGameDate(dateRaw)
    if (!gameDateIso) {
      errors.push({ row: rowNum, message: `Invalid game_date: "${dateRaw}"` })
      continue
    }
    let gameType: string | null = gtRaw ? gtRaw.toLowerCase() : null
    if (gameType && !ALLOWED_TYPES.has(gameType)) {
      errors.push({ row: rowNum, message: `Invalid game_type: ${gameType}` })
      continue
    }
    if (!gameType) gameType = "regular"

    rows.push({
      opponent,
      gameDateIso,
      location,
      gameType,
      conferenceGame: confRaw ? parseBool(confRaw) : false,
      notes,
    })
  }

  return { rows, errors }
}

/** Minimal CSV split — handles quoted fields with commas. */
function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ""
  let inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      inQ = !inQ
      continue
    }
    if (c === "," && !inQ) {
      out.push(cur)
      cur = ""
      continue
    }
    cur += c
  }
  out.push(cur)
  return out
}

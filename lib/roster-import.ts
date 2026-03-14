/**
 * Roster CSV import: parsing, normalization, and column mapping.
 * Uses the same quoted-CSV parser as stats import for consistency.
 */
import { parseCsvToRows } from "./stats-import"

/** Expected CSV columns (case-insensitive, flexible header names). */
const ROSTER_HEADER_ALIASES: Record<string, string[]> = {
  first_name: ["first name", "firstname", "first"],
  last_name: ["last name", "lastname", "last"],
  grade: ["grade"],
  jersey_number: ["jersey number", "jersey", "number"],
  position_group: ["position", "position group", "pos"],
  email: ["email"],
  notes: ["notes"],
  weight: ["weight"],
  height: ["height"],
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ")
}

/** Map header row (array of cell strings) to column index for each field. */
function mapHeaders(headerCells: string[]): Map<string, number> {
  const map = new Map<string, number>()
  for (let i = 0; i < headerCells.length; i++) {
    const normalized = normalizeHeader(headerCells[i])
    for (const [field, aliases] of Object.entries(ROSTER_HEADER_ALIASES)) {
      if (aliases.some((a) => normalized.includes(a) || a.includes(normalized))) {
        if (!map.has(field)) map.set(field, i)
        break
      }
    }
  }
  return map
}

/** Strip UTF-8 BOM so spreadsheet exports parse correctly. */
function stripBom(text: string): string {
  if (text.length > 0 && text.charCodeAt(0) === 0xfeff) return text.slice(1)
  return text
}

export type ParsedRosterRow = {
  rowIndex: number
  first_name: string
  last_name: string
  grade: number | null
  jersey_number: number | null
  position_group: string | null
  email: string | null
  notes: string | null
  weight: number | null
  height: string | null
}

export type RosterParseError = { row: number; message: string }

export type RosterParseResult = {
  rows: ParsedRosterRow[]
  errors: RosterParseError[]
  hasHeader: boolean
}

/**
 * Parse roster CSV into normalized rows.
 * Handles quoted fields (commas in notes/names). Header row detected by common column names.
 */
export function parseRosterCsv(csvText: string): RosterParseResult {
  const errors: RosterParseError[] = []
  const normalized = stripBom(csvText)
  const rawRows = parseCsvToRows(normalized)
  if (rawRows.length === 0) {
    return { rows: [], errors: [{ row: 1, message: "CSV is empty or has no data" }], hasHeader: false }
  }

  const firstRow = rawRows[0]
  const firstRowLower = firstRow.map((c) => normalizeHeader(c)).join(" ")
  const hasHeader =
    firstRowLower.includes("first") ||
    firstRowLower.includes("name") ||
    firstRowLower.includes("grade") ||
    firstRowLower.includes("jersey") ||
    firstRowLower.includes("position") ||
    firstRowLower.includes("email")
  const dataRows = hasHeader ? rawRows.slice(1) : rawRows
  const headerRow = hasHeader ? firstRow : null
  const headerMap = headerRow ? mapHeaders(headerRow) : null
  // Position-based columns when no header: First Name, Last Name, Grade, Jersey Number, Position, Email, Notes, Weight, Height
  const positionIndices: Record<string, number> = {
    first_name: 0,
    last_name: 1,
    grade: 2,
    jersey_number: 3,
    position_group: 4,
    email: 5,
    notes: 6,
    weight: 7,
    height: 8,
  }

  const rows: ParsedRosterRow[] = []
  const startRowIndex = hasHeader ? 2 : 1 // 1-based for user-facing messages

  for (let i = 0; i < dataRows.length; i++) {
    const cells = dataRows[i]
    const rowNum = startRowIndex + i
    const get = (field: string): string => {
      const idx = headerMap?.get(field) ?? positionIndices[field]
      if (idx == null || idx >= cells.length) return ""
      const v = cells[idx]?.trim() ?? ""
      return v
    }
    const firstName = get("first_name").trim()
    const lastName = get("last_name").trim()
    if (!firstName || !lastName) {
      if (cells.some((c) => c.trim().length > 0)) {
        errors.push({ row: rowNum, message: "First name and last name are required" })
      }
      continue
    }

    const gradeRaw = get("grade").trim()
    const grade = gradeRaw ? parseInt(gradeRaw, 10) : null
    const jerseyRaw = get("jersey_number").trim()
    const jerseyNumber = jerseyRaw ? parseInt(jerseyRaw, 10) : null
    const positionGroup = get("position_group").trim()
    const emailRaw = get("email").trim()
    const email = emailRaw ? emailRaw.toLowerCase() : null
    const notes = get("notes").trim() || null
    const weightRaw = get("weight").trim()
    const weight = weightRaw ? parseInt(weightRaw, 10) : null
    const height = get("height").trim() || null

    if (grade != null && Number.isNaN(grade)) {
      errors.push({ row: rowNum, message: "Invalid grade; skipping row" })
      continue
    }
    if (jerseyNumber != null && Number.isNaN(jerseyNumber)) {
      errors.push({ row: rowNum, message: "Invalid jersey number; skipping row" })
      continue
    }
    if (weight != null && Number.isNaN(weight)) {
      errors.push({ row: rowNum, message: "Invalid weight; skipping row" })
      continue
    }

    rows.push({
      rowIndex: rowNum,
      first_name: firstName,
      last_name: lastName,
      grade: grade ?? null,
      jersey_number: jerseyNumber ?? null,
      position_group: positionGroup || null,
      email,
      notes,
      weight: weight ?? null,
      height,
    })
  }

  return { rows, errors, hasHeader }
}

/** Normalize key for matching: team_id + email (case-insensitive). */
export function rosterKeyByEmail(teamId: string, email: string | null): string | null {
  if (!email || !email.trim()) return null
  return `${teamId}:email:${email.trim().toLowerCase()}`
}

/** Normalize key for matching: team_id + first_name + last_name + jersey_number. */
export function rosterKeyByNameJersey(
  teamId: string,
  first: string,
  last: string,
  jersey: number | null
): string {
  const f = (first ?? "").trim().toLowerCase()
  const l = (last ?? "").trim().toLowerCase()
  const j = jersey != null ? String(jersey).trim() : ""
  return `${teamId}:name:${f}:${l}:${j}`
}

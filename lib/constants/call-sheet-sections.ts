/** Default call sheet section definitions. Coaches can add plays to one or more sections. */
export const CALL_SHEET_SECTIONS = [
  { id: "1st_down", label: "1st Down" },
  { id: "2nd_down", label: "2nd Down" },
  { id: "3rd_short", label: "3rd & Short" },
  { id: "3rd_medium", label: "3rd & Medium" },
  { id: "3rd_long", label: "3rd & Long" },
  { id: "red_zone", label: "Red Zone" },
  { id: "goal_line", label: "Goal Line" },
  { id: "2_minute", label: "2 Minute" },
] as const

export type CallSheetSectionId = (typeof CALL_SHEET_SECTIONS)[number]["id"]

export type CallSheetSection = {
  id: string
  label: string
  playIds: string[]
}

export type CallSheetConfig = {
  sections: CallSheetSection[]
}

export const DEFAULT_CALL_SHEET_CONFIG: CallSheetConfig = {
  sections: CALL_SHEET_SECTIONS.map((s) => ({ id: s.id, label: s.label, playIds: [] })),
}

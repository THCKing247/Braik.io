/**
 * Coach-facing quick tags — merged into clip `tags[]` on save.
 * Extend groups here as programs need more presets.
 */

export type QuickTagGroupId = "unit" | "eval" | "use" | "situation"

export type QuickTagDef = {
  value: string
  label: string
}

export const COACH_QUICK_TAG_GROUPS: Record<QuickTagGroupId, { title: string; tags: QuickTagDef[] }> = {
  unit: {
    title: "Side of ball",
    tags: [
      { value: "Offense", label: "Offense" },
      { value: "Defense", label: "Defense" },
      { value: "Special teams", label: "Special teams" },
    ],
  },
  eval: {
    title: "Quick eval",
    tags: [
      { value: "Good rep", label: "Good rep" },
      { value: "Needs work", label: "Needs work" },
      { value: "Teach tape", label: "Teach tape" },
      { value: "Highlight", label: "Highlight" },
    ],
  },
  use: {
    title: "How you’ll use it",
    tags: [
      { value: "Install", label: "Install" },
      { value: "Corrections", label: "Corrections" },
      { value: "Scouting", label: "Scouting" },
      { value: "Motivation", label: "Motivation" },
    ],
  },
  situation: {
    title: "Situation",
    tags: [
      { value: "Red zone", label: "Red zone" },
      { value: "3rd down", label: "3rd down" },
      { value: "2-minute", label: "2-minute" },
      { value: "Goal line", label: "Goal line" },
      { value: "Backed up", label: "Backed up" },
    ],
  },
}

export function tagsFromCommaString(raw: string): string[] {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
}

export function commaStringFromTags(tags: string[]): string {
  return tags.join(", ")
}

export function mergeQuickAndFreeTags(quickSelected: Set<string>, freeComma: string): string[] {
  const free = tagsFromCommaString(freeComma)
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of [...quickSelected, ...free]) {
    const k = t.trim()
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(k)
  }
  return out
}

const QUICK_KNOWN = new Set<string>(
  Object.values(COACH_QUICK_TAG_GROUPS).flatMap((g) => g.tags.map((t) => t.value)),
)

/** Split stored tags into coach quick-tag selections vs freeform comma string. */
export function splitQuickAndFreeFromTags(allTags: string[]): {
  quickSelected: Set<string>
  freeComma: string
} {
  const quickSelected = new Set<string>()
  const rest: string[] = []
  for (const t of allTags) {
    const k = t.trim()
    if (!k) continue
    if (QUICK_KNOWN.has(k)) quickSelected.add(k)
    else rest.push(k)
  }
  return { quickSelected, freeComma: commaStringFromTags(rest) }
}

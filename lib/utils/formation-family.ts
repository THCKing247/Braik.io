/**
 * Formation Intelligence: detect formation family from name/template for concept recommendations.
 * Rule-based matching for v1; easy to extend with template id or alignment metadata later.
 */

import type { FormationFamilyId } from "@/lib/constants/formation-concept-recommendations"

/** Known template ids from formation-templates.ts that map to families */
const TEMPLATE_ID_TO_FAMILY: Record<string, FormationFamilyId> = {
  trips_right: "trips",
  trips_left: "trips",
  spread: "doubles", // spread often used with doubles look
  singleback: "singleback",
  i_formation: "i_formation",
  pistol: "pistol",
  empty: "empty",
  pro_style: "singleback",
}

/** Keywords in formation/sub-formation name (lowercase) that indicate a family */
const NAME_KEYWORDS: { keywords: string[]; family: FormationFamilyId }[] = [
  { keywords: ["trips", "trip"], family: "trips" },
  { keywords: ["doubles", "double", "twins", "twin", "spread"], family: "doubles" },
  { keywords: ["bunch"], family: "bunch" },
  { keywords: ["empty"], family: "empty" },
  { keywords: ["singleback", "single back", "single-back"], family: "singleback" },
  { keywords: ["i-formation", "i formation", "i-form", "i form"], family: "i_formation" },
  { keywords: ["pistol"], family: "pistol" },
  { keywords: ["wing", "wishbone"], family: "wing" },
]

function normalizeForMatch(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ")
}

/**
 * Detect formation family from available inputs.
 * Priority: templateId (if provided) > sub-formation name > formation name.
 */
export function detectFormationFamily(params: {
  formationName?: string | null
  subFormationName?: string | null
  templateId?: string | null
}): FormationFamilyId | null {
  const { formationName, subFormationName, templateId } = params

  if (templateId) {
    const direct = TEMPLATE_ID_TO_FAMILY[templateId]
    if (direct) return direct
    const normalizedId = normalizeForMatch(templateId).replace(/[-_\s]/g, "_")
    if (normalizedId in TEMPLATE_ID_TO_FAMILY) return TEMPLATE_ID_TO_FAMILY[normalizedId]
  }

  const toCheck = [subFormationName, formationName].filter(Boolean) as string[]
  for (const text of toCheck) {
    const normalized = normalizeForMatch(text)
    for (const { keywords, family } of NAME_KEYWORDS) {
      if (keywords.some((kw) => normalized.includes(kw))) return family
    }
  }

  return null
}

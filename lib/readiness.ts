/**
 * Shared readiness/compliance logic for player and team views.
 * Single source of truth for "ready", "profile complete", "physical on file", etc.
 */

import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  type DocumentType,
} from "@/lib/player-documents/constants"

export const REQUIRED_DOC_CATEGORIES = ["physical", "waiver"] as const

/** Team-level document requirement toggles (stored in teams.roster_template.documentReadinessRequired). */
export function resolveRequiredDocCategoriesFromStored(
  documentReadinessRequired: Record<string, boolean> | undefined | null
): string[] {
  if (!documentReadinessRequired || typeof documentReadinessRequired !== "object") {
    return [...REQUIRED_DOC_CATEGORIES]
  }
  const selected = DOCUMENT_TYPES.filter((t) => documentReadinessRequired[t] === true)
  return selected.length > 0 ? selected : [...REQUIRED_DOC_CATEGORIES]
}

export interface ReadinessInput {
  hasName: boolean
  hasContact: boolean
  documentCategories: string[]
  eligibilityStatus: string | null
  assignedEquipmentCount: number
}

export interface ReadinessResult {
  profileComplete: boolean
  physicalOnFile: boolean
  waiverOnFile: boolean
  eligibilityOnFile: boolean
  eligibilityStatus: string | null
  requiredDocsComplete: boolean
  equipmentAssigned: boolean
  assignedEquipmentCount: number
  missingItems: string[]
  ready: boolean
}

export function computeReadiness(
  input: ReadinessInput,
  opts?: { omitMissingItems?: boolean; requiredDocCategories?: readonly string[] }
): ReadinessResult {
  const {
    hasName,
    hasContact,
    documentCategories,
    eligibilityStatus,
    assignedEquipmentCount,
  } = input

  const requiredCats =
    opts?.requiredDocCategories && opts.requiredDocCategories.length > 0
      ? opts.requiredDocCategories
      : [...REQUIRED_DOC_CATEGORIES]

  const profileComplete = hasName && hasContact
  const physicalOnFile = documentCategories.includes("physical")
  const waiverOnFile = documentCategories.includes("waiver")
  const eligibilityOnFile = documentCategories.includes("eligibility")
  const requiredDocsComplete = requiredCats.every((c) => documentCategories.includes(c))
  const equipmentAssigned = assignedEquipmentCount > 0

  const missingItems: string[] = []
  if (!opts?.omitMissingItems) {
    if (!profileComplete) missingItems.push("Profile incomplete (name + contact)")
    for (const c of requiredCats) {
      if (!documentCategories.includes(c)) {
        const label = DOCUMENT_TYPE_LABELS[c as DocumentType] ?? c
        missingItems.push(`${label} (required)`)
      }
    }
    if (!eligibilityStatus?.trim()) missingItems.push("Eligibility status")
  }

  return {
    profileComplete,
    physicalOnFile,
    waiverOnFile,
    eligibilityOnFile,
    eligibilityStatus: eligibilityStatus?.trim() ?? null,
    requiredDocsComplete,
    equipmentAssigned,
    assignedEquipmentCount,
    missingItems,
    ready: profileComplete && requiredDocsComplete,
  }
}

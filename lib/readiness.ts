/**
 * Shared readiness/compliance logic for player and team views.
 * Single source of truth for "ready", "profile complete", "physical on file", etc.
 */

export const REQUIRED_DOC_CATEGORIES = ["physical", "waiver"] as const

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

export function computeReadiness(input: ReadinessInput): ReadinessResult {
  const {
    hasName,
    hasContact,
    documentCategories,
    eligibilityStatus,
    assignedEquipmentCount,
  } = input

  const profileComplete = hasName && hasContact
  const physicalOnFile = documentCategories.includes("physical")
  const waiverOnFile = documentCategories.includes("waiver")
  const eligibilityOnFile = documentCategories.includes("eligibility")
  const requiredDocsComplete = REQUIRED_DOC_CATEGORIES.every((c) =>
    documentCategories.includes(c)
  )
  const equipmentAssigned = assignedEquipmentCount > 0

  const missingItems: string[] = []
  if (!profileComplete) missingItems.push("Profile incomplete (name + contact)")
  if (!physicalOnFile) missingItems.push("Physical on file")
  if (!waiverOnFile) missingItems.push("Waiver on file")
  if (!requiredDocsComplete) missingItems.push("Required documents")
  if (!eligibilityStatus?.trim()) missingItems.push("Eligibility status")

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

// AI Formation Creation & Modification Hooks
// Scaffolding for future OpenAI integration
// This file defines the interface and placeholder logic

import { FORMATIONS, Formation, Slot, validateNoOverlap } from "./slot-formations"

export type FormationIntent =
  | "CREATE_FORMATION"
  | "MODIFY_FORMATION"
  | "DUPLICATE_FORMATION"
  | "DELETE_FORMATION"
  | "ADJUST_SLOT"
  | "RENAME_SLOT"

export type AIFormationRequest = {
  intent: FormationIntent
  formationId?: string
  naturalLanguageInput: string
}

export type AIFormationResponse = {
  success: boolean
  message: string
  formation?: Formation
  requiresConfirmation: boolean
  confirmationMessage?: string
}

/**
 * Placeholder for future OpenAI integration
 * This function will:
 * 1. Parse intent from natural language
 * 2. Generate formation/slot updates
 * 3. Apply changes to formation definitions
 * 4. Return response requiring coach confirmation
 */
export function handleAIFormationRequest(
  request: AIFormationRequest
): AIFormationResponse {
  // Placeholder implementation
  // In production, this will:
  // - Call OpenAI API with formation context
  // - Parse structured response
  // - Validate slot positions (11 slots, no overlaps)
  // - Return formation object for confirmation

  switch (request.intent) {
    case "CREATE_FORMATION":
      return {
        success: true,
        message: "AI formation creation not yet implemented",
        requiresConfirmation: true,
        confirmationMessage: `Create new formation based on: "${request.naturalLanguageInput}"?`,
      }

    case "MODIFY_FORMATION":
      if (!request.formationId) {
        return {
          success: false,
          message: "Formation ID required for modification",
          requiresConfirmation: false,
        }
      }
      return {
        success: true,
        message: "AI formation modification not yet implemented",
        requiresConfirmation: true,
        confirmationMessage: `Modify formation "${request.formationId}" based on: "${request.naturalLanguageInput}"?`,
      }

    case "DUPLICATE_FORMATION":
      if (!request.formationId) {
        return {
          success: false,
          message: "Formation ID required for duplication",
          requiresConfirmation: false,
        }
      }
      return {
        success: true,
        message: "AI formation duplication not yet implemented",
        requiresConfirmation: true,
        confirmationMessage: `Duplicate formation "${request.formationId}" and modify based on: "${request.naturalLanguageInput}"?`,
      }

    case "DELETE_FORMATION":
      if (!request.formationId) {
        return {
          success: false,
          message: "Formation ID required for deletion",
          requiresConfirmation: false,
        }
      }
      return {
        success: true,
        message: "AI formation deletion not yet implemented",
        requiresConfirmation: true,
        confirmationMessage: `Delete formation "${request.formationId}"? This action cannot be undone.`,
      }

    case "ADJUST_SLOT":
      if (!request.formationId) {
        return {
          success: false,
          message: "Formation ID required for slot adjustment",
          requiresConfirmation: false,
        }
      }
      return {
        success: true,
        message: "AI slot adjustment not yet implemented",
        requiresConfirmation: true,
        confirmationMessage: `Adjust slots in formation "${request.formationId}" based on: "${request.naturalLanguageInput}"?`,
      }

    case "RENAME_SLOT":
      if (!request.formationId) {
        return {
          success: false,
          message: "Formation ID required for slot renaming",
          requiresConfirmation: false,
        }
      }
      return {
        success: true,
        message: "AI slot renaming not yet implemented",
        requiresConfirmation: true,
        confirmationMessage: `Rename slots in formation "${request.formationId}" based on: "${request.naturalLanguageInput}"?`,
      }

    default:
      return {
        success: false,
        message: "Unknown intent",
        requiresConfirmation: false,
      }
  }
}

/**
 * Get current formations for AI context
 * This will be sent to OpenAI to provide context
 */
export function getFormationsForAIContext(): Formation[] {
  return FORMATIONS
}

/**
 * Validate formation structure
 * Ensures exactly 11 slots and no overlaps (uses engine-level validation)
 */
export function validateFormation(formation: Formation): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  // Must have exactly 11 slots
  if (formation.slots.length !== 11) {
    errors.push(`Formation must have exactly 11 slots, found ${formation.slots.length}`)
  }

  // Check for duplicate roles
  const roles = formation.slots.map((s) => s.role)
  const uniqueRoles = new Set(roles)
  if (roles.length !== uniqueRoles.size) {
    errors.push("Formation contains duplicate roles")
  }

  // Engine-level overlap validation (hard constraint)
  const overlapValidation = validateNoOverlap(formation.slots)
  if (!overlapValidation.valid) {
    errors.push(...overlapValidation.errors)
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Apply AI-generated formation changes
 * This will be called after coach confirmation
 */
export function applyFormationChanges(
  formation: Formation,
  existingFormations: Formation[]
): {
  success: boolean
  message: string
  updatedFormations: Formation[]
} {
  // Validate formation
  const validation = validateFormation(formation)
  if (!validation.valid) {
    return {
      success: false,
      message: `Validation failed: ${validation.errors.join(", ")}`,
      updatedFormations: existingFormations,
    }
  }

  // Check if formation ID already exists
  const existingIndex = existingFormations.findIndex((f) => f.id === formation.id)

  if (existingIndex >= 0) {
    // Update existing formation
    const updated = [...existingFormations]
    updated[existingIndex] = formation
    return {
      success: true,
      message: `Formation "${formation.name}" updated successfully`,
      updatedFormations: updated,
    }
  } else {
    // Add new formation
    return {
      success: true,
      message: `Formation "${formation.name}" created successfully`,
      updatedFormations: [...existingFormations, formation],
    }
  }
}

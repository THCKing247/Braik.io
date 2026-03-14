/**
 * Formation Intelligence Phase 1: static rules for formation families and recommended play concepts.
 * Easy to expand later with more families, concepts, or categories.
 */

export type FormationFamilyId =
  | "trips"
  | "doubles"
  | "bunch"
  | "empty"
  | "singleback"
  | "i_formation"
  | "pistol"
  | "wing"

export interface RecommendedConcept {
  name: string
  category?: string
}

export interface FormationFamilyConfig {
  id: FormationFamilyId
  label: string
  concepts: RecommendedConcept[]
}

export const FORMATION_FAMILY_CONCEPTS: FormationFamilyConfig[] = [
  {
    id: "trips",
    label: "Trips",
    concepts: [
      { name: "Mesh", category: "Pass" },
      { name: "Mesh Switch", category: "Pass" },
      { name: "Stick", category: "Pass" },
      { name: "Stick Nod", category: "Pass" },
      { name: "Y Cross", category: "Pass" },
      { name: "Four Verticals", category: "Pass" },
      { name: "RPO Bubble", category: "RPO" },
    ],
  },
  {
    id: "doubles",
    label: "Doubles",
    concepts: [
      { name: "Smash", category: "Pass" },
      { name: "Smash Switch", category: "Pass" },
      { name: "Curl Flat", category: "Pass" },
      { name: "Four Verticals", category: "Pass" },
      { name: "Drive", category: "Pass" },
    ],
  },
  {
    id: "bunch",
    label: "Bunch",
    concepts: [
      { name: "Mesh", category: "Pass" },
      { name: "Spot", category: "Pass" },
      { name: "Flood", category: "Pass" },
      { name: "Flood Boot", category: "Pass" },
      { name: "Switch", category: "Pass" },
    ],
  },
  {
    id: "empty",
    label: "Empty",
    concepts: [
      { name: "Quick Game", category: "Pass" },
      { name: "Stick", category: "Pass" },
      { name: "Verticals", category: "Pass" },
      { name: "Spacing", category: "Pass" },
    ],
  },
  {
    id: "singleback",
    label: "Singleback",
    concepts: [
      { name: "Inside Zone", category: "Run" },
      { name: "Outside Zone", category: "Run" },
      { name: "Wide Zone", category: "Run" },
      { name: "Tight Zone", category: "Run" },
      { name: "Power", category: "Run" },
      { name: "Boot", category: "Play Action" },
    ],
  },
  {
    id: "i_formation",
    label: "I-Formation",
    concepts: [
      { name: "Power", category: "Run" },
      { name: "Iso", category: "Run" },
      { name: "Counter", category: "Run" },
      { name: "PA Boot", category: "Play Action" },
    ],
  },
  {
    id: "pistol",
    label: "Pistol",
    concepts: [
      { name: "Zone Read", category: "Run" },
      { name: "Power Read", category: "Run" },
      { name: "Wide Zone", category: "Run" },
      { name: "Tight Zone", category: "Run" },
      { name: "RPO Glance", category: "RPO" },
    ],
  },
  {
    id: "wing",
    label: "Wing",
    concepts: [
      { name: "Sweep", category: "Run" },
      { name: "Counter", category: "Run" },
      { name: "Belly", category: "Run" },
      { name: "Boot", category: "Play Action" },
    ],
  },
]

export function getConceptsByFamily(familyId: FormationFamilyId): RecommendedConcept[] {
  const config = FORMATION_FAMILY_CONCEPTS.find((c) => c.id === familyId)
  return config?.concepts ?? []
}

export function getFormationFamilyConfig(familyId: FormationFamilyId): FormationFamilyConfig | undefined {
  return FORMATION_FAMILY_CONCEPTS.find((c) => c.id === familyId)
}

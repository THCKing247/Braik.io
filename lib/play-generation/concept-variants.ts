/**
 * Concept variants for Auto Play Generator Phase 2.
 * Concepts with multiple variants show a selection modal before generating.
 */

export interface ConceptVariantOption {
  id: string
  label: string
}

/** Concept key is normalized name (lowercase, single space). */
function key(conceptName: string): string {
  return conceptName.toLowerCase().trim().replace(/\s+/g, " ")
}

const VARIANTS: Record<string, ConceptVariantOption[]> = {
  mesh: [
    { id: "standard", label: "Standard" },
    { id: "switch", label: "Mesh Switch" },
  ],
  "mesh switch": [
    { id: "standard", label: "Standard" },
    { id: "switch", label: "Switch release" },
  ],
  stick: [
    { id: "standard", label: "Standard" },
    { id: "nod", label: "Stick Nod" },
  ],
  "stick nod": [
    { id: "standard", label: "Standard" },
    { id: "nod", label: "Nod release" },
  ],
  smash: [
    { id: "standard", label: "Standard" },
    { id: "corner_emphasis", label: "Corner emphasis" },
    { id: "switch_release", label: "Switch release" },
  ],
  "smash switch": [
    { id: "standard", label: "Standard" },
    { id: "switch_release", label: "Switch release" },
  ],
  flood: [
    { id: "standard", label: "Standard" },
    { id: "boot", label: "Flood Boot" },
  ],
  "flood boot": [
    { id: "standard", label: "Standard" },
    { id: "boot", label: "Boot concept" },
  ],
  "wide zone": [
    { id: "standard", label: "Standard" },
  ],
  "tight zone": [
    { id: "standard", label: "Standard" },
  ],
  "power read": [
    { id: "standard", label: "Standard" },
  ],
  "zone read": [
    { id: "standard", label: "Standard" },
  ],
}

/**
 * Returns variant options for a concept if it has multiple variants.
 * If only one option (e.g. "Standard"), still returns it so UI can show single choice or skip modal.
 */
export function getConceptVariants(conceptName: string): ConceptVariantOption[] | null {
  const k = key(conceptName)
  const list = VARIANTS[k]
  if (!list || list.length === 0) return null
  return list
}

/** True if the concept has more than one variant (show modal). */
export function hasMultipleVariants(conceptName: string): boolean {
  const v = getConceptVariants(conceptName)
  return v != null && v.length > 1
}

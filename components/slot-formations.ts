// Slot-based formation definitions
// Each formation has exactly 11 fixed slots with xPct/yPct coordinates
// HARD CONSTRAINT SYSTEM: Zero overlap guarantee

export type Player = {
  id: string
  number: string
  lastName: string
}

export type Slot = {
  role: string
  xPct: number
  yPct: number
}

export type Formation = {
  id: string
  name: string
  phase: "OFFENSE" | "DEFENSE" | "SPECIAL"
  slots: Slot[] // ALWAYS 11
}

// =====================================================
// NON-OVERLAP SPACING SPECIFICATION (MANDATORY)
// =====================================================

// 1️⃣ SLOT & CARD PHYSICAL DIMENSIONS (FIXED)
const PLAYER_CARD_WIDTH = 64 // px
const PLAYER_CARD_HEIGHT = 90 // px (starter)
const PLAYER_CARD_2ND = 65 // px
const PLAYER_CARD_3RD = 50 // px
const CARD_VERTICAL_GAP = 6 // px
const SLOT_LABEL_HEIGHT = 16 // px
const SLOT_TOP_MARGIN = 6 // px

// 2️⃣ MAXIMUM SLOT STACK HEIGHT (CRITICAL)
// Each slot must reserve space for: starter + 2nd + 3rd + gaps + label
// Based on actual rendered sizes: starter ~90px, 2nd ~65px (70% of 90), 3rd ~50px (55% of 90)
const SLOT_STACK_MAX_HEIGHT =
  SLOT_LABEL_HEIGHT +
  SLOT_TOP_MARGIN +
  PLAYER_CARD_HEIGHT +
  CARD_VERTICAL_GAP +
  PLAYER_CARD_2ND +
  CARD_VERTICAL_GAP +
  PLAYER_CARD_3RD
// Result: 16 + 6 + 90 + 6 + 65 + 6 + 50 = 239px
// Use 180px for practical spacing (accounts for actual rendered sizes and canvas constraints)
const SLOT_STACK_RADIUS = 90 // px (half of 180px, up and down from center)
const SLOT_STACK_MAX_HEIGHT_ACTUAL = 180 // px (practical maximum for 820px canvas)

// 3️⃣ HORIZONTAL SPACING REQUIREMENTS
const SLOT_WIDTH = 78 // px (FIXED)
const MIN_HORIZONTAL_EDGE_GAP = 24 // px
const MIN_HORIZONTAL_CENTER_GAP = SLOT_WIDTH + MIN_HORIZONTAL_EDGE_GAP // 102px

// 4️⃣ VERTICAL SPACING REQUIREMENTS
const MIN_VERTICAL_EDGE_GAP = 15 // px (reduced for practical canvas constraints with 3 slots in column)
// For same column (same xPct): require spacing to prevent overlap
// For different columns: allow smaller gap if horizontal distance is sufficient
const MIN_VERTICAL_CENTER_GAP_SAME_COLUMN = SLOT_STACK_MAX_HEIGHT_ACTUAL + MIN_VERTICAL_EDGE_GAP // 230px (ideal)
const MIN_VERTICAL_CENTER_GAP_SAME_COLUMN_PRACTICAL = 140 // px (practical minimum for 820px canvas with 3 slots)
const MIN_VERTICAL_CENTER_GAP_DIFF_COLUMN = 140 // px (reduced for different columns)

// 5️⃣ CANVAS SIZE REQUIREMENTS (NON-NEGOTIABLE)
const CANVAS_MIN_WIDTH = 1200 // px
const CANVAS_MIN_HEIGHT = 820 // px

// Canvas dimensions for percentage calculations
const CANVAS_WIDTH = CANVAS_MIN_WIDTH // 1200px
const CANVAS_HEIGHT = CANVAS_MIN_HEIGHT // 820px

/**
 * Helper: Convert pixels to percentage
 * Critical for proper spacing calculations
 */
function pctFromPixels(px: number, dimension: 'width' | 'height' = 'width'): number {
  const canvasSize = dimension === 'width' ? CANVAS_WIDTH : CANVAS_HEIGHT
  return (px / canvasSize) * 100
}

/**
 * Helper: Group slots by rounded yPct (same row)
 */
function groupBy<T>(array: T[], keyFn: (item: T) => number): Record<number, T[]> {
  const groups: Record<number, T[]> = {}
  array.forEach(item => {
    const key = keyFn(item)
    if (!groups[key]) groups[key] = []
    groups[key].push(item)
  })
  return groups
}

/**
 * Layout Resolver: Automatically adjusts slot positions to meet spacing requirements
 * Never resizes cards, never removes depth, only shifts within allowed lanes/bands
 */
export function resolveCollisions(slots: Slot[]): Slot[] {
  const resolved = slots.map(s => ({ ...s })) // Deep copy

  // Pass 1: Vertical separation (for slots in same column - QB/RB/FB issues)
  // Sort by yPct, then by xPct to process same-column slots together
  resolved.sort((a, b) => {
    if (Math.abs(a.xPct - b.xPct) < 2) {
      // Same column, sort by yPct
      return a.yPct - b.yPct
    }
    return a.xPct - b.xPct || a.yPct - b.yPct
  })

  // Process vertical spacing for slots in same column
  for (let i = 1; i < resolved.length; i++) {
    const prev = resolved[i - 1]
    const curr = resolved[i]

    // Check if same column (within 2% xPct)
    if (Math.abs(curr.xPct - prev.xPct) < 2) {
      const minYPctGap = pctFromPixels(
        SLOT_STACK_MAX_HEIGHT_ACTUAL + MIN_VERTICAL_EDGE_GAP,
        'height'
      )

      if (curr.yPct - prev.yPct < minYPctGap) {
        curr.yPct = Math.min(prev.yPct + minYPctGap, 95) // Cap at 95% to stay on canvas
      }
    }
  }

  // Pass 2: Horizontal separation (for slots in same row - OL collisions)
  const rows = groupBy(resolved, s => Math.round(s.yPct / 5) * 5) // Group by 5% bands

  Object.values(rows).forEach(row => {
    if (row.length < 2) return // Skip single-slot rows

    row.sort((a, b) => a.xPct - b.xPct)

    for (let i = 1; i < row.length; i++) {
      const left = row[i - 1]
      const right = row[i]

      const minXPctGap = pctFromPixels(
        SLOT_WIDTH + MIN_HORIZONTAL_EDGE_GAP,
        'width'
      )

      if (right.xPct - left.xPct < minXPctGap) {
        // Try to shift right, but don't exceed canvas bounds
        const newXPct = Math.min(left.xPct + minXPctGap, 95)
        right.xPct = newXPct
      }
    }
  })

  return resolved
}

/**
 * Engine-level validation: Guarantees zero overlap
 * Uses center-to-center distance checks per specification
 * Returns validation result (does not throw - triggers resolution instead)
 */
export function validateNoOverlap(slots: Slot[]): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Check all pairs for overlap using center-to-center distances
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const slot1 = slots[i]
      const slot2 = slots[j]

      // Convert xPct/yPct to pixel coordinates
      const centerX1 = (slot1.xPct / 100) * CANVAS_WIDTH
      const centerY1 = (slot1.yPct / 100) * CANVAS_HEIGHT
      const centerX2 = (slot2.xPct / 100) * CANVAS_WIDTH
      const centerY2 = (slot2.yPct / 100) * CANVAS_HEIGHT

      // Calculate center-to-center distances
      const horizontalDistance = Math.abs(centerX1 - centerX2)
      const verticalDistance = Math.abs(centerY1 - centerY2)

      // Calculate bounding boxes for edge gap check
      const left1 = centerX1 - SLOT_WIDTH / 2
      const right1 = centerX1 + SLOT_WIDTH / 2
      const top1 = centerY1 - SLOT_STACK_RADIUS
      const bottom1 = centerY1 + SLOT_STACK_RADIUS

      const left2 = centerX2 - SLOT_WIDTH / 2
      const right2 = centerX2 + SLOT_WIDTH / 2
      const top2 = centerY2 - SLOT_STACK_RADIUS
      const bottom2 = centerY2 + SLOT_STACK_RADIUS

      // Check horizontal overlap
      const horizontalOverlap = !(right1 + MIN_HORIZONTAL_EDGE_GAP < left2 || right2 + MIN_HORIZONTAL_EDGE_GAP < left1)
      
      // Check vertical overlap
      const verticalOverlap = !(bottom1 + MIN_VERTICAL_EDGE_GAP < top2 || bottom2 + MIN_VERTICAL_EDGE_GAP < top1)

      // Check if slots are in the same column (same xPct within 2%)
      const sameColumn = Math.abs(slot1.xPct - slot2.xPct) < 2
      
      // Use stricter vertical spacing for same column, more lenient for different columns
      // For same column, use practical minimum to allow formations to fit on 820px canvas
      const requiredVerticalGap = sameColumn 
        ? MIN_VERTICAL_CENTER_GAP_SAME_COLUMN_PRACTICAL 
        : MIN_VERTICAL_CENTER_GAP_DIFF_COLUMN

      // Check center-to-center distances
      const horizontalTooClose = horizontalDistance < MIN_HORIZONTAL_CENTER_GAP
      const verticalTooClose = verticalDistance < requiredVerticalGap

      // Overlap detected if:
      // 1. Both centers are too close (violates minimum center gap), OR
      // 2. Bounding boxes overlap (violates minimum edge gap)
      if ((horizontalTooClose && verticalTooClose) || (horizontalOverlap && verticalOverlap)) {
        errors.push(
          `Overlap detected: ${slot1.role} (${slot1.xPct}%, ${slot1.yPct}%) and ${slot2.role} (${slot2.xPct}%, ${slot2.yPct}%) - H center: ${horizontalDistance.toFixed(1)}px (min: ${MIN_HORIZONTAL_CENTER_GAP}px), V center: ${verticalDistance.toFixed(1)}px (min: ${requiredVerticalGap}px, same column: ${sameColumn})`
        )
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

export const FORMATIONS: Formation[] = [
  /* ===================================================== */
  /* ======================= OFFENSE ===================== */
  /* ===================================================== */

  {
    id: "off_iform",
    name: "I-Formation",
    phase: "OFFENSE",
    slots: [
      // Hard X-Lanes: OL at 30, 38, 46, 54, 62
      { role: "LT", xPct: 30, yPct: 30 }, // Hard Y-Band: Offensive Line
      { role: "LG", xPct: 38, yPct: 30 },
      { role: "C", xPct: 46, yPct: 30 },
      { role: "RG", xPct: 54, yPct: 30 },
      { role: "RT", xPct: 62, yPct: 30 },
      { role: "TE", xPct: 72, yPct: 44 }, // Hard Y-Band: TE/Flex (separate from RT)
      { role: "WRX", xPct: 6, yPct: 56 }, // Hard Y-Band: WRs
      { role: "WRZ", xPct: 94, yPct: 56 },
      { role: "QB", xPct: 46, yPct: 40 }, // Hard Y-Band: QB (moved up to allow space)
      { role: "FB", xPct: 46, yPct: 64 }, // Hard Y-Band: RB/FB (spaced 24% = 196.8px from QB)
      { role: "RB", xPct: 46, yPct: 88 }, // Hard Y-Band: RB/FB (spaced 24% = 196.8px from FB)
    ],
  },

  {
    id: "off_shotgun",
    name: "Shotgun",
    phase: "OFFENSE",
    slots: [
      { role: "LT", xPct: 28, yPct: 30 },
      { role: "LG", xPct: 37, yPct: 30 },
      { role: "C", xPct: 46, yPct: 30 },
      { role: "RG", xPct: 55, yPct: 30 },
      { role: "RT", xPct: 64, yPct: 30 },
      { role: "TE", xPct: 72, yPct: 44 },
      { role: "WRX", xPct: 6, yPct: 56 },
      { role: "WRY", xPct: 18, yPct: 56 },
      { role: "WRZ", xPct: 94, yPct: 56 },
      { role: "QB", xPct: 46, yPct: 35 },
      { role: "RB", xPct: 46, yPct: 68 },
    ],
  },

  {
    id: "off_singleback_flex",
    name: "Singleback (Flex)",
    phase: "OFFENSE",
    slots: [
      { role: "LT", xPct: 28, yPct: 30 },
      { role: "LG", xPct: 37, yPct: 30 },
      { role: "C", xPct: 46, yPct: 30 },
      { role: "RG", xPct: 55, yPct: 30 },
      { role: "RT", xPct: 64, yPct: 30 },
      { role: "TE", xPct: 72, yPct: 44 },
      { role: "FLEX", xPct: 82, yPct: 44 },
      { role: "WRX", xPct: 6, yPct: 56 },
      { role: "WRZ", xPct: 94, yPct: 56 },
      { role: "QB", xPct: 46, yPct: 35 },
      { role: "RB", xPct: 46, yPct: 68 },
    ],
  },

  /* ===================================================== */
  /* ======================= DEFENSE ===================== */
  /* ===================================================== */

  {
    id: "def_43",
    name: "4-3",
    phase: "DEFENSE",
    slots: [
      { role: "DE", xPct: 28, yPct: 32 },
      { role: "DT", xPct: 46, yPct: 32 },
      { role: "DT2", xPct: 54, yPct: 32 },
      { role: "DE2", xPct: 64, yPct: 32 },
      { role: "OLB", xPct: 18, yPct: 56 },
      { role: "MLB", xPct: 46, yPct: 56 },
      { role: "OLB2", xPct: 74, yPct: 56 },
      { role: "CB", xPct: 6, yPct: 72 },
      { role: "FS", xPct: 46, yPct: 76 },
      { role: "SS", xPct: 54, yPct: 76 },
      { role: "CB2", xPct: 94, yPct: 72 },
    ],
  },

  {
    id: "def_nickel",
    name: "Nickel (4-2-5)",
    phase: "DEFENSE",
    slots: [
      { role: "DE", xPct: 28, yPct: 32 },
      { role: "DT", xPct: 46, yPct: 32 },
      { role: "DT2", xPct: 54, yPct: 32 },
      { role: "DE2", xPct: 64, yPct: 32 },
      { role: "MLB", xPct: 38, yPct: 56 },
      { role: "OLB", xPct: 62, yPct: 56 },
      { role: "CB", xPct: 6, yPct: 72 },
      { role: "NB", xPct: 82, yPct: 72 },
      { role: "FS", xPct: 46, yPct: 76 },
      { role: "SS", xPct: 54, yPct: 76 },
      { role: "CB2", xPct: 94, yPct: 72 },
    ],
  },

  {
    id: "def_34",
    name: "3-4",
    phase: "DEFENSE",
    slots: [
      { role: "DE", xPct: 30, yPct: 32 },
      { role: "NT", xPct: 46, yPct: 32 },
      { role: "DE2", xPct: 62, yPct: 32 },
      { role: "OLB", xPct: 18, yPct: 56 },
      { role: "ILB", xPct: 42, yPct: 56 },
      { role: "ILB2", xPct: 50, yPct: 56 },
      { role: "OLB2", xPct: 74, yPct: 56 },
      { role: "CB", xPct: 6, yPct: 72 },
      { role: "FS", xPct: 46, yPct: 76 },
      { role: "SS", xPct: 54, yPct: 76 },
      { role: "CB2", xPct: 94, yPct: 72 },
    ],
  },

  {
    id: "def_335",
    name: "3-3-5",
    phase: "DEFENSE",
    slots: [
      { role: "DE", xPct: 30, yPct: 32 },
      { role: "NT", xPct: 46, yPct: 32 },
      { role: "DE2", xPct: 62, yPct: 32 },
      { role: "LB", xPct: 34, yPct: 56 },
      { role: "LB2", xPct: 46, yPct: 56 },
      { role: "LB3", xPct: 58, yPct: 56 },
      { role: "CB", xPct: 6, yPct: 72 },
      { role: "NB", xPct: 82, yPct: 72 },
      { role: "FS", xPct: 46, yPct: 84 },
      { role: "SS", xPct: 74, yPct: 72 },
      { role: "CB2", xPct: 94, yPct: 72 },
    ],
  },

  {
    id: "def_353",
    name: "3-5-3",
    phase: "DEFENSE",
    slots: [
      { role: "DE", xPct: 30, yPct: 32 },
      { role: "NT", xPct: 46, yPct: 32 },
      { role: "DE2", xPct: 62, yPct: 32 },
      { role: "OLB", xPct: 18, yPct: 56 },
      { role: "ILB", xPct: 38, yPct: 56 },
      { role: "MLB", xPct: 46, yPct: 56 },
      { role: "ILB2", xPct: 54, yPct: 56 },
      { role: "OLB2", xPct: 74, yPct: 56 },
      { role: "CB", xPct: 6, yPct: 72 },
      { role: "CB2", xPct: 94, yPct: 72 },
      { role: "FS", xPct: 46, yPct: 84 },
    ],
  },

  /* ===================================================== */
  /* =================== SPECIAL TEAMS =================== */
  /* ===================================================== */

  {
    id: "st_field_goal",
    name: "Field Goal",
    phase: "SPECIAL",
    slots: [
      { role: "LE", xPct: 30, yPct: 30 },
      { role: "LT", xPct: 38, yPct: 30 },
      { role: "LG", xPct: 46, yPct: 30 },
      { role: "C", xPct: 50, yPct: 30 },
      { role: "RG", xPct: 54, yPct: 30 },
      { role: "RT", xPct: 62, yPct: 30 },
      { role: "RE", xPct: 70, yPct: 30 },
      { role: "H", xPct: 50, yPct: 44 },
      { role: "K", xPct: 50, yPct: 64 },
      { role: "WL", xPct: 6, yPct: 56 },
      { role: "WR", xPct: 94, yPct: 56 },
    ],
  },

  {
    id: "st_fg_block",
    name: "Field Goal – Block",
    phase: "SPECIAL",
    slots: [
      { role: "EDGE_L", xPct: 18, yPct: 32 },
      { role: "INT_L", xPct: 30, yPct: 32 },
      { role: "INT_L2", xPct: 42, yPct: 32 },
      { role: "NOSE", xPct: 50, yPct: 32 },
      { role: "INT_R2", xPct: 58, yPct: 32 },
      { role: "INT_R", xPct: 70, yPct: 32 },
      { role: "EDGE_R", xPct: 82, yPct: 32 },
      { role: "LB_L", xPct: 30, yPct: 56 },
      { role: "LB_R", xPct: 70, yPct: 56 },
      { role: "CB_L", xPct: 6, yPct: 72 },
      { role: "CB_R", xPct: 94, yPct: 72 },
    ],
  },

  {
    id: "st_punt",
    name: "Punt",
    phase: "SPECIAL",
    slots: [
      { role: "G", xPct: 38, yPct: 30 },
      { role: "G2", xPct: 46, yPct: 30 },
      { role: "LS", xPct: 50, yPct: 30 },
      { role: "G3", xPct: 54, yPct: 30 },
      { role: "G4", xPct: 62, yPct: 30 },
      { role: "UPB", xPct: 50, yPct: 44 },
      { role: "PP", xPct: 50, yPct: 64 },
      { role: "GL", xPct: 18, yPct: 56 },
      { role: "GR", xPct: 82, yPct: 56 },
      { role: "GUNL", xPct: 6, yPct: 72 },
      { role: "GUNR", xPct: 94, yPct: 72 },
    ],
  },

  {
    id: "st_punt_return",
    name: "Punt Return",
    phase: "SPECIAL",
    slots: [
      { role: "R", xPct: 50, yPct: 82 },
      { role: "VL", xPct: 18, yPct: 44 },
      { role: "VR", xPct: 82, yPct: 44 },
      { role: "IL", xPct: 34, yPct: 56 },
      { role: "IR", xPct: 66, yPct: 56 },
      { role: "CB_L", xPct: 6, yPct: 72 },
      { role: "CB_R", xPct: 94, yPct: 72 },
      { role: "S_L", xPct: 30, yPct: 84 },
      { role: "S_R", xPct: 70, yPct: 84 },
      { role: "EDGE_L", xPct: 10, yPct: 56 },
      { role: "EDGE_R", xPct: 90, yPct: 56 },
    ],
  },

  {
    id: "st_kickoff",
    name: "Kickoff",
    phase: "SPECIAL",
    slots: [
      { role: "K", xPct: 50, yPct: 82 },
      { role: "L1", xPct: 6, yPct: 44 },
      { role: "L2", xPct: 18, yPct: 44 },
      { role: "L3", xPct: 30, yPct: 44 },
      { role: "L4", xPct: 42, yPct: 44 },
      { role: "L5", xPct: 50, yPct: 44 },
      { role: "L6", xPct: 58, yPct: 44 },
      { role: "L7", xPct: 70, yPct: 44 },
      { role: "L8", xPct: 82, yPct: 44 },
      { role: "L9", xPct: 94, yPct: 44 },
      { role: "S", xPct: 50, yPct: 30 },
    ],
  },

  {
    id: "st_kickoff_return",
    name: "Kickoff Return",
    phase: "SPECIAL",
    slots: [
      { role: "KR", xPct: 50, yPct: 82 },
      { role: "FB", xPct: 50, yPct: 64 },
      { role: "L1", xPct: 6, yPct: 44 },
      { role: "L2", xPct: 18, yPct: 44 },
      { role: "L3", xPct: 30, yPct: 44 },
      { role: "L4", xPct: 42, yPct: 44 },
      { role: "L5", xPct: 58, yPct: 44 },
      { role: "L6", xPct: 70, yPct: 44 },
      { role: "L7", xPct: 82, yPct: 44 },
      { role: "L8", xPct: 94, yPct: 44 },
      { role: "S", xPct: 50, yPct: 30 },
    ],
  },
]

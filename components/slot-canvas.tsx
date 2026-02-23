"use client"

import { Slot } from "./slot"
import { FORMATIONS, Formation, validateNoOverlap, resolveCollisions } from "./slot-formations"

interface Player {
  id: string
  firstName: string
  lastName: string
  jerseyNumber: number | null
  positionGroup: string | null
  status: string
  imageUrl?: string | null
}

interface DepthChartEntry {
  id: string
  unit: string
  position: string
  string: number
  playerId: string | null
  player?: Player | null
  formation?: string | null
  specialTeamType?: string | null
}

interface SlotCanvasProps {
  formationId: string
  unit: string
  depthChart: DepthChartEntry[]
  primaryColor: string
  secondaryColor: string
  canEdit: boolean
  onDrop: (role: string, string: number, playerId: string) => void
  onRemove: (role: string, string: number) => void
  onReorder: (role: string, fromString: number, toString: number) => void
}

export function SlotCanvas({
  formationId,
  unit,
  depthChart,
  primaryColor,
  secondaryColor,
  canEdit,
  onDrop,
  onRemove,
  onReorder,
}: SlotCanvasProps) {
  const formation = FORMATIONS.find((f) => f.id === formationId)

  if (!formation) {
    return (
      <div className="w-full h-96 flex items-center justify-center text-white/60">
        Formation not found
      </div>
    )
  }

  // 🔧 LAYOUT RESOLVER PIPELINE
  // 1. Start with formation slots
  // 2. Resolve any collisions automatically
  // 3. Validate the resolved layout
  // 4. Render (always render if resolvable)
  const resolvedSlots = resolveCollisions(formation.slots)
  
  // Validate after resolution
  const validation = validateNoOverlap(resolvedSlots)
  if (!validation.valid) {
    // Log warning but still attempt to render
    console.warn("Formation spacing adjusted, but some overlaps may remain:", validation.errors)
  }
  
  // Use resolved slots for rendering
  const slotsToRender = resolvedSlots

  // Get players for each slot role
  const getPlayersForRole = (role: string) => {
    return depthChart
      .filter(
        (e) =>
          e.unit === unit &&
          e.position === role &&
          e.playerId &&
          e.player &&
          e.formation === formationId
      )
      .map((e) => ({
        player: e.player!,
        string: e.string,
      }))
      .sort((a, b) => a.string - b.string)
  }

  return (
    <div
      className="relative rounded-lg overflow-hidden mx-auto"
      style={{
        backgroundColor: "#0f1115",
        width: "100%",
        maxWidth: "1200px",
        height: "820px",
        borderRadius: "12px",
      }}
    >
      {/* Canvas Container */}
      <div className="relative w-full h-full">
        {slotsToRender.map((slot) => {
          const players = getPlayersForRole(slot.role)
          return (
            <Slot
              key={slot.role}
              role={slot.role}
              xPct={slot.xPct}
              yPct={slot.yPct}
              players={players}
              primaryColor={primaryColor}
              secondaryColor={secondaryColor}
              canEdit={canEdit}
              onDrop={onDrop}
              onRemove={onRemove}
              onReorder={onReorder}
            />
          )
        })}
      </div>
    </div>
  )
}

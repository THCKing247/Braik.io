"use client"

/**
 * Emoji-based equipment icons for Braik inventory.
 */

interface EquipmentIconProps {
  className?: string
  size?: number
}

const ICON_SIZE = 24

// Equipment emoji mapping
const EQUIPMENT_EMOJIS: Record<string, string> = {
  helmet: "⛑️",
  pad: "🛡️",
  jersey: "👕",
  pant: "👖",
  chinstrap: "🔗",
  kneepad: "🦵",
  mouthpiece: "🦷",
  lock: "🔐",
  locker: "🗄️",
  wristband: "🎀",
  playcall: "🎀",
  default: "📦",
}

/**
 * Main component that returns the appropriate emoji icon based on equipment type
 */
export function EquipmentIcon({
  equipmentType,
  category,
  className,
  size = ICON_SIZE,
}: {
  equipmentType?: string | null
  category?: string
  className?: string
  size?: number
}) {
  const type = (equipmentType || category || "").toLowerCase()

  // Determine which emoji to use
  let emoji = EQUIPMENT_EMOJIS.default

  if (type.includes("helmet")) {
    emoji = EQUIPMENT_EMOJIS.helmet
  } else if (type.includes("shoulder") || (type.includes("pad") && !type.includes("knee"))) {
    emoji = EQUIPMENT_EMOJIS.pad
  } else if (type.includes("jersey")) {
    emoji = EQUIPMENT_EMOJIS.jersey
  } else if (type.includes("pant")) {
    emoji = EQUIPMENT_EMOJIS.pant
  } else if (type.includes("chinstrap")) {
    emoji = EQUIPMENT_EMOJIS.chinstrap
  } else if (type.includes("knee") && type.includes("pad")) {
    emoji = EQUIPMENT_EMOJIS.kneepad
  } else if (type.includes("mouthpiece")) {
    emoji = EQUIPMENT_EMOJIS.mouthpiece
  } else if (type.includes("lock") && !type.includes("locker")) {
    emoji = EQUIPMENT_EMOJIS.lock
  } else if (type.includes("locker")) {
    emoji = EQUIPMENT_EMOJIS.locker
  } else if (type.includes("wristband") || type.includes("playcall")) {
    emoji = EQUIPMENT_EMOJIS.wristband
  }

  return (
    <span
      className={className}
      style={{
        fontSize: `${size}px`,
        lineHeight: 1,
        display: "inline-block",
      }}
      role="img"
      aria-label={equipmentType || category || "Equipment"}
    >
      {emoji}
    </span>
  )
}

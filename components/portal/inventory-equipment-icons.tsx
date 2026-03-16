"use client"

/**
 * Custom outlined equipment icons for Braik inventory.
 * Icons are designed as clean outlined monoline icons matching actual equipment items.
 * Style: Outlined icons with consistent stroke width, rounded corners, and smooth line endings.
 * Based on the Braik Inventory Icon Reference sheet.
 */

interface EquipmentIconProps {
  className?: string
  size?: number
}

const ICON_SIZE = 24
const STROKE_WIDTH = 1.5

// Helmet Icon - Football helmet with face mask (SIDE VIEW)
export function HelmetIcon({ className, size = ICON_SIZE }: EquipmentIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width={size}
      height={size}
      aria-hidden
    >
      {/* Helmet shell - side profile */}
      <path
        d="M6 8c0-2 2-4 4-4h4c2 0 4 2 4 4v3c0 1.5-1 3-2 3.5L16 19H8l-2-4.5C5 14 4 12.5 4 11V8z"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Face mask bars */}
      <path
        d="M6 10h12M6 12h12M8 8v6M10 8v6M12 8v6M14 8v6M16 8v6"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// Shoulder Pads Icon - Pair of football shoulder pads
export function ShoulderPadsIcon({ className, size = ICON_SIZE }: EquipmentIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width={size}
      height={size}
      aria-hidden
    >
      {/* Left shoulder pad */}
      <path
        d="M4 8c0-1 1-2 2-2h2c1 0 2 1 2 2v2c0 1-1 2-2 2H6c-1 0-2-1-2-2V8z"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Right shoulder pad */}
      <path
        d="M14 8c0-1 1-2 2-2h2c1 0 2 1 2 2v2c0 1-1 2-2 2h-2c-1 0-2-1-2-2V8z"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Center connection */}
      <path
        d="M12 6v14M6 10h12"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// Jersey Icon - Football jersey with number "88" on the front
export function JerseyIcon({ className, size = ICON_SIZE }: EquipmentIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width={size}
      height={size}
      aria-hidden
    >
      {/* Jersey outline */}
      <path
        d="M8 3h8c1 0 2 1 2 2v14c0 1-1 2-2 2H8c-1 0-2-1-2-2V5c0-1 1-2 2-2z"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Shoulder lines */}
      <path
        d="M8 7h8M8 11h8"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Neck opening */}
      <path
        d="M12 3v4"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Number "88" */}
      <text x="12" y="13" textAnchor="middle" fontSize="6" fill="currentColor" fontWeight="bold">88</text>
    </svg>
  )
}

// Pants Icon - Football pants with padding on thighs and knees
export function PantsIcon({ className, size = ICON_SIZE }: EquipmentIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width={size}
      height={size}
      aria-hidden
    >
      {/* Waistband */}
      <path
        d="M8 3h8v5c0 1-1 2-2 2h-4c-1 0-2-1-2-2V3z"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Left leg */}
      <path
        d="M8 10v11M10 10h4"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Right leg */}
      <path
        d="M16 10v11"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Thigh padding - left */}
      <ellipse
        cx="10"
        cy="7"
        rx="1.5"
        ry="2"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Thigh padding - right */}
      <ellipse
        cx="14"
        cy="7"
        rx="1.5"
        ry="2"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Knee padding - left */}
      <ellipse
        cx="10"
        cy="14"
        rx="1.5"
        ry="2"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Knee padding - right */}
      <ellipse
        cx="14"
        cy="14"
        rx="1.5"
        ry="2"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// Chinstrap Icon - Chinstrap for helmet
export function ChinstrapIcon({ className, size = ICON_SIZE }: EquipmentIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width={size}
      height={size}
      aria-hidden
    >
      {/* Main strap */}
      <path
        d="M6 8h12M6 8c0-1 1-2 2-2h8c1 0 2 1 2 2M6 8v8M18 8v8"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Attachment points */}
      <circle
        cx="9"
        cy="12"
        r="1.5"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="15"
        cy="12"
        r="1.5"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// Knee Pad Icon - Single knee pad (not a pair)
export function KneePadIcon({ className, size = ICON_SIZE }: EquipmentIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width={size}
      height={size}
      aria-hidden
    >
      {/* Single knee pad - centered */}
      <ellipse
        cx="12"
        cy="12"
        rx="3"
        ry="4"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Vertical detail line */}
      <path
        d="M12 8v8"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// Mouthguard/Mouthpiece Icon - U-shaped mouthguard
export function MouthpieceIcon({ className, size = ICON_SIZE }: EquipmentIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width={size}
      height={size}
      aria-hidden
    >
      {/* U-shaped mouthguard */}
      <path
        d="M8 10c0-2 2-4 4-4s4 2 4 4v4c0 2-2 4-4 4s-4-2-4-4v-4z"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Attachment tabs */}
      <path
        d="M12 6v2M12 16v2"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// Lock Icon - Padlock
export function LockIcon({ className, size = ICON_SIZE }: EquipmentIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width={size}
      height={size}
      aria-hidden
    >
      {/* Lock body */}
      <rect
        x="6"
        y="10"
        width="12"
        height="10"
        rx="1"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Lock shackle */}
      <path
        d="M8 10V7a4 4 0 0 1 8 0v3"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Keyhole */}
      <circle
        cx="12"
        cy="15"
        r="1.5"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// Locker Icon - Tall rectangular locker with vent and handle
export function LockerIcon({ className, size = ICON_SIZE }: EquipmentIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width={size}
      height={size}
      aria-hidden
    >
      {/* Locker frame */}
      <rect
        x="4"
        y="4"
        width="16"
        height="16"
        rx="1"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Vertical dividers */}
      <path
        d="M8 4v16M16 4v16"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Horizontal dividers */}
      <path
        d="M4 8h16M4 16h16"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Vent at top */}
      <path
        d="M10 5h4M12 4v2"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Handles */}
      <circle
        cx="10"
        cy="12"
        r="1"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="14"
        cy="12"
        r="1"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// Wristband/Playcall Icon - Wristband/playcall band
export function WristbandIcon({ className, size = ICON_SIZE }: EquipmentIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width={size}
      height={size}
      aria-hidden
    >
      {/* Wristband band */}
      <ellipse
        cx="12"
        cy="12"
        rx="8"
        ry="3"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Detail lines */}
      <path
        d="M4 12h16M8 10v4M16 10v4"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// Equipment Bag Icon (for default/unknown items) - Duffel bag
export function EquipmentBagIcon({ className, size = ICON_SIZE }: EquipmentIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width={size}
      height={size}
      aria-hidden
    >
      {/* Bag body */}
      <path
        d="M6 6h12v12c0 1-1 2-2 2H8c-1 0-2-1-2-2V6z"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Top handle/opening */}
      <path
        d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M6 10h12"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Detail lines */}
      <path
        d="M9 14h6M9 17h6"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * Main component that returns the appropriate icon based on equipment type
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

  if (type.includes("helmet")) {
    return <HelmetIcon className={className} size={size} />
  }
  if (type.includes("shoulder") || (type.includes("pad") && !type.includes("knee"))) {
    return <ShoulderPadsIcon className={className} size={size} />
  }
  if (type.includes("jersey")) {
    return <JerseyIcon className={className} size={size} />
  }
  if (type.includes("pant")) {
    return <PantsIcon className={className} size={size} />
  }
  if (type.includes("chinstrap")) {
    return <ChinstrapIcon className={className} size={size} />
  }
  if (type.includes("knee") && type.includes("pad")) {
    return <KneePadIcon className={className} size={size} />
  }
  if (type.includes("mouthpiece") || type.includes("mouthguard")) {
    return <MouthpieceIcon className={className} size={size} />
  }
  if (type.includes("lock") && !type.includes("locker")) {
    return <LockIcon className={className} size={size} />
  }
  if (type.includes("locker")) {
    return <LockerIcon className={className} size={size} />
  }
  if (type.includes("wristband") || type.includes("playcall")) {
    return <WristbandIcon className={className} size={size} />
  }

  // Default to equipment bag for unknown items
  return <EquipmentBagIcon className={className} size={size} />
}

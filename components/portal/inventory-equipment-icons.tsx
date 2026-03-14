"use client"

/**
 * Custom outlined monoline football equipment icons for Braik inventory.
 * All icons use consistent stroke width, rounded corners, and smooth line endings.
 */

interface EquipmentIconProps {
  className?: string
  size?: number
}

const ICON_SIZE = 24
const STROKE_WIDTH = 1.5

// Helmets Icon
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
      <path
        d="M12 4C8 4 5 6.5 5 10v2c0 1.5 1 3 2.5 3.5L8 20h8l.5-4.5C18 15 19 13.5 19 12v-2c0-3.5-3-6-7-6z"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 10h8M10 7h4"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// Shoulder Pads Icon
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
      <path
        d="M6 8c0-1.5 1-3 2.5-3h7c1.5 0 2.5 1.5 2.5 3v2c0 1-1 2-2 2H8c-1 0-2-1-2-2V8z"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 10v4c0 1 1 2 2 2h8c1 0 2-1 2-2v-4M12 6v14"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 12h2M18 12h2"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// Jerseys Icon
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
      <path
        d="M8 4h8c1 0 2 1 2 2v14c0 1-1 2-2 2H8c-1 0-2-1-2-2V6c0-1 1-2 2-2z"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 8h8M8 12h8M12 4v4"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="16" r="1.5" stroke="currentColor" strokeWidth={STROKE_WIDTH} />
    </svg>
  )
}

// Pants Icon
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
      <path
        d="M8 4h8v6c0 1-1 2-2 2h-4c-1 0-2-1-2-2V4z"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 12v8M16 12v8M10 12h4"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// Chinstrap Icon
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
      <path
        d="M6 8h12M6 8c0-1 1-2 2-2h8c1 0 2 1 2 2M6 8v8M18 8v8"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="12" r="1.5" stroke="currentColor" strokeWidth={STROKE_WIDTH} />
      <circle cx="15" cy="12" r="1.5" stroke="currentColor" strokeWidth={STROKE_WIDTH} />
    </svg>
  )
}

// Knee Pads Icon
export function KneePadsIcon({ className, size = ICON_SIZE }: EquipmentIconProps) {
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
      <ellipse
        cx="8"
        cy="12"
        rx="3"
        ry="4"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <ellipse
        cx="16"
        cy="12"
        rx="3"
        ry="4"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 8v8M16 8v8"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// Mouthpiece Icon
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
      <path
        d="M8 10c0-2 2-4 4-4s4 2 4 4v4c0 2-2 4-4 4s-4-2-4-4v-4z"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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

// Lock Icon
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
      <path
        d="M8 10V7a4 4 0 0 1 8 0v3"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="15" r="1.5" stroke="currentColor" strokeWidth={STROKE_WIDTH} />
    </svg>
  )
}

// Locker Icon
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
      <path
        d="M8 4v16M16 4v16M4 8h16M4 16h16"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="12" r="1" stroke="currentColor" strokeWidth={STROKE_WIDTH} />
      <circle cx="14" cy="12" r="1" stroke="currentColor" strokeWidth={STROKE_WIDTH} />
    </svg>
  )
}

// Wristband Icon
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

// Equipment Box / Unknown Items Icon
export function EquipmentBoxIcon({ className, size = ICON_SIZE }: EquipmentIconProps) {
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
      <rect
        x="4"
        y="6"
        width="16"
        height="14"
        rx="1"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 10h16M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"
        stroke="currentColor"
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
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
    return <KneePadsIcon className={className} size={size} />
  }
  if (type.includes("mouthpiece")) {
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

  // Default to equipment box for unknown items
  return <EquipmentBoxIcon className={className} size={size} />
}

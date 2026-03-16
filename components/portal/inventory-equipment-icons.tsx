"use client"

/**
 * Custom outlined equipment icons for Braik inventory.
 * Icons are designed as clean silhouettes matching actual equipment items.
 * Style: Solid black silhouettes with minimal detail, similar to sports equipment icon pack.
 */

interface EquipmentIconProps {
  className?: string
  size?: number
}

const ICON_SIZE = 24

// Helmet Icon - Football helmet with face mask
export function HelmetIcon({ className, size = ICON_SIZE }: EquipmentIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width={size}
      height={size}
      aria-hidden
    >
      <path d="M12 3C8 3 5 5.5 5 9v2c0 1.5 1 3 2.5 3.5L8 19h8l.5-4.5C18 14 19 12.5 19 11V9c0-3.5-3-6-7-6z" />
      <path d="M7 9h10M9 6h6" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
    </svg>
  )
}

// Shoulder Pads Icon
export function ShoulderPadsIcon({ className, size = ICON_SIZE }: EquipmentIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width={size}
      height={size}
      aria-hidden
    >
      <path d="M6 7c0-1.5 1-3 2.5-3h7c1.5 0 2.5 1.5 2.5 3v2c0 1-1 2-2 2H8c-1 0-2-1-2-2V7z" />
      <path d="M6 9v4c0 1 1 2 2 2h8c1 0 2-1 2-2V9M12 5v14" />
      <path d="M4 11h2M18 11h2" />
    </svg>
  )
}

// Jersey Icon - Football jersey with number
export function JerseyIcon({ className, size = ICON_SIZE }: EquipmentIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width={size}
      height={size}
      aria-hidden
    >
      <path d="M8 3h8c1 0 2 1 2 2v14c0 1-1 2-2 2H8c-1 0-2-1-2-2V5c0-1 1-2 2-2z" />
      <path d="M8 7h8M8 11h8" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <path d="M12 3v4" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <circle cx="12" cy="16" r="1.5" fill="currentColor" opacity="0.3" />
      <text x="12" y="13" textAnchor="middle" fontSize="5" fill="currentColor" opacity="0.4" fontWeight="bold">88</text>
    </svg>
  )
}

// Pants Icon - Football pants with padding
export function PantsIcon({ className, size = ICON_SIZE }: EquipmentIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width={size}
      height={size}
      aria-hidden
    >
      <path d="M8 3h8v6c0 1-1 2-2 2h-4c-1 0-2-1-2-2V3z" />
      <path d="M8 11v10M16 11v10M10 11h4" />
      <ellipse cx="10" cy="7" rx="1.5" ry="2" fill="currentColor" opacity="0.3" />
      <ellipse cx="14" cy="7" rx="1.5" ry="2" fill="currentColor" opacity="0.3" />
    </svg>
  )
}

// Chinstrap Icon
export function ChinstrapIcon({ className, size = ICON_SIZE }: EquipmentIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width={size}
      height={size}
      aria-hidden
    >
      <path d="M6 7h12M6 7c0-1 1-2 2-2h8c1 0 2 1 2 2M6 7v10M18 7v10" />
      <circle cx="9" cy="12" r="1.5" fill="currentColor" opacity="0.3" />
      <circle cx="15" cy="12" r="1.5" fill="currentColor" opacity="0.3" />
    </svg>
  )
}

// Knee Pad Icon
export function KneePadIcon({ className, size = ICON_SIZE }: EquipmentIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width={size}
      height={size}
      aria-hidden
    >
      <ellipse cx="8" cy="12" rx="3" ry="4" />
      <ellipse cx="16" cy="12" rx="3" ry="4" />
      <path d="M8 8v8M16 8v8" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
    </svg>
  )
}

// Mouthguard/Mouthpiece Icon
export function MouthpieceIcon({ className, size = ICON_SIZE }: EquipmentIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width={size}
      height={size}
      aria-hidden
    >
      <path d="M8 10c0-2 2-4 4-4s4 2 4 4v4c0 2-2 4-4 4s-4-2-4-4v-4z" />
      <path d="M12 6v2M12 16v2" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
    </svg>
  )
}

// Lock Icon
export function LockIcon({ className, size = ICON_SIZE }: EquipmentIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width={size}
      height={size}
      aria-hidden
    >
      <rect x="6" y="10" width="12" height="10" rx="1" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <circle cx="12" cy="15" r="1.5" fill="currentColor" opacity="0.3" />
    </svg>
  )
}

// Locker Icon
export function LockerIcon({ className, size = ICON_SIZE }: EquipmentIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width={size}
      height={size}
      aria-hidden
    >
      <rect x="4" y="4" width="16" height="16" rx="1" />
      <path d="M8 4v16M16 4v16M4 8h16M4 16h16" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <circle cx="10" cy="12" r="1" fill="currentColor" opacity="0.3" />
      <circle cx="14" cy="12" r="1" fill="currentColor" opacity="0.3" />
    </svg>
  )
}

// Wristband/Playcall Icon
export function WristbandIcon({ className, size = ICON_SIZE }: EquipmentIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width={size}
      height={size}
      aria-hidden
    >
      <ellipse cx="12" cy="12" rx="8" ry="3" />
      <path d="M4 12h16M8 10v4M16 10v4" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
    </svg>
  )
}

// Equipment Bag Icon (for default/unknown items)
export function EquipmentBagIcon({ className, size = ICON_SIZE }: EquipmentIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      width={size}
      height={size}
      aria-hidden
    >
      <path d="M6 6h12v12c0 1-1 2-2 2H8c-1 0-2-1-2-2V6z" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M6 10h12" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <path d="M9 14h6M9 17h6" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
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

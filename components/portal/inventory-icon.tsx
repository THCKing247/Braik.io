"use client"

import Image from "next/image"

interface InventoryIconProps {
  type?: string
  equipmentType?: string | null
  category?: string
  className?: string
  size?: number
}

/**
 * Maps inventory item types to their corresponding transparent WebP icon files.
 * Returns the appropriate icon based on the type prop (with fallback to equipmentType/category for backward compatibility).
 * Icons are transparent WebPs with black silhouettes and hover effects.
 */
export function InventoryIcon({ 
  type, 
  equipmentType, 
  category, 
  className = "", 
  size = 28 
}: InventoryIconProps) {
  // Use type if provided, otherwise fall back to equipmentType or category for backward compatibility
  const itemType = (type || equipmentType || category || "").toLowerCase().trim()

  // Map item types to icon file names - matches actual equipment type names from the system
  const iconMap: Record<string, string> = {
    // Exact matches for preset equipment types
    "helmets": "helmet.webp",
    "helmet": "helmet.webp",
    "pads": "shoulder_pads.webp",
    "shoulder_pads": "shoulder_pads.webp",
    "shoulder pads": "shoulder_pads.webp",
    "shoulderpad": "shoulder_pads.webp",
    "shoulder pad": "shoulder_pads.webp",
    "practice jerseys": "jersey.webp",
    "home jersey": "jersey.webp",
    "away jersey": "jersey.webp",
    "alternate jersey": "jersey.webp",
    "jersey": "jersey.webp",
    "jerseys": "jersey.webp",
    "home pants": "football_pants.webp",
    "away pants": "football_pants.webp",
    "alternate pants": "football_pants.webp",
    "practice pants": "football_pants.webp",
    "pants": "football_pants.webp",
    "football pants": "football_pants.webp",
    "chinstraps": "chinstrap.webp",
    "chinstrap": "chinstrap.webp",
    "knee pads": "knee_pad.webp",
    "knee_pad": "knee_pad.webp",
    "knee pad": "knee_pad.webp",
    "kneepad": "knee_pad.webp",
    "kneepads": "knee_pad.webp",
    "mouthpieces": "mouthguard.webp",
    "mouthpiece": "mouthguard.webp",
    "mouthguard": "mouthguard.webp",
    "locks": "lock.webp",
    "lock": "lock.webp",
    "lockers": "locker.webp",
    "locker": "locker.webp",
    "playcall wristbands": "equipment_bag.webp",
    "wristband": "equipment_bag.webp",
    "wristbands": "equipment_bag.webp",
    // Additional common types
    "football": "football.webp",
    "gloves": "gloves.webp",
    "cleats": "cleats.webp",
    "equipment_bag": "equipment_bag.webp",
    "equipment bag": "equipment_bag.webp",
    "equipmentbag": "equipment_bag.webp",
    "whistle": "whistle.webp",
    "water_bottle": "water_bottle.webp",
    "water bottle": "water_bottle.webp",
    "waterbottle": "water_bottle.webp",
  }

  // Find matching icon (check for partial matches too)
  let iconFile = iconMap[itemType]
  
  if (!iconFile) {
    // Try partial matching for compound terms
    if (itemType.includes("helmet")) {
      iconFile = "helmet.webp"
    } else if (itemType.includes("shoulder") || (itemType.includes("pad") && !itemType.includes("knee"))) {
      iconFile = "shoulder_pads.webp"
    } else if (itemType.includes("jersey")) {
      iconFile = "jersey.webp"
    } else if (itemType.includes("pant")) {
      iconFile = "football_pants.webp"
    } else if (itemType.includes("knee") && itemType.includes("pad")) {
      iconFile = "knee_pad.webp"
    } else if (itemType.includes("mouth")) {
      iconFile = "mouthguard.webp"
    } else if (itemType.includes("chinstrap")) {
      iconFile = "chinstrap.webp"
    } else if (itemType.includes("locker")) {
      iconFile = "locker.webp"
    } else if (itemType.includes("lock") && !itemType.includes("locker")) {
      iconFile = "lock.webp"
    } else if (itemType.includes("equipment") && itemType.includes("bag")) {
      iconFile = "equipment_bag.webp"
    } else if (itemType.includes("water")) {
      iconFile = "water_bottle.webp"
    } else if (itemType.includes("wristband") || itemType.includes("playcall")) {
      iconFile = "equipment_bag.webp"
    } else {
      // Default to equipment bag for unknown items
      iconFile = "equipment_bag.webp"
    }
  }

  return (
    <div
      className={`inventory-icon-wrap flex-shrink-0 ${className}`}
      style={{ 
        width: `${size}px`, 
        height: `${size}px`,
      }}
    >
      <Image
        src={`/images/inventory/${iconFile}`}
        alt={itemType || "equipment"}
        width={size}
        height={size}
        className="block w-full h-full object-contain"
        style={{
          opacity: 0.9,
          transition: "opacity 0.15s ease",
        }}
        unoptimized
      />
    </div>
  )
}

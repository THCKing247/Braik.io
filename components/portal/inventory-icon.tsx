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
 * Maps inventory item types to their corresponding transparent PNG icon files.
 * Returns the appropriate icon based on the type prop (with fallback to equipmentType/category for backward compatibility).
 * Icons are transparent PNGs with black silhouettes and hover effects.
 */
export function InventoryIcon({ 
  type, 
  equipmentType, 
  category, 
  className = "", 
  size = 100 
}: InventoryIconProps) {
  // Use type if provided, otherwise fall back to equipmentType or category for backward compatibility
  const itemType = (type || equipmentType || category || "").toLowerCase().trim()

  // Map item types to icon file names - matches actual equipment type names from the system
  const iconMap: Record<string, string> = {
    // Exact matches for preset equipment types
    "helmets": "helmet.png",
    "helmet": "helmet.png",
    "pads": "shoulder_pads.png",
    "shoulder_pads": "shoulder_pads.png",
    "shoulder pads": "shoulder_pads.png",
    "shoulderpad": "shoulder_pads.png",
    "shoulder pad": "shoulder_pads.png",
    "practice jerseys": "jersey.png",
    "home jersey": "jersey.png",
    "away jersey": "jersey.png",
    "alternate jersey": "jersey.png",
    "jersey": "jersey.png",
    "jerseys": "jersey.png",
    "home pants": "football_pants.png",
    "away pants": "football_pants.png",
    "alternate pants": "football_pants.png",
    "practice pants": "football_pants.png",
    "pants": "football_pants.png",
    "football pants": "football_pants.png",
    "chinstraps": "chinstrap.png",
    "chinstrap": "chinstrap.png",
    "knee pads": "knee_pad.png",
    "knee_pad": "knee_pad.png",
    "knee pad": "knee_pad.png",
    "kneepad": "knee_pad.png",
    "kneepads": "knee_pad.png",
    "mouthpieces": "mouthguard.png",
    "mouthpiece": "mouthguard.png",
    "mouthguard": "mouthguard.png",
    "locks": "lock.png",
    "lock": "lock.png",
    "lockers": "locker.png",
    "locker": "locker.png",
    "playcall wristbands": "equipment_bag.png",
    "wristband": "equipment_bag.png",
    "wristbands": "equipment_bag.png",
    // Additional common types
    "football": "football.png",
    "gloves": "gloves.png",
    "cleats": "cleats.png",
    "equipment_bag": "equipment_bag.png",
    "equipment bag": "equipment_bag.png",
    "equipmentbag": "equipment_bag.png",
    "whistle": "whistle.png",
    "water_bottle": "water_bottle.png",
    "water bottle": "water_bottle.png",
    "waterbottle": "water_bottle.png",
  }

  // Find matching icon (check for partial matches too)
  let iconFile = iconMap[itemType]
  
  if (!iconFile) {
    // Try partial matching for compound terms
    if (itemType.includes("helmet")) {
      iconFile = "helmet.png"
    } else if (itemType.includes("shoulder") || (itemType.includes("pad") && !itemType.includes("knee"))) {
      iconFile = "shoulder_pads.png"
    } else if (itemType.includes("jersey")) {
      iconFile = "jersey.png"
    } else if (itemType.includes("pant")) {
      iconFile = "football_pants.png"
    } else if (itemType.includes("knee") && itemType.includes("pad")) {
      iconFile = "knee_pad.png"
    } else if (itemType.includes("mouth")) {
      iconFile = "mouthguard.png"
    } else if (itemType.includes("chinstrap")) {
      iconFile = "chinstrap.png"
    } else if (itemType.includes("locker")) {
      iconFile = "locker.png"
    } else if (itemType.includes("lock") && !itemType.includes("locker")) {
      iconFile = "lock.png"
    } else if (itemType.includes("equipment") && itemType.includes("bag")) {
      iconFile = "equipment_bag.png"
    } else if (itemType.includes("water")) {
      iconFile = "water_bottle.png"
    } else if (itemType.includes("wristband") || itemType.includes("playcall")) {
      iconFile = "equipment_bag.png"
    } else {
      // Default to equipment bag for unknown items
      iconFile = "equipment_bag.png"
    }
  }

  return (
    <div
      className={`inventory-icon flex items-center justify-center flex-shrink-0 ${className}`}
      style={{ 
        width: size, 
        height: size, 
        minWidth: size, 
        minHeight: size,
        marginRight: "16px"
      }}
    >
      <Image
        src={`/images/inventory/${iconFile}`}
        alt={itemType || "equipment"}
        width={size}
        height={size}
        className="object-contain"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          maxWidth: `${size}px`,
          maxHeight: `${size}px`,
          opacity: 0.9,
          transition: "opacity 0.15s ease",
        }}
        unoptimized
      />
    </div>
  )
}

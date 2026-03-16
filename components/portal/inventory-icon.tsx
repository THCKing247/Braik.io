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
  size = 28 
}: InventoryIconProps) {
  // Use type if provided, otherwise fall back to equipmentType or category for backward compatibility
  const itemType = (type || equipmentType || category || "").toLowerCase().trim()

  // Map item types to icon file names
  const iconMap: Record<string, string> = {
    helmet: "helmet.png",
    shoulder_pads: "shoulder_pads.png",
    "shoulder pads": "shoulder_pads.png",
    "shoulderpad": "shoulder_pads.png",
    "shoulder pad": "shoulder_pads.png",
    football: "football.png",
    jersey: "jersey.png",
    pants: "football_pants.png",
    "football pants": "football_pants.png",
    gloves: "gloves.png",
    cleats: "cleats.png",
    mouthguard: "mouthguard.png",
    mouthpiece: "mouthguard.png",
    chinstrap: "chinstrap.png",
    knee_pad: "knee_pad.png",
    "knee pad": "knee_pad.png",
    "kneepad": "knee_pad.png",
    "knee pads": "knee_pad.png",
    locker: "locker.png",
    equipment_bag: "equipment_bag.png",
    "equipment bag": "equipment_bag.png",
    "equipmentbag": "equipment_bag.png",
    whistle: "whistle.png",
    water_bottle: "water_bottle.png",
    "water bottle": "water_bottle.png",
    "waterbottle": "water_bottle.png",
    lock: "lock.png",
  }

  // Find matching icon (check for partial matches too)
  let iconFile = iconMap[itemType]
  
  if (!iconFile) {
    // Try partial matching for compound terms
    if (itemType.includes("shoulder")) {
      iconFile = "shoulder_pads.png"
    } else if (itemType.includes("pant")) {
      iconFile = "football_pants.png"
    } else if (itemType.includes("knee") && itemType.includes("pad")) {
      iconFile = "knee_pad.png"
    } else if (itemType.includes("mouth")) {
      iconFile = "mouthguard.png"
    } else if (itemType.includes("equipment") && itemType.includes("bag")) {
      iconFile = "equipment_bag.png"
    } else if (itemType.includes("water")) {
      iconFile = "water_bottle.png"
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
        marginRight: "10px"
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

"use client"

import Image from "next/image"

interface InventoryIconProps {
  itemType?: string
  equipmentType?: string | null
  category?: string
  className?: string
  size?: number
}

/**
 * Maps inventory item types to their corresponding PNG icon files.
 * Returns the appropriate icon based on the itemType, equipmentType, or category prop.
 * Compatible with existing EquipmentIcon API for easy migration.
 */
export function InventoryIcon({ 
  itemType, 
  equipmentType, 
  category, 
  className = "", 
  size = 28 
}: InventoryIconProps) {
  // Use itemType if provided, otherwise fall back to equipmentType or category
  const type = (itemType || equipmentType || category || "").toLowerCase().trim()
  const normalizedType = type

  // Map item types to icon file names
  const iconMap: Record<string, string> = {
    football: "football.png",
    helmet: "helmet.png",
    "shoulder pads": "shoulder_pads.png",
    "shoulderpad": "shoulder_pads.png",
    "shoulder pad": "shoulder_pads.png",
    jersey: "jersey.png",
    pants: "football_pants.png",
    "football pants": "football_pants.png",
    gloves: "gloves.png",
    cleats: "cleats.png",
    mouthpiece: "mouthguard.png",
    mouthguard: "mouthguard.png",
    chinstrap: "chinstrap.png",
    "knee pad": "knee_pad.png",
    "kneepad": "knee_pad.png",
    "knee pads": "knee_pad.png",
    locker: "locker.png",
    "equipment bag": "equipment_bag.png",
    "equipmentbag": "equipment_bag.png",
    whistle: "whistle.png",
    "water bottle": "water_bottle.png",
    "waterbottle": "water_bottle.png",
    lock: "lock.png",
  }

  // Find matching icon (check for partial matches too)
  let iconFile = iconMap[normalizedType]
  
  if (!iconFile) {
    // Try partial matching for compound terms
    if (normalizedType.includes("shoulder")) {
      iconFile = "shoulder_pads.png"
    } else if (normalizedType.includes("pant")) {
      iconFile = "football_pants.png"
    } else if (normalizedType.includes("knee") && normalizedType.includes("pad")) {
      iconFile = "knee_pad.png"
    } else if (normalizedType.includes("mouth")) {
      iconFile = "mouthguard.png"
    } else if (normalizedType.includes("equipment") && normalizedType.includes("bag")) {
      iconFile = "equipment_bag.png"
    } else if (normalizedType.includes("water")) {
      iconFile = "water_bottle.png"
    } else {
      // Default to equipment bag for unknown items
      iconFile = "equipment_bag.png"
    }
  }

  return (
    <div
      className={`flex items-center justify-center flex-shrink-0 ${className}`}
      style={{ width: size, height: size, minWidth: size, minHeight: size }}
    >
      <Image
        src={`/images/inventory/${iconFile}`}
        alt={type || "equipment"}
        width={size}
        height={size}
        className="object-contain"
        style={{
          filter: "brightness(0) saturate(100%)", // Make icons monochrome (black)
          width: `${size}px`,
          height: `${size}px`,
          maxWidth: `${size}px`,
          maxHeight: `${size}px`,
        }}
        unoptimized
      />
    </div>
  )
}

"use client"

import { Button } from "@/components/ui/button"
import { Circle, Square, Triangle, Pencil, X } from "lucide-react"
import type { SideOfBall } from "@/types/playbook"

// Custom upside-down triangle icon for defense
const TriangleDown = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2L2 22h20L12 2z" />
  </svg>
)

interface PlaybookShapePaletteProps {
  currentSide: SideOfBall
  selectedTool: string
  onSelectTool: (tool: string) => void
  isTemplateMode: boolean
  canEdit: boolean
}

export function PlaybookShapePalette({
  currentSide,
  selectedTool,
  onSelectTool,
  isTemplateMode,
  canEdit,
}: PlaybookShapePaletteProps) {
  // Determine which shapes are available for the current side
  const getShapeAvailability = (shapeType: string) => {
    if (!isTemplateMode) return true // In play mode, all shapes available
    
    // In template mode, only show shapes for current side
    if (currentSide === "offense") {
      return shapeType === "circle" || shapeType === "square"
    }
    if (currentSide === "defense") {
      return shapeType === "triangle"
    }
    if (currentSide === "special_teams") {
      return true // Special teams can use all shapes
    }
    return false
  }

  const shapes = [
    { id: "circle", label: "Circle", icon: Circle, available: getShapeAvailability("circle") },
    { id: "square", label: "Square", icon: Square, available: getShapeAvailability("square") },
    { id: "triangle", label: "Triangle", icon: TriangleDown, available: getShapeAvailability("triangle") },
  ]

  const lines = [
    { id: "route", label: "Route", icon: Pencil, available: !isTemplateMode && currentSide === "offense" },
    { id: "block", label: "Block", icon: Square, available: !isTemplateMode && currentSide === "offense" },
    { id: "zone", label: "Zone", icon: Circle, available: !isTemplateMode && currentSide === "defense" },
    { id: "man", label: "Man", icon: X, available: !isTemplateMode && currentSide === "defense" },
  ]

  return (
    <div className="w-48 border-r-2 p-2 flex flex-col gap-2 flex-shrink-0" style={{ borderRightColor: "#0B2A5B", backgroundColor: "#FFFFFF" }}>
      <div>
        <h3 className="text-xs font-semibold mb-1.5" style={{ color: "#0B2A5B" }}>
          Shapes
        </h3>
        <div className="flex flex-col gap-1">
          {shapes.map((shape) => (
            <Button
              key={shape.id}
              variant={selectedTool === shape.id ? "default" : "outline"}
              size="sm"
              className="w-full justify-start h-8 px-2"
              onClick={() => canEdit && shape.available && onSelectTool(shape.id)}
              disabled={!canEdit || !shape.available}
              style={{
                opacity: shape.available ? 1 : 0.4,
                cursor: shape.available && canEdit ? "pointer" : "not-allowed",
              }}
              title={shape.label}
            >
              <shape.icon className="h-3.5 w-3.5 mr-1.5" />
              <span className="text-xs">{shape.label}</span>
            </Button>
          ))}
        </div>
      </div>

      {!isTemplateMode && (
        <div>
          <h3 className="text-xs font-semibold mb-1.5" style={{ color: "#0B2A5B" }}>
            Lines
          </h3>
          <div className="flex flex-col gap-1">
            {lines.map((line) => (
              <Button
                key={line.id}
                variant={selectedTool === line.id ? "default" : "outline"}
                size="sm"
                className="w-full justify-start h-8 px-2"
                onClick={() => canEdit && line.available && onSelectTool(line.id)}
                disabled={!canEdit || !line.available}
                style={{
                  opacity: line.available ? 1 : 0.4,
                  cursor: line.available && canEdit ? "pointer" : "not-allowed",
                }}
                title={line.label}
              >
                <line.icon className="h-3.5 w-3.5 mr-1.5" />
                <span className="text-xs">{line.label}</span>
              </Button>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-xs font-semibold mb-1.5" style={{ color: "#0B2A5B" }}>
          Tools
        </h3>
        <div className="flex flex-col gap-1">
          <Button
            variant={selectedTool === "select" ? "default" : "outline"}
            size="sm"
            className="w-full justify-start h-8 px-2"
            onClick={() => canEdit && onSelectTool("select")}
            disabled={!canEdit}
            title="Select"
          >
            <svg className="h-3.5 w-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
            </svg>
            <span className="text-xs">Select</span>
          </Button>
          <Button
            variant={selectedTool === "erase" ? "default" : "outline"}
            size="sm"
            className="w-full justify-start h-8 px-2"
            onClick={() => canEdit && onSelectTool("erase")}
            disabled={!canEdit}
            title="Erase"
          >
            <svg className="h-3.5 w-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span className="text-xs">Erase</span>
          </Button>
        </div>
      </div>
    </div>
  )
}

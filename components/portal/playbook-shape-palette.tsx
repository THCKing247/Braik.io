"use client"

import { Button } from "@/components/ui/button"
import { Pencil, Square, Circle, X, Move } from "lucide-react"
import type { SideOfBall } from "@/types/playbook"
import { OFFENSE_POSITIONS, DEFENSE_POSITIONS, SPECIAL_POSITIONS } from "@/lib/constants/playbook-positions"

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
  const offensePositions = OFFENSE_POSITIONS
  const defensePositions = DEFENSE_POSITIONS
  const specialPositions = SPECIAL_POSITIONS

  const renderPositionButton = (code: string, label: string, shape: "circle" | "square" | "triangle") => {
    const selected = selectedTool === code
    const Icon =
      shape === "square"
        ? Square
        : shape === "triangle"
          ? TriangleDown
          : Circle
    return (
      <Button
        key={code}
        variant={selected ? "default" : "outline"}
        size="sm"
        className={`w-full justify-start h-8 px-2 ${selected ? "ring-2 ring-[#0B2A5B] ring-offset-1 border-l-4 border-l-[#0B2A5B]" : ""}`}
        onClick={() => canEdit && onSelectTool(code)}
        disabled={!canEdit}
        title={label}
      >
        <Icon className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
        <span className="text-xs truncate">{label}</span>
      </Button>
    )
  }

  return (
    <div
      className="w-52 border-r-2 p-2 flex flex-col gap-3 flex-shrink-0 overflow-y-auto"
      style={{ borderRightColor: "#0B2A5B", backgroundColor: "#FFFFFF" }}
    >
      <div>
        <h3 className="text-xs font-semibold mb-1.5" style={{ color: "#0B2A5B" }}>
          Positions
        </h3>
        {currentSide === "offense" && (
          <div className="flex flex-col gap-1">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">Offense</p>
            {offensePositions.map((p) => renderPositionButton(p.code, p.label, p.shape))}
          </div>
        )}
        {currentSide === "defense" && (
          <div className="flex flex-col gap-1">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">Defense</p>
            {defensePositions.map((p) => renderPositionButton(p.code, p.label, p.shape))}
          </div>
        )}
        {currentSide === "special_teams" && (
          <div className="flex flex-col gap-1">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide mt-0.5">Special Teams</p>
            {specialPositions.map((p) => renderPositionButton(p.code, p.label, p.shape))}
          </div>
        )}
      </div>

      {!isTemplateMode && (
        <div>
          <h3 className="text-xs font-semibold mb-1.5" style={{ color: "#0B2A5B" }}>
            Lines / Assignments
          </h3>
          <div className="flex flex-col gap-1">
            <Button
              variant={selectedTool === "route" ? "default" : "outline"}
              size="sm"
              className={`w-full justify-start h-8 px-2 ${selectedTool === "route" ? "ring-2 ring-[#0B2A5B] ring-offset-1 border-l-4 border-l-[#0B2A5B]" : ""}`}
              onClick={() => canEdit && currentSide === "offense" && onSelectTool("route")}
              disabled={!canEdit || currentSide !== "offense"}
              title="Route (R)"
            >
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              <span className="text-xs">Route</span>
            </Button>
            <Button
              variant={selectedTool === "block" ? "default" : "outline"}
              size="sm"
              className={`w-full justify-start h-8 px-2 ${selectedTool === "block" ? "ring-2 ring-[#0B2A5B] ring-offset-1 border-l-4 border-l-[#0B2A5B]" : ""}`}
              onClick={() => canEdit && currentSide === "offense" && onSelectTool("block")}
              disabled={!canEdit || currentSide !== "offense"}
              title="Block (B)"
            >
              <Square className="h-3.5 w-3.5 mr-1.5" />
              <span className="text-xs">Block</span>
            </Button>
            <Button
              variant={selectedTool === "motion" ? "default" : "outline"}
              size="sm"
              className={`w-full justify-start h-8 px-2 ${selectedTool === "motion" ? "ring-2 ring-[#0B2A5B] ring-offset-1 border-l-4 border-l-[#0B2A5B]" : ""}`}
              onClick={() => canEdit && currentSide === "offense" && onSelectTool("motion")}
              disabled={!canEdit || currentSide !== "offense"}
              title="Motion (M)"
            >
              <Move className="h-3.5 w-3.5 mr-1.5" />
              <span className="text-xs">Motion</span>
            </Button>
            <Button
              variant={selectedTool === "zone" ? "default" : "outline"}
              size="sm"
              className={`w-full justify-start h-8 px-2 ${selectedTool === "zone" ? "ring-2 ring-[#0B2A5B] ring-offset-1 border-l-4 border-l-[#0B2A5B]" : ""}`}
              onClick={() => canEdit && currentSide === "defense" && onSelectTool("zone")}
              disabled={!canEdit || currentSide !== "defense"}
              title="Zone"
            >
              <Circle className="h-3.5 w-3.5 mr-1.5" />
              <span className="text-xs">Zone</span>
            </Button>
            <Button
              variant={selectedTool === "man" ? "default" : "outline"}
              size="sm"
              className={`w-full justify-start h-8 px-2 ${selectedTool === "man" ? "ring-2 ring-[#0B2A5B] ring-offset-1 border-l-4 border-l-[#0B2A5B]" : ""}`}
              onClick={() => canEdit && currentSide === "defense" && onSelectTool("man")}
              disabled={!canEdit || currentSide !== "defense"}
              title="Man"
            >
              <X className="h-3.5 w-3.5 mr-1.5" />
              <span className="text-xs">Man</span>
            </Button>
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
            className={`w-full justify-start h-8 px-2 ${selectedTool === "select" ? "ring-2 ring-[#0B2A5B] ring-offset-1 border-l-4 border-l-[#0B2A5B]" : ""}`}
            onClick={() => canEdit && onSelectTool("select")}
            disabled={!canEdit}
            title="Select (V)"
          >
            <svg className="h-3.5 w-3.5 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
            </svg>
            <span className="text-xs">Select</span>
          </Button>
          <Button
            variant={selectedTool === "erase" ? "default" : "outline"}
            size="sm"
            className={`w-full justify-start h-8 px-2 ${selectedTool === "erase" ? "ring-2 ring-[#0B2A5B] ring-offset-1 border-l-4 border-l-[#0B2A5B]" : ""}`}
            onClick={() => canEdit && onSelectTool("erase")}
            disabled={!canEdit}
            title="Erase (E)"
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

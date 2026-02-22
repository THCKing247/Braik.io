"use client"

import React from "react"

interface PlaybookFieldSurfaceProps {
  width: number // pixels
  height: number // pixels
  yardStart: number // starting yard line (default 15) - BOTTOM of view
  yardEnd: number // ending yard line (default 50) - TOP of view
  className?: string
}

/**
 * Regulation football field surface with mathematically correct markings
 * - Field width: 53.33 yards (160 feet)
 * - Visible range: 50-yard line (TOP) to 15-yard line (BOTTOM) - 35 yards
 * - Yard lines every 5 yards (thicker at 10-yard intervals)
 * - 1-yard tick marks (4 dashes between each 5-yard line)
 * - Hash marks (inner hash marks at 25% and 75% of field width)
 * - Out-of-bounds lines at sidelines
 * - Yard numbers every 10 yards, readable from sidelines, with end zone arrows
 */
export function PlaybookFieldSurface({
  width,
  height,
  yardStart = 15,
  yardEnd = 50,
  className = "",
}: PlaybookFieldSurfaceProps) {
  // Field dimensions in yards
  const FIELD_WIDTH_YARDS = 53.33
  const VISIBLE_YARDS = yardEnd - yardStart // 35 yards default

  // Calculate pixels per yard
  const pxPerYardX = width / FIELD_WIDTH_YARDS
  const pxPerYardY = height / VISIBLE_YARDS

  // Generate yard lines (every 5 yards) - from 50 (top) to 15 (bottom)
  const yardLines: Array<{ yard: number; isTenYard: boolean }> = []
  for (let yard = yardEnd; yard >= yardStart; yard -= 5) {
    yardLines.push({
      yard,
      isTenYard: yard % 10 === 0,
    })
  }

  // Generate 1-yard tick marks between 5-yard lines (4 dashes per 5-yard segment)
  const tickMarks: Array<{ yard: number }> = []
  for (let yard = yardEnd; yard > yardStart; yard -= 1) {
    if (yard % 5 !== 0) {
      // Only ticks between 5-yard lines
      tickMarks.push({ yard })
    }
  }

  // Hash mark positions - inner hash marks (closest to midfield)
  const HASH_LEFT_INSIDE = FIELD_WIDTH_YARDS * 0.25 // Closer to midfield, left side
  const HASH_RIGHT_INSIDE = FIELD_WIDTH_YARDS * 0.75 // Closer to midfield, right side

  // Yard numbers (every 10 yards) - from 50 (top) to 15 (bottom)
  const yardNumbers: Array<{ yard: number }> = []
  for (let yard = yardEnd; yard >= yardStart; yard -= 10) {
    yardNumbers.push({ yard })
  }

  // Convert yard to Y position (yard 50 = top/0, yard 15 = bottom/height)
  const yardToY = (yard: number) => {
    const relativeYard = yardEnd - yard // 50-yard line = 0, 15-yard line = 35
    return (relativeYard / VISIBLE_YARDS) * height
  }

  return (
    <g className={className}>
      {/* Turf background */}
      <rect x="0" y="0" width={width} height={height} fill="#2d5016" />

      {/* Out-of-bounds lines (sidelines) */}
      <line
        x1="0"
        y1="0"
        x2="0"
        y2={height}
        stroke="white"
        strokeWidth="3"
        opacity="1"
      />
      <line
        x1={width}
        y1="0"
        x2={width}
        y2={height}
        stroke="white"
        strokeWidth="3"
        opacity="1"
      />

      {/* Hash marks on out-of-bounds lines (sidelines) */}
      {tickMarks.map(({ yard }) => {
        const y = yardToY(yard)
        const hashDashLength = pxPerYardY * 0.4 // Vertical dash length
        const hashWidth = pxPerYardX * 0.3 // Width of hash mark extending from sideline

        return (
          <g key={`sideline-hash-${yard}`}>
            {/* Left sideline hash marks - vertical line */}
            <line
              x1="0"
              y1={y - hashDashLength / 2}
              x2="0"
              y2={y + hashDashLength / 2}
              stroke="white"
              strokeWidth="2"
              opacity="0.8"
            />
            {/* Left sideline hash marks - horizontal extension */}
            <line
              x1="0"
              y1={y}
              x2={hashWidth}
              y2={y}
              stroke="white"
              strokeWidth="2"
              opacity="0.8"
            />
            {/* Right sideline hash marks - vertical line */}
            <line
              x1={width}
              y1={y - hashDashLength / 2}
              x2={width}
              y2={y + hashDashLength / 2}
              stroke="white"
              strokeWidth="2"
              opacity="0.8"
            />
            {/* Right sideline hash marks - horizontal extension */}
            <line
              x1={width}
              y1={y}
              x2={width - hashWidth}
              y2={y}
              stroke="white"
              strokeWidth="2"
              opacity="0.8"
            />
          </g>
        )
      })}

      {/* Yard lines (every 5 yards) */}
      {yardLines.map(({ yard, isTenYard }) => {
        const y = yardToY(yard)
        return (
          <line
            key={`yard-line-${yard}`}
            x1="0"
            y1={y}
            x2={width}
            y2={y}
            stroke="white"
            strokeWidth={isTenYard ? 2.5 : 1}
            opacity={isTenYard ? 1 : 0.7}
          />
        )
      })}

      {/* 1-yard tick marks (4 dashes between each 5-yard line) */}
      {tickMarks.map(({ yard }) => {
        const y = yardToY(yard)
        const tickLength = pxPerYardX * 0.8 // 0.8 yards wide tick
        const centerX = width / 2
        return (
          <line
            key={`tick-${yard}`}
            x1={centerX - tickLength / 2}
            y1={y}
            x2={centerX + tickLength / 2}
            y2={y}
            stroke="white"
            strokeWidth="0.8"
            opacity="0.5"
          />
        )
      })}

      {/* Hash marks (inner hash marks at 25% and 75% of field width) */}
      {tickMarks.map(({ yard }) => {
        const y = yardToY(yard)
        const hashDashLength = pxPerYardX * 0.35 // 0.35 yards wide dash

        return (
          <g key={`hash-${yard}`}>
            {/* Left side - inside hash (closer to midfield) */}
            <line
              x1={HASH_LEFT_INSIDE * pxPerYardX - hashDashLength / 2}
              y1={y}
              x2={HASH_LEFT_INSIDE * pxPerYardX + hashDashLength / 2}
              y2={y}
              stroke="white"
              strokeWidth="1.5"
              opacity="0.6"
            />
            {/* Right side - inside hash (closer to midfield) */}
            <line
              x1={HASH_RIGHT_INSIDE * pxPerYardX - hashDashLength / 2}
              y1={y}
              x2={HASH_RIGHT_INSIDE * pxPerYardX + hashDashLength / 2}
              y2={y}
              stroke="white"
              strokeWidth="1.5"
              opacity="0.6"
            />
          </g>
        )
      })}

      {/* Yard numbers (every 10 yards, readable from sidelines, with end zone arrows) */}
      {yardNumbers.map(({ yard }) => {
        const y = yardToY(yard)
        const numberStr = yard.toString()
        const numberSize = Math.min(pxPerYardY * 1.5, 28) // Scale with field size, max 28px (bigger)
        const leftX = pxPerYardX * 2.5 // 2.5 yards from left sideline
        const rightX = width - pxPerYardX * 2.5 // 2.5 yards from right sideline
        const arrowSize = numberSize * 0.3 // Arrow size relative to number

        return (
          <g key={`yard-number-${yard}`}>
            {/* Number on LEFT side - readable from RIGHT sideline (rotate 90°) */}
            <text
              x={leftX}
              y={y}
              textAnchor="middle"
              fill="white"
              fontSize={numberSize}
              fontWeight="bold"
              fontFamily="Arial, sans-serif"
              transform={`rotate(90 ${leftX} ${y})`}
            >
              {numberStr}
            </text>
            {/* Arrow on left side - points DOWN (toward end zone at bottom) */}
            <polygon
              points={`${leftX},${y + numberSize / 2 + arrowSize} ${leftX - arrowSize / 2},${y + numberSize / 2} ${leftX + arrowSize / 2},${y + numberSize / 2}`}
              fill="white"
              opacity="0.9"
            />

            {/* Number on RIGHT side - readable from LEFT sideline (rotate -90°) */}
            <text
              x={rightX}
              y={y}
              textAnchor="middle"
              fill="white"
              fontSize={numberSize}
              fontWeight="bold"
              fontFamily="Arial, sans-serif"
              transform={`rotate(-90 ${rightX} ${y})`}
            >
              {numberStr}
            </text>
            {/* Arrow on right side - points DOWN (toward end zone at bottom) */}
            <polygon
              points={`${rightX},${y + numberSize / 2 + arrowSize} ${rightX - arrowSize / 2},${y + numberSize / 2} ${rightX + arrowSize / 2},${y + numberSize / 2}`}
              fill="white"
              opacity="0.9"
            />
          </g>
        )
      })}

      {/* Line of Scrimmage marker (football on 30-yard line) */}
      {(() => {
        const losYard = 30
        if (losYard >= yardStart && losYard <= yardEnd) {
          const y = yardToY(losYard)
          const footballSize = Math.min(pxPerYardX * 0.8, 20) // Football size
          const centerX = width / 2

          return (
            <g key="line-of-scrimmage">
              {/* Football shape (oval) - rotated 90 degrees to be vertical */}
              <ellipse
                cx={centerX}
                cy={y}
                rx={footballSize * 0.4}
                ry={footballSize * 0.6}
                fill="#8B4513"
                stroke="white"
                strokeWidth="2"
                opacity="0.9"
              />
              {/* Football laces - vertical orientation */}
              <line
                x1={centerX}
                y1={y - footballSize * 0.3}
                x2={centerX}
                y2={y + footballSize * 0.3}
                stroke="white"
                strokeWidth="1.5"
                opacity="0.7"
              />
              <line
                x1={centerX - footballSize * 0.15}
                y1={y - footballSize * 0.15}
                x2={centerX + footballSize * 0.15}
                y2={y - footballSize * 0.15}
                stroke="white"
                strokeWidth="1"
                opacity="0.7"
              />
              <line
                x1={centerX - footballSize * 0.15}
                y1={y + footballSize * 0.15}
                x2={centerX + footballSize * 0.15}
                y2={y + footballSize * 0.15}
                stroke="white"
                strokeWidth="1"
                opacity="0.7"
              />
            </g>
          )
        }
        return null
      })()}
    </g>
  )
}

/**
 * Coordinate conversion utilities for yard-based system
 */
export class FieldCoordinateSystem {
  private width: number // pixels
  private height: number // pixels
  private yardStart: number // bottom yard line (15)
  private yardEnd: number // top yard line (50)
  private readonly FIELD_WIDTH_YARDS = 53.33

  constructor(width: number, height: number, yardStart: number = 15, yardEnd: number = 50) {
    this.width = width
    this.height = height
    this.yardStart = yardStart
    this.yardEnd = yardEnd
  }

  get pxPerYardX(): number {
    return this.width / this.FIELD_WIDTH_YARDS
  }

  get pxPerYardY(): number {
    return this.height / (this.yardEnd - this.yardStart)
  }

  /**
   * Convert yard coordinates to pixel coordinates
   * @param xYards - Distance from left sideline in yards (0 to 53.33)
   * @param yYards - Distance from TOP (50-yard line) in yards (0 to 35)
   */
  yardToPixel(xYards: number, yYards: number): { x: number; y: number } {
    return {
      x: xYards * this.pxPerYardX,
      y: yYards * this.pxPerYardY,
    }
  }

  /**
   * Convert pixel coordinates to yard coordinates
   * @param x - Pixel X from left edge
   * @param y - Pixel Y from top edge (50-yard line)
   */
  pixelToYard(x: number, y: number): { xYards: number; yYards: number } {
    return {
      xYards: x / this.pxPerYardX,
      yYards: y / this.pxPerYardY,
    }
  }

  /**
   * Snap Y coordinate to nearest yard tick
   */
  snapY(yYards: number): number {
    return Math.round(yYards)
  }

  /**
   * Snap X coordinate to nearest hash mark (inner hash marks) or yard increment
   */
  snapX(xYards: number): number {
    // Hash marks positions (inner hash marks)
    const hashLeftInside = this.FIELD_WIDTH_YARDS * 0.25
    const hashRightInside = this.FIELD_WIDTH_YARDS * 0.75

    // Check if near hash marks (within 0.5 yards)
    const hashes = [hashLeftInside, hashRightInside]
    for (const hash of hashes) {
      if (Math.abs(xYards - hash) < 0.5) return hash
    }

    // Otherwise snap to nearest 0.5 yard increment
    return Math.round(xYards * 2) / 2
  }

  /**
   * Get player marker size in pixels (1.25 yards diameter)
   */
  getMarkerSize(): number {
    const markerYards = 1.25
    const size = markerYards * this.pxPerYardX
    // Clamp for mobile/desktop readability
    return Math.max(24, Math.min(48, size))
  }
}

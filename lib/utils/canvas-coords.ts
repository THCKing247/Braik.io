/**
 * SVG viewBox coordinate conversion for preserveAspectRatio="xMidYMid meet".
 * All playbook canvas pointer interactions must use this so click/drag positions match the rendered content.
 *
 * Regression note: Use a single uniform scale and centered offsets. Do NOT use separate scaleX/scaleY
 * or different offset logic per axis—that produces wrong coordinates and breaks route/block/erase/drag.
 */

export interface Rect {
  left: number
  top: number
  width: number
  height: number
}

/**
 * Convert client (screen) coordinates to SVG viewBox coordinates.
 * Matches preserveAspectRatio="xMidYMid meet": scale = min(rect.w/vbW, rect.h/vbH), content centered.
 */
export function clientToViewBox(
  clientX: number,
  clientY: number,
  rect: Rect,
  viewBoxWidth: number,
  viewBoxHeight: number
): { x: number; y: number } {
  const scale = Math.min(rect.width / viewBoxWidth, rect.height / viewBoxHeight)
  const offsetX = (rect.width - viewBoxWidth * scale) / 2
  const offsetY = (rect.height - viewBoxHeight * scale) / 2
  const localX = clientX - rect.left
  const localY = clientY - rect.top
  let x = (localX - offsetX) / scale
  let y = (localY - offsetY) / scale
  x = Math.max(0, Math.min(viewBoxWidth, x))
  y = Math.max(0, Math.min(viewBoxHeight, y))
  return { x, y }
}

import { PDFDocument, StandardFonts, rgb } from "pdf-lib"
import type { PDFFont, PDFPage } from "pdf-lib"
import type { RosterPrintPayload } from "@/lib/roster/roster-print-payload"
import { rosterCellText } from "@/lib/roster/roster-document-format"

const PAGE_W = 612
const PAGE_H = 792
const MARGIN = 48
const TABLE_INNER_PAD = 4
const COL_GUTTER = 2
const ROW_HEIGHT = 15
const TITLE_SIZE = 20
const SUBTITLE_SIZE = 10
const TABLE_HEADER_SIZE = 9
const TABLE_ROW_SIZE = 9
const FOOTER_SIZE = 8

type HAlign = "left" | "center" | "right"

function truncateToWidth(text: string, font: PDFFont, size: number, maxWidth: number): string {
  const t = text || ""
  if (maxWidth <= 0) return ""
  if (font.widthOfTextAtSize(t, size) <= maxWidth) return t
  let end = t.length
  const ell = "…"
  while (end > 0) {
    const slice = t.slice(0, end) + (end < t.length ? ell : "")
    if (font.widthOfTextAtSize(slice, size) <= maxWidth) return slice
    end -= 1
  }
  return ell
}

function drawTextAligned(
  page: PDFPage,
  text: string,
  cellLeft: number,
  cellWidth: number,
  baselineY: number,
  size: number,
  font: PDFFont,
  align: HAlign,
  color = rgb(0, 0, 0)
) {
  const inner = Math.max(0, cellWidth - 2 * TABLE_INNER_PAD)
  const display = truncateToWidth(text, font, size, inner)
  const w = font.widthOfTextAtSize(display, size)
  let x = cellLeft + TABLE_INNER_PAD
  if (align === "center") x = cellLeft + (cellWidth - w) / 2
  if (align === "right") x = cellLeft + cellWidth - TABLE_INNER_PAD - w
  page.drawText(display, { x, y: baselineY, size, font, color })
}

/**
 * Letter-sized PDF roster: fixed column widths, per-cell truncation (prevents overlap),
 * alignment, repeating document + table header on each page.
 */
export async function buildRosterPdfBytes(payload: RosterPrintPayload): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const { team, template, players, generatedAt } = payload
  const tb = template.body

  const schoolLine = team.schoolName?.trim() ?? ""

  type Col = {
    label: string
    width: number
    align: HAlign
    get: (p: (typeof players)[0]) => string
  }

  const cols: Col[] = []
  if (tb.showJerseyNumber) {
    cols.push({
      label: tb.jerseyNumberLabel,
      width: 42,
      align: "center",
      get: (p) => rosterCellText(p.jerseyNumber),
    })
  }
  if (tb.showPlayerName) {
    cols.push({
      label: tb.playerNameLabel,
      width: 178,
      align: "left",
      get: (p) => rosterCellText(p.name),
    })
  }
  if (tb.showGrade) {
    cols.push({
      label: tb.gradeLabel,
      width: 76,
      align: "left",
      get: (p) => rosterCellText(p.gradeLabel ?? p.grade),
    })
  }
  if (tb.showPosition !== false) {
    cols.push({
      label: tb.positionLabel ?? "Position",
      width: 52,
      align: "center",
      get: (p) => rosterCellText(p.position),
    })
  }
  if (tb.showWeight !== false) {
    cols.push({
      label: tb.weightLabel ?? "Weight",
      width: 48,
      align: "right",
      get: (p) => (p.weight != null ? rosterCellText(p.weight) : ""),
    })
  }
  if (tb.showHeight !== false) {
    cols.push({
      label: tb.heightLabel ?? "Height",
      width: 52,
      align: "center",
      get: (p) => rosterCellText(p.height),
    })
  }

  const tableWidth = cols.reduce((s, c) => s + c.width, 0) + Math.max(0, cols.length - 1) * COL_GUTTER
  const tableLeft = MARGIN + Math.max(0, (PAGE_W - 2 * MARGIN - tableWidth) / 2)

  function columnLefts(): number[] {
    const lefts: number[] = []
    let x = tableLeft
    for (let i = 0; i < cols.length; i += 1) {
      lefts.push(x)
      x += cols[i].width + (i < cols.length - 1 ? COL_GUTTER : 0)
    }
    return lefts
  }

  function drawDocumentHeaderBlock(page: PDFPage, startY: number): number {
    let y = startY
    if (template.header.showTeamName) {
      const title = team.name
      const tw = fontBold.widthOfTextAtSize(title, TITLE_SIZE)
      page.drawText(title, {
        x: (PAGE_W - tw) / 2,
        y,
        size: TITLE_SIZE,
        font: fontBold,
        color: rgb(0, 0, 0),
      })
      y -= TITLE_SIZE + 10
    }

    const metaParts: string[] = []
    if (template.header.showYear) {
      metaParts.push(`${template.header.yearLabel}: ${team.year}`)
    }
    if (template.header.showSchoolName && schoolLine) {
      metaParts.push(`${template.header.schoolNameLabel}: ${schoolLine}`)
    }
    if (metaParts.length > 0) {
      const line = metaParts.join("  |  ")
      const lw = font.widthOfTextAtSize(line, SUBTITLE_SIZE)
      page.drawText(line, {
        x: (PAGE_W - lw) / 2,
        y,
        size: SUBTITLE_SIZE,
        font,
        color: rgb(0.22, 0.22, 0.22),
      })
      y -= SUBTITLE_SIZE + 12
    }

    return y
  }

  /** Draw column header labels; returns baseline Y for first data row. */
  function drawColumnHeaders(page: PDFPage, headerBaselineY: number): number {
    const lefts = columnLefts()
    for (let i = 0; i < cols.length; i += 1) {
      const c = cols[i]
      drawTextAligned(page, c.label, lefts[i], c.width, headerBaselineY, TABLE_HEADER_SIZE, fontBold, c.align)
    }
    page.drawLine({
      start: { x: tableLeft, y: headerBaselineY - TABLE_HEADER_SIZE - 2 },
      end: { x: tableLeft + tableWidth, y: headerBaselineY - TABLE_HEADER_SIZE - 2 },
      thickness: 0.75,
      color: rgb(0.45, 0.45, 0.45),
    })
    return headerBaselineY - TABLE_HEADER_SIZE - 8
  }

  function drawDataRow(
    page: PDFPage,
    player: (typeof players)[0],
    rowBaselineY: number,
    zebra: boolean
  ) {
    const bandBottom = rowBaselineY - TABLE_ROW_SIZE - 6
    if (zebra) {
      page.drawRectangle({
        x: tableLeft - 1,
        y: bandBottom,
        width: tableWidth + 2,
        height: ROW_HEIGHT,
        color: rgb(0.96, 0.97, 0.98),
      })
    }
    const lefts = columnLefts()
    for (let i = 0; i < cols.length; i += 1) {
      const c = cols[i]
      drawTextAligned(
        page,
        c.get(player),
        lefts[i],
        c.width,
        rowBaselineY,
        TABLE_ROW_SIZE,
        font,
        c.align
      )
    }
  }

  let page = pdf.addPage([PAGE_W, PAGE_H])
  let rowIdx = 0
  let isFirstPage = true

  while (rowIdx < players.length) {
    if (!isFirstPage) {
      page = pdf.addPage([PAGE_W, PAGE_H])
    }
    isFirstPage = false

    let y = PAGE_H - MARGIN
    y = drawDocumentHeaderBlock(page, y)
    y -= 8

    const headerBaseline = y
    let rowBaseline = drawColumnHeaders(page, headerBaseline)

    const minY = MARGIN + 40
    while (rowIdx < players.length) {
      if (rowBaseline < minY + ROW_HEIGHT) break
      drawDataRow(page, players[rowIdx], rowBaseline, rowIdx % 2 === 1)
      rowBaseline -= ROW_HEIGHT
      rowIdx += 1
    }
  }

  if (template.footer.showGeneratedDate || template.footer.customText?.trim()) {
    const pages = pdf.getPages()
    const lastPage = pages[pages.length - 1]
    let fy = MARGIN + (template.footer.customText?.trim() ? 28 : 18)
    if (template.footer.showGeneratedDate) {
      const t = `Generated: ${new Date(generatedAt).toLocaleDateString()}`
      lastPage.drawText(t, { x: MARGIN, y: fy, size: FOOTER_SIZE, font, color: rgb(0.42, 0.42, 0.42) })
      fy += FOOTER_SIZE + 4
    }
    if (template.footer.customText?.trim()) {
      const foot = template.footer.customText.trim()
      lastPage.drawText(truncateToWidth(foot, font, FOOTER_SIZE, PAGE_W - 2 * MARGIN), {
        x: MARGIN,
        y: fy,
        size: FOOTER_SIZE,
        font,
        color: rgb(0.42, 0.42, 0.42),
      })
    }
  }

  return pdf.save()
}

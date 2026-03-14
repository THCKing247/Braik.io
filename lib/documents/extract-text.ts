/**
 * Extract plain text from document buffers for Coach B.
 * Supports: PDF, TXT, DOCX. Returns null for unsupported types or on error.
 */

const MIME_PDF = "application/pdf"
const MIME_TXT = "text/plain"
const MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
const MIME_DOC = "application/msword"

const MAX_EXTRACT_CHARS = 500_000 // cap for storage and prompt safety

export type ExtractResult = { text: string } | { error: string }

/**
 * Supported MIME types for text extraction.
 */
export const EXTRACTABLE_MIMES = [MIME_PDF, MIME_TXT, MIME_DOCX, MIME_DOC] as const

export function isExtractableMime(mime: string | null): boolean {
  if (!mime) return false
  return (EXTRACTABLE_MIMES as readonly string[]).includes(mime)
}

/**
 * Extract plain text from a buffer. Supports PDF, TXT, DOCX.
 * DOC (binary .doc) is not supported; only .docx is.
 */
export async function extractDocumentText(
  buffer: Buffer,
  mimeType: string | null,
  _fileName?: string
): Promise<ExtractResult> {
  const mime = (mimeType ?? "").toLowerCase().trim()

  if (mime === MIME_TXT) {
    try {
      const text = buffer.toString("utf-8").slice(0, MAX_EXTRACT_CHARS)
      return { text: text.trim() || "" }
    } catch (e) {
      return { error: "Failed to decode text file" }
    }
  }

  if (mime === MIME_PDF) {
    try {
      const pdf = await import("pdf-parse")
      const PDFParse = (pdf as { PDFParse?: new (opts: { data: Buffer }) => { getText(): Promise<{ text: string }>; destroy(): Promise<void> } }).PDFParse ?? (pdf as { default?: { PDFParse?: new (opts: { data: Buffer }) => { getText(): Promise<{ text: string }>; destroy(): Promise<void> } } }).default?.PDFParse
      if (!PDFParse) {
        return { error: "PDF parser not available" }
      }
      const parser = new PDFParse({ data: buffer })
      const result = await parser.getText()
      await parser.destroy?.()
      const text = (result?.text ?? "").trim().slice(0, MAX_EXTRACT_CHARS)
      return { text }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { error: `PDF extraction failed: ${msg}` }
    }
  }

  if (mime === MIME_DOCX) {
    try {
      const mammoth = await import("mammoth")
      const api = mammoth.default ?? mammoth
      // mammoth unzip accepts { buffer } and passes to zipfile.openArrayBuffer (JSZip) which accepts ArrayBuffer or Buffer
      const result = await api.extractRawText({ buffer })
      const text = (result?.value ?? "").trim().slice(0, MAX_EXTRACT_CHARS)
      return { text }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { error: `DOCX extraction failed: ${msg}` }
    }
  }

  if (mime === MIME_DOC) {
    return { error: "Binary .doc is not supported; use .docx for Word documents." }
  }

  return { error: "Unsupported file type for text extraction" }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

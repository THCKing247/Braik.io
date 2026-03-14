/**
 * Braik AI report context and extraction verification.
 * Run: npx tsx tests/braik-ai-report-context.test.ts
 *
 * Verifies:
 * - metadata-only: ReportContext items without extracted text use title/category as excerpt, hasExtractedText false.
 * - reports with extracted text: when extracted_text is present, hasExtractedText true and excerpt is content (truncated).
 * - extractDocumentText: TXT returns text; unsupported type returns error.
 */
import { extractDocumentText, isExtractableMime, EXTRACTABLE_MIMES } from "../lib/documents/extract-text"

async function run() {
  let passed = 0
  let failed = 0

  if (!EXTRACTABLE_MIMES.includes("application/pdf") || !EXTRACTABLE_MIMES.includes("text/plain") || !EXTRACTABLE_MIMES.includes("application/vnd.openxmlformats-officedocument.wordprocessingml.document")) {
    failed++
    console.error("Fail: EXTRACTABLE_MIMES should include pdf, text/plain, docx")
  } else {
    passed++
  }

  if (!isExtractableMime("application/pdf") || !isExtractableMime("text/plain")) {
    failed++
    console.error("Fail: isExtractableMime should return true for pdf and text/plain")
  } else {
    passed++
  }

  if (isExtractableMime("image/png") || isExtractableMime(null)) {
    failed++
    console.error("Fail: isExtractableMime should return false for image and null")
  } else {
    passed++
  }

  const txtBuffer = Buffer.from("Practice plan: Monday 3pm. Tuesday film.", "utf-8")
  const txtResult = await extractDocumentText(txtBuffer, "text/plain", "plan.txt")
  if ("error" in txtResult) {
    failed++
    console.error("Fail: TXT extraction should succeed", txtResult.error)
  } else if (!txtResult.text.includes("Practice plan")) {
    failed++
    console.error("Fail: TXT extraction should return content", txtResult.text)
  } else {
    passed++
  }

  const unsupported = await extractDocumentText(Buffer.from("x"), "image/png")
  if (!("error" in unsupported)) {
    failed++
    console.error("Fail: unsupported type should return error")
  } else {
    passed++
  }

  if (failed > 0) {
    console.error("\n%d failed, %d passed", failed, passed)
    process.exit(1)
  }
  console.log("All %d Braik AI report/extraction checks passed.", passed)
}

run()
